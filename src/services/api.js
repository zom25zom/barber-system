import { DEFAULT_BARBERS, DEFAULT_SERVICES, DEFAULT_BOOKINGS, DEFAULT_NOTIFICATIONS } from './initialData';

// Returns today's date as YYYY-MM-DD in the user's LOCAL timezone (not UTC)
export function getLocalDateStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const KEYS = {
  BARBERS: 'barber_sys_barbers',
  SERVICES: 'barber_sys_services',
  BOOKINGS: 'barber_sys_bookings',
  NOTIFICATIONS: 'barber_sys_notifications',
  ADMIN_AUTH: 'barber_sys_admin_session',
  ADMIN_PASS: 'barber_sys_admin_pass',
  CUSTOMER_AUTH: 'barber_sys_customer_auth',
};

// Initialize LocalStorage with default data if empty (Fallback)
export function initStorage() {
  if (!localStorage.getItem(KEYS.BARBERS)) {
    localStorage.setItem(KEYS.BARBERS, JSON.stringify(DEFAULT_BARBERS));
  }
  if (!localStorage.getItem(KEYS.SERVICES)) {
    localStorage.setItem(KEYS.SERVICES, JSON.stringify(DEFAULT_SERVICES));
  }
  if (!localStorage.getItem(KEYS.BOOKINGS)) {
    localStorage.setItem(KEYS.BOOKINGS, JSON.stringify(DEFAULT_BOOKINGS));
  }
  if (!localStorage.getItem(KEYS.NOTIFICATIONS)) {
    localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(DEFAULT_NOTIFICATIONS));
  }
  if (!localStorage.getItem(KEYS.ADMIN_PASS)) {
    localStorage.setItem(KEYS.ADMIN_PASS, 'admin123');
  }
}

// Helper to broadcast changes for real-time tab sync
const broadcastChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('barber_system_realtime')
  : null;

export function notifyStateChange(eventType, payload) {
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type: eventType, payload, timestamp: Date.now() });
  }
}

