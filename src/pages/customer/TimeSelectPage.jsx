import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar, Clock, ArrowLeft } from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import CustomerNavbar from '../../components/CustomerNavbar';
import { formatTimeTo12h, getLocalDateStr } from '../../services/api';

export default function TimeSelectPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const barberId = searchParams.get('barberId') || 'any';
  const serviceIdsStr = searchParams.get('services') || '';

  const { barbers } = useSystem();
  const barber = barbers.find(b => b.id === barberId);

  const todayStr = getLocalDateStr();
  const tomorrowObj = new Date();
  tomorrowObj.setDate(tomorrowObj.getDate() + 1);
  const tomorrowStr = getLocalDateStr(tomorrowObj);

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedTime, setSelectedTime] = useState('17:00');

  const timeSlots = [
    '14:00','14:30','15:00','15:30','16:00','16:30',
    '17:00','17:30','18:00','18:30','19:00','19:30',
    '20:00','20:30','21:00','21:30','22:00','22:30','23:00'
  ];

  const handleNext = () => {
    navigate(`/booking/confirm?barberId=${barberId}&services=${serviceIdsStr}&date=${selectedDate}&time=${selectedTime}`);
  };

  return (
    <div className="min-h-screen pb-24">
      <CustomerNavbar />

      <main className="main-container pt-8">
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border)' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
              الحلاق: {barber ? barber.name : 'أي حلاق متاح'}
            </span>
            <h2 className="step-number">
              <Calendar className="logo-icon text-amber-400" />
              الخطوة 3: الموعد والوقت
            </h2>
          </div>
          <button onClick={() => navigate(-1)} className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}>
            رجوع
          </button>
        </div>

        {/* Date Selection */}
        <div style={{ marginBottom: '2.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>اختر اليوم</h3>
          <div className="date-grid">
            <div
              onClick={() => setSelectedDate(todayStr)}
              className={`date-card ${selectedDate === todayStr ? 'date-card-selected' : ''}`}
            >
              <div className="date-card-label">اليوم</div>
              <div className="date-card-value" dir="ltr">{todayStr}</div>
            </div>
            <div
              onClick={() => setSelectedDate(tomorrowStr)}
              className={`date-card ${selectedDate === tomorrowStr ? 'date-card-selected' : ''}`}
            >
              <div className="date-card-label">غداً</div>
              <div className="date-card-value" dir="ltr">{tomorrowStr}</div>
            </div>
          </div>
        </div>

        {/* Time Slot Picker */}
        <div style={{ marginBottom: '3rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock style={{ width: 16, height: 16, color: 'var(--accent)' }} />
            اختر التوقيت
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>التوقيتات المتاحة ضمن ساعات عمل الحلاق</p>
          <div className="time-slots-grid">
            {timeSlots.map((slot) => (
              <button
                key={slot}
                onClick={() => setSelectedTime(slot)}
                className={`time-slot-btn ${selectedTime === slot ? 'time-slot-btn-selected' : ''}`}
                dir="ltr"
              >
                {formatTimeTo12h(slot)}
              </button>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={handleNext} className="gold-gradient-bg" style={{ fontSize: '0.95rem', padding: '1rem 2.5rem' }}>
            <span>متابعة لمراجعة الحجز</span>
            <ArrowLeft className="logo-icon" />
          </button>
        </div>
      </main>
    </div>
  );
}
