import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SystemProvider } from './context/SystemContext';
import { AdminNotificationProvider } from './context/AdminNotificationContext';

// Customer Pages
import HomeBookingPage from './pages/customer/HomeBookingPage';
import ServiceSelectPage from './pages/customer/ServiceSelectPage';
import TimeSelectPage from './pages/customer/TimeSelectPage';
import ConfirmationPage from './pages/customer/ConfirmationPage';
import LiveQueueTrackerPage from './pages/customer/LiveQueueTrackerPage';
import MyBookingsPage from './pages/customer/MyBookingsPage';

// Admin Pages
import AdminLoginPage from './pages/admin/AdminLoginPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminBookingsPage from './pages/admin/AdminBookingsPage';
import AdminBarbersPage from './pages/admin/AdminBarbersPage';
import AdminServicesPage from './pages/admin/AdminServicesPage';
import AdminCustomersPage from './pages/admin/AdminCustomersPage';
import AdminReportsPage from './pages/admin/AdminReportsPage';

export default function App() {
  return (
    <AuthProvider>
      <SystemProvider>
        <BrowserRouter>
          <Routes>
            {/* Customer Routes */}
            <Route path="/" element={<HomeBookingPage />} />
            <Route path="/booking/services" element={<ServiceSelectPage />} />
            <Route path="/booking/time" element={<TimeSelectPage />} />
            <Route path="/booking/confirm" element={<ConfirmationPage />} />
            <Route path="/queue/:bookingId" element={<LiveQueueTrackerPage />} />
            <Route path="/my-bookings" element={<MyBookingsPage />} />

            {/* Owner/Admin Routes — salon notifications only mount inside this layout */}
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route element={<AdminNotificationProvider><Outlet /></AdminNotificationProvider>}>
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/bookings" element={<AdminBookingsPage />} />
              <Route path="/admin/barbers" element={<AdminBarbersPage />} />
              <Route path="/admin/services" element={<AdminServicesPage />} />
              <Route path="/admin/customers" element={<AdminCustomersPage />} />
              <Route path="/admin/reports" element={<AdminReportsPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </SystemProvider>
    </AuthProvider>
  );
}
