import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  getBarbers, saveBarber, deleteBarber,
  getServices, saveService, deleteService,
  getBookings, createBooking, updateBookingStatus, rescheduleBooking,
  getBarberQueueState
} from '../services/api';
import { realtime } from '../services/realtime';

const SystemContext = createContext();

export function SystemProvider({ children }) {
  const [barbers, setBarbers] = useState([]);
  const [services, setServices] = useState([]);
  const [bookings, setBookings] = useState([]);

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

  useEffect(() => {
    // Initial fetch
    refreshData();

    // High frequency Polling Loop (real-time sync)
    // Runs every 4 seconds to fetch any changes made by other devices/users
    const intervalId = setInterval(() => {
      refreshData();
    }, 4000);

    // Keep bookings/queue in sync across tabs. Admin toasts/sounds live in AdminNotificationProvider.
    const unsubscribe = realtime.subscribe(() => {
      refreshData();
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
