import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, Users, CheckCircle2, XCircle, RotateCcw, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useSystem } from '../../context/SystemContext';
import CustomerNavbar from '../../components/CustomerNavbar';
import { formatTimeTo12h } from '../../services/api';

export default function LiveQueueTrackerPage() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { bookings, barbers, services, getQueueState, updateBookingStatus, rescheduleBooking } = useSystem();

  const [rescheduleModal, setRescheduleModal] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('18:00');

  const booking = bookings.find(b => b.id === bookingId);
  const confettiFired = useRef(false);

  useEffect(() => {
    if (booking && booking.status === 'Pending') {
      const qState = getQueueState(booking.barberId, booking.id);
      if (qState.isNext) {
        if (!confettiFired.current) {
          try {
            confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
            confettiFired.current = true;
          } catch (e) {}
        }
      } else {
        confettiFired.current = false;
      }
    }
  }, [booking, getQueueState]);

  if (!booking) {
    return (
      <div className="min-h-screen">
        <CustomerNavbar />
        <div style={{ padding: '5rem 0', textAlign: 'center', maxWidth: '400px', margin: '0 auto' }}>
          <AlertCircle style={{ width: 64, height: 64, color: 'var(--danger)', margin: '0 auto 1.5rem' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>الحجز غير موجود</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.85rem' }}>رقم الحجز غير صحيح أو تم حذفه</p>
          <button onClick={() => navigate('/')} className="gold-gradient-bg">
            العودة للصفحة الرئيسية
          </button>
        </div>
      </div>
    );
  }

  const barber = barbers.find(b => b.id === booking.barberId);
  const barberName = barber ? barber.name : 'غير محدد';
  const selectedServices = services.filter(s => booking.serviceIds && booking.serviceIds.includes(s.id));
  const queueState = getQueueState(booking.barberId, booking.id);

  const isCancelled = booking.status === 'CancelledByCustomer' || booking.status === 'CancelledByOwner';
  const isCompleted = booking.status === 'Completed';
  const isPending = booking.status === 'Pending' || booking.status === 'Rescheduled';

  const handleCancel = () => {
    if (window.confirm('هل أنت متأكد من إلغاء الحجز؟')) {
      updateBookingStatus(booking.id, 'CancelledByCustomer');
    }
  };

  const handleReschedule = (e) => {
    e.preventDefault();
    if (!newDate || !newTime) return;
    rescheduleBooking(booking.id, newDate, newTime);
    setRescheduleModal(false);
  };

  return (
    <div className="min-h-screen pb-24">
      <CustomerNavbar />

      <main className="main-container pt-8">
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.4rem 1rem',
              background: 'rgba(94, 140, 97, 0.08)',
              border: '1px solid rgba(94, 140, 97, 0.2)',
              borderRadius: '99px',
              color: 'var(--success)',
              fontSize: '0.75rem', fontWeight: 700, marginBottom: '1rem',
              animation: 'pulse 2s infinite'
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />
              تتبع الطابور المباشر — يتحدث تلقائياً
            </div>
            <h2 style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>بطاقة طابورك</h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>رقم الحجز: <span dir="ltr" style={{ fontWeight: 700, color: 'var(--accent)' }}>{booking.id}</span></p>
          </div>

          {/* Status Alerts */}
          {isCancelled && (
            <div style={{
              marginBottom: '1.5rem',
              padding: '2rem',
              background: 'rgba(181, 80, 74, 0.05)',
              border: '1px solid rgba(181, 80, 74, 0.2)',
              borderRadius: 'var(--radius-xl)',
              textAlign: 'center'
            }}>
              <XCircle style={{ width: 48, height: 48, color: 'var(--danger)', margin: '0 auto 1rem' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--danger)', marginBottom: '0.5rem' }}>تم إلغاء الحجز</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>يمكنك إجراء حجز جديد في أي وقت</p>
              <button onClick={() => navigate('/')} className="gold-gradient-bg">حجز جديد</button>
            </div>
          )}

          {isCompleted && (
            <div style={{
              marginBottom: '1.5rem',
              padding: '2rem',
              background: 'rgba(94, 140, 97, 0.05)',
              border: '1px solid rgba(94, 140, 97, 0.2)',
              borderRadius: 'var(--radius-xl)',
              textAlign: 'center'
            }}>
              <CheckCircle2 style={{ width: 48, height: 48, color: 'var(--success)', margin: '0 auto 1rem' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--success)', marginBottom: '0.5rem' }}>تمت الخدمة بنجاح ✨</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>شكراً لزيارتك صالون الفخامة. ننتظر عودتك!</p>
            </div>
          )}

          {/* Live Queue Position */}
          {isPending && (
            <div style={{
              marginBottom: '1.5rem',
              background: 'linear-gradient(135deg, var(--surface) 0%, rgba(194, 112, 61, 0.02) 100%)',
              border: '1px solid rgba(194, 112, 61, 0.25)',
              borderRadius: 'var(--radius-xl)',
              padding: '2rem',
              textAlign: 'center'
            }}>
              {queueState.isNext ? (
                <div style={{
                  padding: '1.5rem',
                  background: 'rgba(94, 140, 97, 0.08)',
                  border: '1px solid rgba(94, 140, 97, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '1.5rem'
                }}>
                  <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--success)' }}>🎉 دورك الآن!</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>توجه لكرسي الحلاق {barberName}</p>
                </div>
              ) : (
                <div style={{ marginBottom: '1.5rem' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>موقعك في الطابور</p>
                  <div style={{ fontSize: '4rem', fontWeight: 900, background: 'linear-gradient(135deg, #fff 0%, var(--accent-hover) 60%, var(--accent) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>
                    {queueState.position}
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    {queueState.peopleAhead} أشخاص قبلك
                  </p>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>وقت انتظار تقديري</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--success)' }}>{queueState.estimatedWaitMinutes} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>دقيقة</span></p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>توقيت موعدك</p>
                  <p style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-primary)' }} dir="ltr">{formatTimeTo12h(booking.time)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Booking Detail Card */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            padding: '1.75rem',
            marginBottom: '1.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>بيانات الحجز</h3>
              <span className={`badge-${booking.status === 'Pending' || booking.status === 'Rescheduled' ? 'pending' : booking.status === 'Completed' ? 'completed' : 'cancelled'}`}>
                {booking.status === 'Pending' ? 'في الانتظار' : booking.status === 'Completed' ? 'مكتمل' : booking.status === 'Rescheduled' ? 'مُعدَّل' : 'ملغى'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.8rem', marginBottom: '1rem' }}>
              <div>
                <p style={{ color: 'var(--text-muted)', marginBottom: '0.2rem' }}>اسم العميل</p>
                <p style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{booking.customerName}</p>
              </div>
              <div>
                <p style={{ color: 'var(--text-muted)', marginBottom: '0.2rem' }}>رقم الجوال</p>
                <p style={{ fontWeight: 700, color: 'var(--accent)' }} dir="ltr">{booking.customerPhone}</p>
              </div>
              <div>
                <p style={{ color: 'var(--text-muted)', marginBottom: '0.2rem' }}>الحلاق</p>
                <p style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{barberName}</p>
              </div>
              <div>
                <p style={{ color: 'var(--text-muted)', marginBottom: '0.2rem' }}>إجمالي الدفع</p>
                <p style={{ fontWeight: 800, color: 'var(--success)' }}>{booking.totalPrice} JOD</p>
              </div>
            </div>

            <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>الخدمات المحجوزة</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {selectedServices.map(s => (
                  <span key={s.id} style={{
                    fontSize: '0.72rem', padding: '0.25rem 0.65rem',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border)',
                    borderRadius: '99px',
                    color: 'var(--text-muted)',
                    fontWeight: 600
                  }}>
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {isPending && (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setRescheduleModal(true)}
                className="btn-secondary flex-1"
              >
                <RotateCcw style={{ width: 16, height: 16 }} />
                تعديل الموعد
              </button>
              <button
                onClick={handleCancel}
                style={{
                  flex: 1, padding: '0.85rem 1.25rem',
                  background: 'rgba(181, 80, 74, 0.06)',
                  border: '1px solid rgba(181, 80, 74, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--danger)',
                  fontWeight: 700, fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
                }}
              >
                <XCircle style={{ width: 16, height: 16 }} />
                إلغاء الحجز
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Reschedule Modal */}
      {rescheduleModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div style={{ width: '100%', maxWidth: '420px', background: 'var(--surface)', border: '1px solid rgba(194, 112, 61, 0.2)', borderRadius: 'var(--radius-xl)', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>تعديل موعد الحجز</h3>
            <form onSubmit={handleReschedule} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>التاريخ الجديد</label>
                <input type="date" required value={newDate} onChange={e => setNewDate(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>التوقيت الجديد</label>
                <select value={newTime} onChange={e => setNewTime(e.target.value)}>
                  {['14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="submit" className="gold-gradient-bg flex-1">حفظ الموعد</button>
                <button type="button" onClick={() => setRescheduleModal(false)} className="btn-secondary" style={{ padding: '0.85rem 1.25rem' }}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
