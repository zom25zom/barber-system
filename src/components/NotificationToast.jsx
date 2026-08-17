import React, { useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useAdminNotifications } from '../context/AdminNotificationContext';

export default function NotificationToast() {
  const { toastNotif, setToastNotif } = useAdminNotifications();

  useEffect(() => {
    if (toastNotif) {
      const timer = setTimeout(() => setToastNotif(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toastNotif, setToastNotif]);

  if (!toastNotif) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '1.5rem',
      left: '1.5rem',
      zIndex: 100,
      maxWidth: 380,
      width: 'calc(100vw - 3rem)',
      background: 'var(--surface)',
      border: '1px solid rgba(194, 112, 61, 0.25)',
      borderRadius: 'var(--radius-xl)',
      padding: '1rem 1.25rem',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.875rem',
      boxShadow: '0 16px 48px rgba(0, 0, 0, 0.5)',
      animation: 'fadeInUp 0.35s ease both'
    }}>
      <div style={{
        width: 40, height: 40,
        borderRadius: 12,
        background: 'rgba(194, 112, 61, 0.1)',
        border: '1px solid rgba(194, 112, 61, 0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0
      }}>
        <Sparkles style={{ width: 18, height: 18, color: 'var(--accent)' }} />
      </div>
      <div style={{ flex: 1 }}>
        <h4 style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--accent)', marginBottom: '0.2rem' }}>{toastNotif.title}</h4>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>{toastNotif.message}</p>
      </div>
      <button
        onClick={() => setToastNotif(null)}
        style={{
          background: 'none', border: 'none',
          color: 'var(--text-muted)', cursor: 'pointer',
          padding: '0.25rem',
          flexShrink: 0,
          transition: 'var(--transition)'
        }}
      >
        <X style={{ width: 16, height: 16 }} />
      </button>
    </div>
  );
}
