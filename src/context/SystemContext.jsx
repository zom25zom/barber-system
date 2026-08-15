import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  getBarbers, saveBarber, deleteBarber,
  getServices, saveService, deleteService,
  getBookings, createBooking, updateBookingStatus, rescheduleBooking,
  getNotifications, getBarberQueueState
} from '../services/api';
import { realtime } from '../services/realtime';

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

const SystemContext = createContext();

export function SystemProvider({ children }) {
  const [barbers, setBarbers] = useState([]);
  const [services, setServices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [toastNotif, setToastNotif] = useState(null);

  const lastNotifCount = useRef(0);

  const refreshData = useCallback(async () => {
    try {
      const [barbersData, servicesData, bookingsData, notificationsData] = await Promise.all([
        getBarbers(),
        getServices(),
        getBookings(),
        getNotifications()
      ]);
      setBarbers(barbersData);
      setServices(servicesData);
      setBookings(bookingsData);
      setNotifications(prev => {
        // Detect new notifications coming from another device (via polling)
        if (notificationsData.length > lastNotifCount.current && lastNotifCount.current > 0) {
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
      console.error('Error refreshing system data:', err);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    refreshData();

    // High frequency Polling Loop (real-time sync)
    // Runs every 4 seconds to fetch any changes made by other devices/users
    const intervalId = setInterval(() => {
      refreshData();
    }, 4000);

    // Subscribe to real-time events across windows/tabs of the same browser
    const unsubscribe = realtime.subscribe((event) => {
      refreshData();
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
  }, [refreshData]);

  // Barber Actions
  const handleSaveBarber = async (barberData) => {
    const updated = await saveBarber(barberData);
    setBarbers(updated);
  };

  const handleDeleteBarber = async (id) => {
    const updated = await deleteBarber(id);
    setBarbers(updated);
  };

  // Service Actions
  const handleSaveService = async (serviceData) => {
    const updated = await saveService(serviceData);
    setServices(updated);
  };

  const handleDeleteService = async (id) => {
    const updated = await deleteService(id);
    setServices(updated);
  };

  // Booking Actions
  const handleCreateBooking = async (bookingData) => {
    const newBooking = await createBooking(bookingData);
    await refreshData();
    return newBooking;
  };

  const handleUpdateBookingStatus = async (id, status, reason) => {
    const updated = await updateBookingStatus(id, status, reason);
    setBookings(updated);
    await refreshData();
    return updated;
  };

  const handleRescheduleBooking = async (id, newDate, newTime) => {
    const updated = await rescheduleBooking(id, newDate, newTime);
    await refreshData();
    return updated;
  };

  // Compute queue state synchronously using the React local state of bookings
  const handleGetQueueState = useCallback((barberId, targetBookingId = null) => {
    return getBarberQueueState(bookings, barberId, targetBookingId);
  }, [bookings]);

  return (
    <SystemContext.Provider value={{
      barbers,
      services,
      bookings,
      notifications,
      toastNotif,
      setToastNotif,
      saveBarber: handleSaveBarber,
      deleteBarber: handleDeleteBarber,
      saveService: handleSaveService,
      deleteService: handleDeleteService,
      createBooking: handleCreateBooking,
      updateBookingStatus: handleUpdateBookingStatus,
      rescheduleBooking: handleRescheduleBooking,
      getQueueState: handleGetQueueState,
      refreshData
    }}>
      {children}
    </SystemContext.Provider>
  );
}

export function useSystem() {
  return useContext(SystemContext);
}
