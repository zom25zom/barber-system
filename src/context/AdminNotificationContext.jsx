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

// Fallback poll interval removed to eliminate unnecessary requests.

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
  const lastNotifIdRef = useRef(null); // track newest known notification ID

  // ── Full notification refresh ──────────────────────────────────────────────
  // Used on mount only (no polling)
  const refreshNotifications = useCallback(async ({ announce = true } = {}) => {
    try {
      const notificationsData = await getNotifications();
      setNotifications(() => {
        if (
          announce &&
          notificationsData.length > 0 &&
          lastNotifIdRef.current !== null &&
          notificationsData[0]?.id !== lastNotifIdRef.current
        ) {
          // A new notification appeared since last check
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
        if (notificationsData.length > 0) {
          lastNotifIdRef.current = notificationsData[0].id;
        }
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
      lastNotifIdRef.current = null;
      return;
    }

    // Initial load (silent — no toast on first load)
    refreshNotifications({ announce: false });

    // ── WebSocket event handlers ───────────────────────────────────────────
    // React to server-pushed events only (no polling)
    const unsubscribe = realtime.subscribe((event) => {
      switch (event.type) {
        case 'NOTIFICATION_ADDED': {
          // Server pushed a new notification — prepend it without an API call
          const notif = event.payload;
          if (!notif) break;

          setNotifications((prev) => {
            // Guard against duplicates
            if (prev.some((n) => n.id === notif.id)) return prev;
            // Update the "newest known" cursor
            lastNotifIdRef.current = notif.id;
            return [notif, ...prev.slice(0, 49)];
          });

          // Play sound and show toast for unread notifications
          if (!notif.read) {
            playNotificationSound(notif.type === 'new_booking' ? 'new' : 'update');
            setToastNotif({
              title: notif.title,
              message: notif.message,
              type: notif.type === 'new_booking' ? 'info' : 'warning'
            });
          }
          break;
        }

        case 'NEW_BOOKING': {
          // A booking was just created — the NOTIFICATION_ADDED event will
          // carry the notification object, so we only need the booking toast here
          // if the admin is on a page that doesn't show notifications.
          const booking = event.payload;
          if (booking) {
            playNotificationSound('new');
            setToastNotif({
              title: 'حجز جديد ✨',
              message: `عميل جديد قام بالحجز: ${booking.customerName}`,
              type: 'info'
            });
          }
          break;
        }

        case 'BOOKING_STATUS_CHANGED': {
          // A booking status changed — show a quick toast
          playNotificationSound('update');
          setToastNotif({
            title: 'تحديث طابور الانتظار 🔄',
            message: 'تغيرت حالة أحد الحجوزات في القائمة',
            type: 'warning'
          });
          break;
        }

        default:
          break;
      }
    });

    return () => {
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
