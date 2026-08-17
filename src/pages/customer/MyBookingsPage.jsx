import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, Calendar, ArrowLeft, UserCheck } from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import { useAuth } from '../../context/AuthContext';
import CustomerNavbar from '../../components/CustomerNavbar';
import { formatTimeTo12h } from '../../services/api';

function getStatusLabel(status) {
  switch(status) {
    case 'Pending': return 'في الانتظار';
    case 'Completed': return 'مكتمل';
    case 'CancelledByCustomer': case 'CancelledByOwner': return 'ملغى';
    case 'Rescheduled': return 'مُعدَّل';
    default: return status;
  }
}

function getBadgeClass(status) {
  if (status === 'Completed') return 'badge-completed';
  if (status === 'Pending' || status === 'Rescheduled') return 'badge-pending';
  return 'badge-cancelled';
}

export default function MyBookingsPage() {
  const navigate = useNavigate();
  const { bookings, barbers } = useSystem();
  const { customer } = useAuth();

  if (!customer) {
    return (
      <div className="min-h-screen">
        <CustomerNavbar />
        <div style={{ padding: '5rem 0', textAlign: 'center', maxWidth: '400px', margin: '0 auto' }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(194, 112, 61, 0.08)', border: '1px solid rgba(194, 112, 61, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <UserCheck style={{ width: 32, height: 32, color: 'var(--accent)' }} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>قم بإجراء حجز أولاً</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.85rem', lineHeight: 1.7 }}>
            يتم حفظ سجل حجوزاتك تلقائياً برقم جوالك دون الحاجة لحساب معقد.
          </p>
          <button onClick={() => navigate('/')} className="gold-gradient-bg">
            احجز أول موعد الآن
          </button>
        </div>
      </div>
    );
  }

  const customerBookings = bookings.filter(b => b.customerPhone === customer.phone);

  return (
    <div className="min-h-screen pb-24">
      <CustomerNavbar />

      <main className="main-container pt-8">
        {/* Page Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2.5rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border)' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
              مرحباً، {customer.name}
            </span>
            <h2 className="step-number">
              <Clock className="logo-icon text-amber-400" />
              سجل حجوزاتي
            </h2>
          </div>
          <button onClick={() => navigate('/')} className="gold-gradient-bg" style={{ padding: '0.75rem 1.5rem', fontSize: '0.8rem' }}>
            <span>حجز جديد</span>
            <ArrowLeft className="logo-icon" />
          </button>
        </div>

        {customerBookings.length === 0 ? (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            padding: '4rem',
            textAlign: 'center'
          }}>
            <Calendar style={{ width: 48, height: 48, color: 'var(--text-muted)', margin: '0 auto 1rem' }} />
            <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>لا توجد حجوزات مسجلة بهذا الرقم بعد</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
            {customerBookings.map((b) => {
              const barber = barbers.find(item => item.id === b.barberId);
              const barberName = barber ? barber.name : 'غير محدد';
              const isPending = b.status === 'Pending' || b.status === 'Rescheduled';
              return (
                <div key={b.id} style={{
                  background: 'var(--surface)',
                  border: `1px solid ${isPending ? 'rgba(194, 112, 61, 0.2)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-xl)',
                  padding: '1.5rem',
                  transition: 'var(--transition)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }} dir="ltr">#{b.id}</span>
                    <span className={getBadgeClass(b.status)}>{getStatusLabel(b.status)}</span>
                  </div>

                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                    {barberName}
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    <span dir="ltr">{b.date}</span> — الساعة {formatTimeTo12h(b.time)} — {b.totalPrice} JOD
                  </div>

                  <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-start' }}>
                    <Link
                      to={`/queue/${b.id}`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                        padding: '0.6rem 1rem',
                        background: 'rgba(194, 112, 61, 0.06)',
                        border: '1px solid rgba(194, 112, 61, 0.15)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--accent)',
                        fontSize: '0.78rem', fontWeight: 700
                      }}
                    >
                      <span>متابعة الطابور</span>
                      <ArrowLeft style={{ width: 14, height: 14 }} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
