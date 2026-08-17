import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  getBarbers, saveBarber, deleteBarber,
  getServices, saveService, deleteService,
  getBookings, createBooking, updateBookingStatus, rescheduleBooking,
  getBarberQueueState
} from '../services/api';
import { realtime } from '../services/realtime';

const SystemContext = createContext();

// Polling interval used ONLY as a fallback when the WebSocket is unavailable.
// Much less aggressive than the old 4s loop — reduces D1 reads significantly.
const FALLBACK_POLL_INTERVAL_MS = 30_000;

export function SystemProvider({ children }) {
  const [barbers, setBarbers] = useState([]);
  const [services, setServices] = useState([]);
  const [bookings, setBookings] = useState([]);

  // Track whether WS is up so we can decide polling frequency
  const [wsConnected, setWsConnected] = useState(realtime.isConnected);
  const fallbackPollRef = useRef(null);

  // ── Full refresh (used on mount and as fallback poll) ──────────────────────
  const refreshData = useCallback(async () => {
    try {
      const [barbersData, servicesData, bookingsData] = await Promise.all([
        getBarbers(),
        getServices(),
        getBookings()
      ]);
      setBarbers(barbersData);
      setServices(servicesData);
      setBookings(bookingsData);
    } catch (err) {
      console.error('Error refreshing system data:', err);
    }
  }, []);

  // ── Fallback polling management ────────────────────────────────────────────
  // Runs only when the WebSocket is unavailable.  Stops automatically once WS
  // reconnects.  Interval is 30s (was 4s) — much kinder to D1 quotas.
  const startFallbackPoll = useCallback(() => {
    if (fallbackPollRef.current) return; // already running
    fallbackPollRef.current = setInterval(() => {
      refreshData();
    }, FALLBACK_POLL_INTERVAL_MS);
  }, [refreshData]);

  const stopFallbackPoll = useCallback(() => {
    if (fallbackPollRef.current) {
      clearInterval(fallbackPollRef.current);
      fallbackPollRef.current = null;
    }
  }, []);

  // ── Real-time WebSocket event handlers ────────────────────────────────────
  // Each handler applies a surgical state update instead of a full re-fetch,
  // keeping the UI responsive without extra D1 reads.
  useEffect(() => {
    // Initial full fetch
    refreshData();

    // Monitor WS connection state — switch between real-time and fallback poll
    const connectionChecker = setInterval(() => {
      const connected = realtime.isConnected;
      setWsConnected((prev) => {
        if (prev !== connected) {
          if (connected) {
            stopFallbackPoll();
          } else {
            startFallbackPoll();
          }
        }
        return connected;
      });
    }, 2000);

    // Start fallback poll immediately if WS is not yet connected
    if (!realtime.isConnected) {
      startFallbackPoll();
    }

    // Subscribe to real-time events pushed from the server via WebSocket
    const unsubscribe = realtime.subscribe((event) => {
      switch (event.type) {
        case 'NEW_BOOKING': {
          // Prepend the new booking — avoids a full re-fetch
          const newBooking = event.payload;
          if (newBooking) {
            setBookings((prev) => {
              // Guard against duplicates (e.g. same-tab optimistic update)
              const exists = prev.some((b) => b.id === newBooking.id);
              return exists ? prev : [newBooking, ...prev];
            });
          }
          break;
        }

        case 'BOOKING_STATUS_CHANGED': {
          const { id, status, booking } = event.payload || {};
          if (id) {
            setBookings((prev) =>
              prev.map((b) =>
                b.id === id
                  ? { ...b, status, ...(booking || {}) }
                  : b
              )
            );
          }
          break;
        }

        case 'BOOKING_RESCHEDULED': {
          const updated = event.payload;
          if (updated?.id) {
            setBookings((prev) =>
              prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b))
            );
          }
          break;
        }

        case 'BARBERS_UPDATED': {
          const updatedBarbers = event.payload;
          if (Array.isArray(updatedBarbers)) {
            setBarbers(updatedBarbers);
          }
          break;
        }

        case 'SERVICES_UPDATED': {
          const updatedServices = event.payload;
          if (Array.isArray(updatedServices)) {
            setServices(updatedServices);
          }
          break;
        }

        default:
          break;
      }
    });

    return () => {
      clearInterval(connectionChecker);
      stopFallbackPoll();
      unsubscribe();
    };
  }, [refreshData, startFallbackPoll, stopFallbackPoll]);

  // ── Barber Actions ─────────────────────────────────────────────────────────
  const handleSaveBarber = async (barberData) => {
    const updated = await saveBarber(barberData);
    setBarbers(updated);
    // Server will broadcast BARBERS_UPDATED via DO — other tabs update automatically
  };

  const handleDeleteBarber = async (id) => {
    const updated = await deleteBarber(id);
    setBarbers(updated);
  };

  // ── Service Actions ────────────────────────────────────────────────────────
  const handleSaveService = async (serviceData) => {
    const updated = await saveService(serviceData);
    setServices(updated);
  };

  const handleDeleteService = async (id) => {
    const updated = await deleteService(id);
    setServices(updated);
  };

  // ── Booking Actions ────────────────────────────────────────────────────────
  const handleCreateBooking = async (bookingData) => {
    const newBooking = await createBooking(bookingData);
    // Optimistic update: show the new booking immediately in this tab
    if (newBooking) {
      setBookings((prev) => {
        const exists = prev.some((b) => b.id === newBooking.id);
        return exists ? prev : [newBooking, ...prev];
      });
    }
    // Server broadcasts NEW_BOOKING to all other connected clients via DO
    return newBooking;
  };

  const handleUpdateBookingStatus = async (id, status, reason) => {
    const updated = await updateBookingStatus(id, status, reason);
    setBookings(updated);
    // Server broadcasts BOOKING_STATUS_CHANGED to all other connected clients
    return updated;
  };

  const handleRescheduleBooking = async (id, newDate, newTime) => {
    const updated = await rescheduleBooking(id, newDate, newTime);
    // updated is the single rescheduled booking object
    if (updated?.id) {
      setBookings((prev) =>
        prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b))
      );
    }
    return updated;
  };

  // ── Queue State ────────────────────────────────────────────────────────────
  // Computed synchronously from local bookings state — no API call needed
  const handleGetQueueState = useCallback((barberId, targetBookingId = null) => {
    return getBarberQueueState(bookings, barberId, targetBookingId);
  }, [bookings]);

  return (
    <SystemContext.Provider value={{
      barbers,
      services,
      bookings,
      wsConnected,
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
