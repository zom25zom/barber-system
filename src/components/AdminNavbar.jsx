import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, CalendarCheck, Users, Scissors, 
  UserCheck, TrendingUp, Bell, LogOut, ShieldAlert, Menu, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSystem } from '../context/SystemContext';

export default function AdminNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { adminLogout } = useAuth();
  const { notifications } = useSystem();
  const [showNotif, setShowNotif] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { path: '/admin', label: 'الرئيسية', icon: LayoutDashboard },
    { path: '/admin/bookings', label: 'الحجوزات', icon: CalendarCheck },
    { path: '/admin/barbers', label: 'الحلاقين', icon: Users },
    { path: '/admin/services', label: 'الخدمات', icon: Scissors },
    { path: '/admin/customers', label: 'العملاء', icon: UserCheck },
    { path: '/admin/reports', label: 'التقارير', icon: TrendingUp },
  ];

  const handleLogout = () => { adminLogout(); navigate('/admin/login'); };

  const navLinkStyle = (path) => {
    const active = location.pathname === path;
    return {
      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
      padding: '0.5rem 0.875rem',
      borderRadius: 10,
      fontSize: '0.78rem', fontWeight: 700,
      whiteSpace: 'nowrap', textDecoration: 'none',
      background: active ? 'linear-gradient(135deg, #f5df99, var(--accent))' : 'transparent',
      color: active ? '#000' : 'rgba(100,116,139,1)',
      transition: 'all 0.2s ease',
      flexShrink: 0,
    };
  };

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 40,
      background: 'rgba(8, 9, 12, 0.96)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 1rem' }}>

        {/* Top Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg, #f5df99, var(--accent))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(194, 112, 61, 0.2)'
            }}>
              <ShieldAlert style={{ width: 18, height: 18, color: '#000' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#f8fafc' }}>لوحة التحكم</span>
                <span style={{
                  fontSize: '0.58rem', padding: '0.15rem 0.5rem',
                  borderRadius: 99, fontWeight: 700,
                  background: 'rgba(94, 140, 97, 0.1)', border: '1px solid rgba(94, 140, 97, 0.25)', color: '#10b981'
                }}>مباشر</span>
              </div>
              <span style={{ fontSize: '0.62rem', color: 'rgba(194, 112, 61, 0.8)' }}>صالون الفخامة</span>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            
            {/* Bell */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => { setShowNotif(!showNotif); setMobileMenuOpen(false); }}
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: '#94a3b8', position: 'relative'
                }}
              >
                <Bell style={{ width: 16, height: 16 }} />
                {notifications.length > 0 && (
                  <span style={{
                    position: 'absolute', top: -5, right: -5,
                    width: 17, height: 17, borderRadius: '50%',
                    background: 'var(--accent)', color: '#000',
                    fontSize: '0.58rem', fontWeight: 900,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {Math.min(notifications.length, 9)}
                  </span>
                )}
              </button>

              {showNotif && (
                <div
                  className="admin-notif-dropdown"
                  style={{
                  position: 'absolute', left: 0, top: 'calc(100% + 0.5rem)',
                  width: 300, maxWidth: 'calc(100vw - 2rem)',
                  background: '#12141c', border: '1px solid rgba(194, 112, 61, 0.15)',
                  borderRadius: 16, boxShadow: '0 16px 40px rgba(0,0,0,0.5)', zIndex: 200, overflow: 'hidden'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.875rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#f8fafc' }}>التنبيهات ({notifications.length})</span>
                    <button onClick={() => setShowNotif(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit' }}>إغلاق</button>
                  </div>
                  <div style={{ maxHeight: 260, overflowY: 'auto', padding: '0.5rem' }}>
                    {notifications.length === 0 ? (
                      <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.78rem', padding: '1.5rem 0' }}>لا توجد تنبيهات</p>
                    ) : notifications.slice(0, 8).map(n => (
                      <div key={n.id} style={{ padding: '0.75rem', borderRadius: 10, marginBottom: '0.4rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--accent)' }}>{n.title}</span>
                          <span style={{ fontSize: '0.62rem', color: '#64748b' }} dir="ltr">{new Date(n.timestamp).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{n.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Logout — text on desktop, icon on mobile */}
            <button
              onClick={handleLogout}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.5rem 0.875rem',
                background: 'rgba(181, 80, 74, 0.07)',
                border: '1px solid rgba(181, 80, 74, 0.15)',
                borderRadius: 10,
                color: '#f43f5e', fontSize: '0.78rem', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <LogOut style={{ width: 14, height: 14 }} />
              <span className="logout-label">خروج</span>
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => { setMobileMenuOpen(!mobileMenuOpen); setShowNotif(false); }}
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                display: 'none', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#94a3b8',
              }}
              className="admin-hamburger"
            >
              {mobileMenuOpen ? <X style={{ width: 17, height: 17 }} /> : <Menu style={{ width: 17, height: 17 }} />}
            </button>
          </div>
        </div>

        {/* DESKTOP NAV TABS */}
        <nav
          style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', overflowX: 'auto', paddingBottom: '0.6rem', scrollbarWidth: 'none' }}
          className="admin-desktop-nav"
        >
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <Link key={item.path} to={item.path} style={navLinkStyle(item.path)}>
                <Icon style={{ width: 14, height: 14, color: location.pathname === item.path ? '#000' : 'var(--accent)', flexShrink: 0 }} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* MOBILE DROPDOWN MENU */}
        {mobileMenuOpen && (
          <nav style={{
            borderTop: '1px solid rgba(255,255,255,0.05)',
            padding: '0.75rem 0 1rem',
            display: 'flex', flexDirection: 'column', gap: '0.3rem'
          }} className="admin-mobile-nav">
            {navItems.map(item => {
              const Icon = item.icon;
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.75rem 0.875rem',
                    borderRadius: 12, textDecoration: 'none',
                    background: active ? 'rgba(194, 112, 61, 0.08)' : 'transparent',
                    color: active ? 'var(--accent)' : '#94a3b8',
                    fontSize: '0.875rem', fontWeight: 700,
                    borderRight: active ? '3px solid var(--accent)' : '3px solid transparent',
                  }}
                >
                  <Icon style={{ width: 18, height: 18, flexShrink: 0 }} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
}
