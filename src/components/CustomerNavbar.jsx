import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Scissors, Clock, LogOut, User, Menu, X, Calendar } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import OtpModal from './OtpModal';

export default function CustomerNavbar() {
  const location = useLocation();
  const { customer, customerLogout } = useAuth();
  const [showOtp, setShowOtp] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isBooking = location.pathname === '/' || location.pathname.startsWith('/booking');
  const isMyBookings = location.pathname === '/my-bookings';

  return (
    <>
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(8, 9, 12, 0.94)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>

            {/* LOGO */}
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', textDecoration: 'none' }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: 'linear-gradient(135deg, #f5df99, var(--accent))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(194, 112, 61, 0.25)',
              }}>
                <Scissors style={{ width: 18, height: 18, color: '#000' }} />
              </div>
              <div>
                <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#f8fafc', display: 'block', lineHeight: 1.2 }}>
                  صالون الفخامة
                </span>
                <span style={{ fontSize: '0.62rem', color: 'rgba(194, 112, 61, 0.8)', fontWeight: 600 }}>
                  حجز مواعيد العناية
                </span>
              </div>
            </Link>

            {/* DESKTOP NAV */}
            <nav style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }} className="desktop-nav">
              <Link
                to="/"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.5rem 0.9rem',
                  borderRadius: 10,
                  fontSize: '0.82rem', fontWeight: 700,
                  textDecoration: 'none',
                  color: isBooking ? '#000' : 'rgba(148,163,184,1)',
                  background: isBooking ? 'linear-gradient(135deg, #f5df99, var(--accent))' : 'transparent',
                  transition: 'all 0.2s ease'
                }}
              >
                <Calendar style={{ width: 15, height: 15 }} />
                احجز الآن
              </Link>

              <Link
                to="/my-bookings"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.5rem 0.9rem',
                  borderRadius: 10,
                  fontSize: '0.82rem', fontWeight: 700,
                  textDecoration: 'none',
                  color: isMyBookings ? '#000' : 'rgba(148,163,184,1)',
                  background: isMyBookings ? 'linear-gradient(135deg, #f5df99, var(--accent))' : 'transparent',
                  transition: 'all 0.2s ease'
                }}
              >
                <Clock style={{ width: 15, height: 15 }} />
                حجوزاتي
              </Link>
            </nav>

            {/* RIGHT SIDE */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {customer ? (
                /* Logged-in user */
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.4rem 0.75rem',
                    background: 'rgba(194, 112, 61, 0.07)',
                    border: '1px solid rgba(194, 112, 61, 0.15)',
                    borderRadius: 10,
                  }} className="user-badge">
                    <div style={{
                      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                      background: 'rgba(194, 112, 61, 0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <User style={{ width: 14, height: 14, color: 'var(--accent)' }} />
                    </div>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#f8fafc' }} className="user-name-text">
                      {customer.name}
                    </span>
                  </div>
                  <button
                    onClick={customerLogout}
                    title="تسجيل الخروج"
                    style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: 'rgba(181, 80, 74, 0.07)',
                      border: '1px solid rgba(181, 80, 74, 0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', color: '#f43f5e',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <LogOut style={{ width: 15, height: 15 }} />
                  </button>
                </div>
              ) : (
                /* Login button */
                <button
                  onClick={() => setShowOtp(true)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.55rem 1.1rem',
                    background: 'linear-gradient(135deg, #f5df99, var(--accent))',
                    border: 'none', borderRadius: 10,
                    color: '#000', fontWeight: 800, fontSize: '0.82rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(194, 112, 61, 0.2)',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <User style={{ width: 15, height: 15 }} />
                  دخول / تسجيل
                </button>
              )}

              {/* Mobile Hamburger */}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  display: 'none', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: '#94a3b8',
                  flexShrink: 0,
                }}
                className="hamburger-btn"
              >
                {menuOpen ? <X style={{ width: 18, height: 18 }} /> : <Menu style={{ width: 18, height: 18 }} />}
              </button>
            </div>
          </div>

          {/* MOBILE MENU */}
          {menuOpen && (
            <div style={{
              borderTop: '1px solid rgba(255,255,255,0.05)',
              paddingTop: '0.75rem',
              paddingBottom: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
            }} className="mobile-menu">
              <Link
                to="/"
                onClick={() => setMenuOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  padding: '0.75rem 0.875rem',
                  borderRadius: 12, textDecoration: 'none',
                  fontSize: '0.875rem', fontWeight: 700,
                  color: isBooking ? 'var(--accent)' : '#94a3b8',
                  background: isBooking ? 'rgba(194, 112, 61, 0.06)' : 'transparent',
                }}
              >
                <Calendar style={{ width: 16, height: 16 }} />
                احجز الآن
              </Link>
              <Link
                to="/my-bookings"
                onClick={() => setMenuOpen(false)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  padding: '0.75rem 0.875rem',
                  borderRadius: 12, textDecoration: 'none',
                  fontSize: '0.875rem', fontWeight: 700,
                  color: isMyBookings ? 'var(--accent)' : '#94a3b8',
                  background: isMyBookings ? 'rgba(194, 112, 61, 0.06)' : 'transparent',
                }}
              >
                <Clock style={{ width: 16, height: 16 }} />
                حجوزاتي
              </Link>
            </div>
          )}
        </div>
      </header>

      <OtpModal
        isOpen={showOtp}
        onClose={() => setShowOtp(false)}
        onSuccess={() => setShowOtp(false)}
      />
    </>
  );
}
