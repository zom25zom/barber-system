import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getNotifications } from '../services/api';
import { realtime } from '../services/realtime';
import { useAuth } from './AuthContext';

// Play a short notification chime using Web Audio API (no external file needed)
function playNotificationSound(type = 'new') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'new') {
      // Two-tone ascending chime for new booking
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.12);
    } else {
      // Single soft tone for status updates
      osc.frequency.setValueAtTime(660, ctx.currentTime);
    }

    osc.type = 'sine';
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    // Silently fail if audio not supported
  }
}

const ADMIN_REALTIME_EVENTS = new Set([
  'NEW_BOOKING',
  'BOOKING_STATUS_CHANGED',
  'BOOKING_RESCHEDULED',
  'NOTIFICATION_ADDED'
]);

const AdminNotificationContext = createContext({
  notifications: [],
  toastNotif: null,
  setToastNotif: () => {},
  refreshNotifications: async () => {}
});

// Mount only around authenticated admin routes. Customer pages never load this provider.
export function AdminNotificationProvider({ children }) {
  const { isAdmin } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [toastNotif, setToastNotif] = useState(null);
  const lastNotifCount = useRef(0);

  const refreshNotifications = useCallback(async ({ announce = true } = {}) => {
    try {
      const notificationsData = await getNotifications();
      setNotifications(() => {
        if (announce && notificationsData.length > lastNotifCount.current && lastNotifCount.current > 0) {
          const newest = notificationsData[0];
          if (newest && !newest.read) {
            playNotificationSound(newest.type === 'new_booking' ? 'new' : 'update');
            setToastNotif({
              title: newest.title,
              message: newest.message,
              type: newest.type === 'new_booking' ? 'info' : 'warning'
            });
          }
        }
        lastNotifCount.current = notificationsData.length;
        return notificationsData;
      });
    } catch (err) {
      console.error('Error refreshing admin notifications:', err);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setNotifications([]);
      setToastNotif(null);
      lastNotifCount.current = 0;
      return;
    }

    refreshNotifications({ announce: false });

    const intervalId = setInterval(() => {
      refreshNotifications();
    }, 4000);

    const unsubscribe = realtime.subscribe((event) => {
      if (!ADMIN_REALTIME_EVENTS.has(event.type)) return;

      refreshNotifications({ announce: false });

      if (event.type === 'NEW_BOOKING') {
        playNotificationSound('new');
        setToastNotif({
          title: 'حجز جديد ✨',
          message: `عميل جديد قام بالحجز: ${event.payload.customerName}`,
          type: 'info'
        });
      } else if (event.type === 'BOOKING_STATUS_CHANGED') {
        playNotificationSound('update');
        setToastNotif({
          title: 'تحديث طابور الانتظار 🔄',
          message: `تغيرت حالة أحد الحجوزات في القائمة`,
          type: 'warning'
        });
      }
    });

    return () => {
      clearInterval(intervalId);
      unsubscribe();
    };
  }, [isAdmin, refreshNotifications]);

  return (
    <AdminNotificationContext.Provider value={{
      notifications,
      toastNotif,
      setToastNotif,
      refreshNotifications
    }}>
      {children}
    </AdminNotificationContext.Provider>
  );
}

export function useAdminNotifications() {
  return useContext(AdminNotificationContext);
}