// ---------------- API CALL HELPER ----------------
async function apiCall(endpoint, options = {}) {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP error ${response.status}`);
  }
  return await response.json();
}

// ---------------- LOCAL FALLBACK HELPERS ----------------
function getBarbersLocal() {
  initStorage();
  try {
    return JSON.parse(localStorage.getItem(KEYS.BARBERS)) || [];
  } catch (e) {
    return DEFAULT_BARBERS;
  }
}

function getServicesLocal() {
  initStorage();
  try {
    return JSON.parse(localStorage.getItem(KEYS.SERVICES)) || [];
  } catch (e) {
    return DEFAULT_SERVICES;
  }
}

function getBookingsLocal() {
  initStorage();
  try {
    return JSON.parse(localStorage.getItem(KEYS.BOOKINGS)) || [];
  } catch (e) {
    return DEFAULT_BOOKINGS;
  }
}

function getNotificationsLocal() {
  initStorage();
  try {
    return JSON.parse(localStorage.getItem(KEYS.NOTIFICATIONS)) || [];
  } catch (e) {
    return DEFAULT_NOTIFICATIONS;
  }
}

// ---------------- BARBERS API ----------------
export async function getBarbers() {
  try {
    return await apiCall('/api/barbers');
  } catch (err) {
    console.warn('API fallback to LocalStorage for getBarbers:', err.message);
    return getBarbersLocal();
  }
}

export async function saveBarber(barberData) {
  try {
    return await apiCall('/api/barbers', {
      method: 'POST',
      body: JSON.stringify(barberData)
    });
  } catch (err) {
    console.warn('API fallback to LocalStorage for saveBarber:', err.message);
    const barbers = getBarbersLocal();
    let updated;
    if (barberData.id) {
      updated = barbers.map(b => b.id === barberData.id ? { ...b, ...barberData } : b);
    } else {
      const newBarber = {
        ...barberData,
        id: 'b_' + Date.now(),
        rating: 5.0,
        avatar: barberData.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80'
      };
      updated = [...barbers, newBarber];
    }
    localStorage.setItem(KEYS.BARBERS, JSON.stringify(updated));
    notifyStateChange('BARBERS_UPDATED', updated);
    return updated;
  }
}

export async function deleteBarber(id) {
  try {
    return await apiCall(`/api/barbers?id=${id}`, {
      method: 'DELETE'
    });
  } catch (err) {
    console.warn('API fallback to LocalStorage for deleteBarber:', err.message);
    const barbers = getBarbersLocal().filter(b => b.id !== id);
    localStorage.setItem(KEYS.BARBERS, JSON.stringify(barbers));
    notifyStateChange('BARBERS_UPDATED', barbers);
    return barbers;
  }
}

// ---------------- SERVICES API ----------------
export async function getServices() {
  try {
    return await apiCall('/api/services');
  } catch (err) {
    console.warn('API fallback to LocalStorage for getServices:', err.message);
    return getServicesLocal();
  }
}

export async function saveService(serviceData) {
  try {
    return await apiCall('/api/services', {
      method: 'POST',
      body: JSON.stringify(serviceData)
    });
  } catch (err) {
    console.warn('API fallback to LocalStorage for saveService:', err.message);
    const services = getServicesLocal();
    let updated;
    if (serviceData.id) {
      updated = services.map(s => s.id === serviceData.id ? { ...s, ...serviceData } : s);
    } else {
      const newService = {
        ...serviceData,
        id: 's_' + Date.now()
      };
      updated = [...services, newService];
    }
    localStorage.setItem(KEYS.SERVICES, JSON.stringify(updated));
    notifyStateChange('SERVICES_UPDATED', updated);
    return updated;
  }
}

export async function deleteService(id) {
  try {
    return await apiCall(`/api/services?id=${id}`, {
      method: 'DELETE'
    });
  } catch (err) {
    console.warn('API fallback to LocalStorage for deleteService:', err.message);
    const services = getServicesLocal().filter(s => s.id !== id);
    localStorage.setItem(KEYS.SERVICES, JSON.stringify(services));
    notifyStateChange('SERVICES_UPDATED', services);
    return services;
  }
}

// ---------------- BOOKINGS API ----------------
export async function getBookings() {
  try {
    return await apiCall('/api/bookings');
  } catch (err) {
    console.warn('API fallback to LocalStorage for getBookings:', err.message);
    return getBookingsLocal();
  }
}

export async function createBooking(bookingInput) {
  try {
    const newBooking = await apiCall('/api/bookings', {
      method: 'POST',
      body: JSON.stringify(bookingInput)
    });

    // We also register a notification for this booking
    const barbers = await getBarbers();
    const barber = barbers.find(b => b.id === bookingInput.barberId);
    const barberName = barber ? barber.name : 'غير محدد';

    await addNotification({
      title: 'حجز جديد ✨',
      message: `قام العميل ${bookingInput.customerName} (${bookingInput.customerPhone}) بحجز موعد عند ${barberName} الساعة ${bookingInput.time}`,
      type: 'new_booking',
      bookingId: newBooking.id
    });

    notifyStateChange('NEW_BOOKING', newBooking);
    return newBooking;
  } catch (err) {
    console.warn('API fallback to LocalStorage for createBooking:', err.message);
    const bookings = getBookingsLocal();
    const newBooking = {
      id: 'bk-' + Math.floor(100000 + Math.random() * 900000),
      status: 'Pending',
      createdAt: new Date().toISOString(),
      ...bookingInput
    };
    
    const updatedBookings = [newBooking, ...bookings];
    localStorage.setItem(KEYS.BOOKINGS, JSON.stringify(updatedBookings));

    const barbers = getBarbersLocal();
    const barber = barbers.find(b => b.id === bookingInput.barberId);
    const barberName = barber ? barber.name : 'غير محدد';

    addNotification({
      title: 'حجز جديد ✨',
      message: `قام العميل ${bookingInput.customerName} (${bookingInput.customerPhone}) بحجز موعد عند ${barberName} الساعة ${bookingInput.time}`,
      type: 'new_booking',
      bookingId: newBooking.id
    });

    notifyStateChange('NEW_BOOKING', newBooking);
    return newBooking;
  }
}

export async function updateBookingStatus(id, newStatus, reason = '') {
  try {
    const updatedBookings = await apiCall('/api/bookings', {
      method: 'PUT',
      body: JSON.stringify({ id, status: newStatus })
    });

    const targetBooking = updatedBookings.find(b => b.id === id);
    if (targetBooking) {
      await addNotification({
        title: newStatus === 'Cancelled' || newStatus === 'CancelledByCustomer' ? 'إلغاء حجز ⚠️' : 'تحديث حجز 🔄',
        message: `تغيرت حالة حجز العميل ${targetBooking.customerName} إلى (${getArabicStatus(newStatus)})`,
        type: 'status_change',
        bookingId: id
      });
      notifyStateChange('BOOKING_STATUS_CHANGED', { id, status: newStatus, booking: targetBooking });
    }

    return updatedBookings;
  } catch (err) {
    console.warn('API fallback to LocalStorage for updateBookingStatus:', err.message);
    const bookings = getBookingsLocal();
    let targetBooking = null;
    const updated = bookings.map(b => {
      if (b.id === id) {
        targetBooking = { ...b, status: newStatus };
        return targetBooking;
      }
      return b;
    });

    localStorage.setItem(KEYS.BOOKINGS, JSON.stringify(updated));

    if (targetBooking) {
      addNotification({
        title: newStatus === 'Cancelled' || newStatus === 'CancelledByCustomer' ? 'إلغاء حجز ⚠️' : 'تحديث حجز 🔄',
        message: `تغيرت حالة حجز العميل ${targetBooking.customerName} إلى (${getArabicStatus(newStatus)})`,
        type: 'status_change',
        bookingId: id
      });
      notifyStateChange('BOOKING_STATUS_CHANGED', { id, status: newStatus, booking: targetBooking });
    }

    return updated;
  }
}

export async function rescheduleBooking(id, newDate, newTime) {
  try {
    const updatedBookings = await apiCall('/api/bookings', {
      method: 'PUT',
      body: JSON.stringify({ id, date: newDate, time: newTime })
    });

    const updatedBooking = updatedBookings.find(b => b.id === id);
    if (updatedBooking) {
      await addNotification({
        title: 'تعديل موعد 📅',
        message: `قام العميل ${updatedBooking.customerName} بتعديل موعده إلى ${newDate} الساعة ${newTime}`,
        type: 'reschedule',
        bookingId: id
      });
      notifyStateChange('BOOKING_RESCHEDULED', updatedBooking);
    }
    return updatedBooking;
  } catch (err) {
    console.warn('API fallback to LocalStorage for rescheduleBooking:', err.message);
    const bookings = getBookingsLocal();
    let updatedBooking = null;
    const updated = bookings.map(b => {
      if (b.id === id) {
        updatedBooking = { ...b, date: newDate, time: newTime, status: 'Rescheduled' };
        return updatedBooking;
      }
      return b;
    });

    localStorage.setItem(KEYS.BOOKINGS, JSON.stringify(updated));

    if (updatedBooking) {
      addNotification({
        title: 'تعديل موعد 📅',
        message: `قام العميل ${updatedBooking.customerName} بتعديل موعده إلى ${newDate} الساعة ${newTime}`,
        type: 'reschedule',
        bookingId: id
      });
      notifyStateChange('BOOKING_RESCHEDULED', updatedBooking);
    }

    return updatedBooking;
  }
}

// ---------------- QUEUE CALCULATION ----------------
// Accepts the list of bookings directly to enable fast, synchronous updates in frontend
export function getBarberQueueState(bookings, barberId, targetBookingId = null) {
  const todayStr = getLocalDateStr();

  // Filter pending/active bookings for this barber for today (or specified date)
  let queue = bookings.filter(b => {
    const isPending = b.status === 'Pending' || b.status === 'Rescheduled';
    return isPending && b.barberId === barberId;
  });

  // Sort queue by time and creation
  queue.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.time !== b.time) return a.time.localeCompare(b.time);
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  if (!targetBookingId) {
    return {
      queueCount: queue.length,
      totalWaitMinutes: queue.reduce((sum, item) => sum + (item.totalDuration || 30), 0),
      items: queue
    };
  }

  // Find position of target booking
  const targetIndex = queue.findIndex(b => b.id === targetBookingId);
  if (targetIndex === -1) {
    return {
      peopleAhead: 0,
      estimatedWaitMinutes: 0,
      position: 0,
      isNext: false,
      queueCount: queue.length
    };
  }

  const aheadItems = queue.slice(0, targetIndex);
  const estimatedWaitMinutes = aheadItems.reduce((sum, item) => sum + (item.totalDuration || 30), 0);

  return {
    peopleAhead: targetIndex,
    estimatedWaitMinutes,
    position: targetIndex + 1,
    isNext: targetIndex === 0,
    queueCount: queue.length
  };
}

// ---------------- NOTIFICATIONS ----------------
export async function getNotifications() {
  try {
    return await apiCall('/api/notifications');
  } catch (err) {
    console.warn('API fallback to LocalStorage for getNotifications:', err.message);
    return getNotificationsLocal();
  }
}

export async function addNotification(notif) {
  try {
    return await apiCall('/api/notifications', {
      method: 'POST',
      body: JSON.stringify(notif)
    });
  } catch (err) {
    console.warn('API fallback to LocalStorage for addNotification:', err.message);
    const notifs = getNotificationsLocal();
    const newNotif = {
      id: 'n-' + Date.now(),
      timestamp: new Date().toISOString(),
      read: false,
      ...notif
    };
    const updated = [newNotif, ...notifs.slice(0, 49)];
    localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(updated));
    notifyStateChange('NOTIFICATION_ADDED', newNotif);
    return updated;
  }
}

export async function markNotificationsAsRead(id = null) {
  try {
    return await apiCall('/api/notifications/read', {
      method: 'POST',
      body: JSON.stringify({ id })
    });
  } catch (err) {
    console.warn('API fallback to LocalStorage for markNotificationsAsRead:', err.message);
    const notifs = getNotificationsLocal();
    const updated = notifs.map(n => (id === null || n.id === id) ? { ...n, read: true } : n);
    localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(updated));
    notifyStateChange('NOTIFICATIONS_READ', updated);
    return updated;
  }
}

// ---------------- AUTH & CUSTOMER SESSION ----------------
export async function checkAdminPassword(password) {
  try {
    const res = await apiCall('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password })
    });
    return res.success;
  } catch (err) {
    console.warn('API fallback to LocalStorage for checkAdminPassword:', err.message);
    initStorage();
    const stored = localStorage.getItem(KEYS.ADMIN_PASS) || 'admin123';
    return password === stored;
  }
}

export function setAdminSession(isLoggedIn) {
  if (isLoggedIn) {
    localStorage.setItem(KEYS.ADMIN_AUTH, JSON.stringify({ loggedIn: true, time: Date.now() }));
  } else {
    localStorage.removeItem(KEYS.ADMIN_AUTH);
  }
}

export function isAdminLoggedIn() {
  try {
    const sess = JSON.parse(localStorage.getItem(KEYS.ADMIN_AUTH));
    return !!(sess && sess.loggedIn);
  } catch (e) {
    return false;
  }
}

export async function changeAdminPassword(newPassword) {
  try {
    const res = await apiCall('/api/admin/change-password', {
      method: 'POST',
      body: JSON.stringify({ password: newPassword })
    });
    return res.success;
  } catch (err) {
    console.warn('API fallback to LocalStorage for changeAdminPassword:', err.message);
    localStorage.setItem(KEYS.ADMIN_PASS, newPassword);
    return true;
  }
}

// Customer OTP & Session
export function getCustomerSession() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.CUSTOMER_AUTH));
  } catch (e) {
    return null;
  }
}

export function setCustomerSession(customerData) {
  const session = {
    ...customerData,
    token: 'cust_' + Date.now(),
    loginTime: new Date().toISOString()
  };
  localStorage.setItem(KEYS.CUSTOMER_AUTH, JSON.stringify(session));
  return session;
}

export function clearCustomerSession() {
  localStorage.removeItem(KEYS.CUSTOMER_AUTH);
}

// ---------------- HELPERS ----------------
export function getArabicStatus(status) {
  switch (status) {
    case 'Pending': return 'في الانتظار';
    case 'Completed': return 'مكتمل';
    case 'Cancelled':
    case 'CancelledByCustomer': return 'ملغى من العميل';
    case 'CancelledByOwner': return 'ملغى من الصالون';
    case 'Rescheduled': return 'تم تعديل الموعد';
    default: return status;
  }
}

export function formatTimeTo12h(timeStr) {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hour = parseInt(parts[0], 10);
  const minute = parts[1];
  const ampm = hour >= 12 ? 'م' : 'ص';
  hour = hour % 12;
  hour = hour ? hour : 12;
  const paddedHour = hour < 10 ? '0' + hour : hour;
  return `${paddedHour}:${minute} ${ampm}`;
}
