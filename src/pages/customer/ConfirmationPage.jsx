import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Users, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import { useAuth } from '../../context/AuthContext';
import CustomerNavbar from '../../components/CustomerNavbar';
import OtpModal from '../../components/OtpModal';

import { formatTimeTo12h, getLocalDateStr } from '../../services/api';

export default function ConfirmationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const barberId = searchParams.get('barberId') || '';
  const serviceIdsStr = searchParams.get('services') || '';
  const date = searchParams.get('date') || getLocalDateStr();
  const time = searchParams.get('time') || '17:00';
  const serviceIds = serviceIdsStr.split(',').filter(Boolean);

  const { barbers, services, getQueueState, createBooking } = useSystem();
  const { customer } = useAuth();
  const [showOtpModal, setShowOtpModal] = useState(false);

  const barber = barbers.find(b => b.id === barberId);
  const barberName = barber ? barber.name : 'غير محدد';
  const selectedServices = services.filter(s => serviceIds.includes(s.id));
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);

  const currentQueue = getQueueState(barberId);
  const peopleAhead = currentQueue.queueCount;
  const estimatedWaitMinutes = currentQueue.totalWaitMinutes;

  const processBooking = async (custData) => {
    try {
      const newBooking = await createBooking({
        customerName: custData.name,
        customerPhone: custData.phone,
        barberId,
        serviceIds,
        totalPrice,
        totalDuration,
        date,
        time,
        notes: ''
      });
      if (newBooking && newBooking.id) {
        navigate(`/queue/${newBooking.id}`);
      } else {
        console.error("Booking created, but ID is undefined:", newBooking);
      }
    } catch (err) {
      console.error("Failed to process booking:", err);
    }
  };

  return (
    <div className="min-h-screen pb-24">
      <CustomerNavbar />

      <main className="main-container pt-8">
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <span style={{
              display: 'inline-block',
              padding: '0.4rem 1rem',
              background: 'rgba(194, 112, 61, 0.08)',
              border: '1px solid rgba(194, 112, 61, 0.2)',
              borderRadius: '99px',
              color: 'var(--accent)',
              fontSize: '0.75rem',
              fontWeight: 700,
              marginBottom: '1rem'
            }}>
              الخطوة الأخيرة: مراجعة وتأكيد الحجز
            </span>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.3 }}>ملخص الحجز وحالة الطابور</h2>
          </div>

          {/* QUEUE INFO BOX */}
          <div style={{
            background: 'linear-gradient(135deg, var(--surface) 0%, rgba(194, 112, 61, 0.03) 100%)',
            border: '1px solid rgba(194, 112, 61, 0.25)',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
            marginBottom: '2rem',
          }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users style={{ width: 16, height: 16 }} />
              حالة طابور الحلاق الآن ({barberName})
            </h3>

            {/* Queue stats — horizontal cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {/* People ahead */}
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--accent)', lineHeight: 1 }}>
                  {peopleAhead}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px', fontWeight: 600 }}>عدد من قبلك</div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                  {peopleAhead === 0 ? 'أنت التالي!' : `${peopleAhead} عملاء`}
                </div>
              </div>

              {/* Wait time */}
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--success)', lineHeight: 1 }}>
                  {estimatedWaitMinutes}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px', fontWeight: 600 }}>وقت الانتظار</div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--success)', marginTop: '4px' }}>
                  {estimatedWaitMinutes === 0 ? 'فوري' : 'دقيقة'}
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '1.25rem', background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: 10, lineHeight: 1.7 }}>
              💡 يُحسب الوقت التقديري بجمع مدد خدمات العملاء الذين يسبقونك في طابور هذا الحلاق.
            </p>
          </div>

          {/* Booking Summary */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
            marginBottom: '2rem',
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
              تفاصيل الحجز
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>الحلاق</span>
                <span style={{ fontWeight: 800, color: 'var(--accent)' }}>{barberName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>التاريخ والوقت</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }} dir="ltr">{date} | {formatTimeTo12h(time)}</span>
              </div>
            </div>

            <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.75rem' }}>الخدمات المختارة</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {selectedServices.map(s => (
                  <div key={s.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '0.75rem 1rem',
                    fontSize: '0.8rem'
                  }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{s.name} <span style={{ color: 'var(--text-muted)' }}>({s.duration} د)</span></span>
                    <span style={{ fontWeight: 800, color: 'var(--success)' }}>{s.price} JOD</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{
              marginTop: '1.25rem', paddingTop: '1.25rem',
              borderTop: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.9rem' }}>الإجمالي (نقداً بالمحل)</span>
              <span style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--success)' }}>{totalPrice} <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-muted)' }}>JOD</span></span>
            </div>
          </div>

          {/* Confirm Button */}
          <button
            onClick={() => customer ? processBooking(customer) : setShowOtpModal(true)}
            className="gold-gradient-bg"
            style={{ width: '100%', padding: '1.15rem', fontSize: '1rem' }}
          >
            <CheckCircle2 className="logo-icon" />
            <span>تأكيد الحجز والانضمام للطابور المباشر</span>
          </button>
        </div>
      </main>

      <OtpModal
        isOpen={showOtpModal}
        onClose={() => setShowOtpModal(false)}
        onSuccess={(session) => { setShowOtpModal(false); processBooking(session); }}
      />
    </div>
  );
}
