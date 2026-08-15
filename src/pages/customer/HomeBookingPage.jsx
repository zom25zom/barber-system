import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Scissors, Star, Clock, Users, Sparkles, ArrowLeft } from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import CustomerNavbar from '../../components/CustomerNavbar';

export default function HomeBookingPage() {
  const navigate = useNavigate();
  const { barbers, getQueueState } = useSystem();
  const [selectedBarberId, setSelectedBarberId] = useState(null);

  const handleSelect = (barberId) => {
    setSelectedBarberId(barberId);
    navigate(`/booking/services?barberId=${barberId}`);
  };

  return (
    <div className="pb-16 min-h-screen">
      <CustomerNavbar />

      {/* Hero Banner Section */}
      <section className="hero-section">
        <div className="main-container">
          <span className="hero-badge">
            <Sparkles style={{ width: 14, height: 14, color: 'var(--accent)' }} />
            نظام حجز ذكي مباشر وفوري
          </span>
          <h1 className="hero-title">
            احجز نوبتك في <span>صالون الفخامة</span>
          </h1>
          <p className="hero-desc">
            تجنب الانتظار الطويل. اختر مصفف شعرك المفضل وتتبع دورك في الطابور بدقة تامة وبشكل فوري مباشر.
          </p>
        </div>
      </section>

      {/* Main Grid: Barber Selection */}
      <main className="main-container pt-8">
        <div className="step-title-area">
          <h2 className="step-number">
            <User className="logo-icon text-amber-400" />
            الخطوة 1: اختيار الحلاق
          </h2>
          <p className="step-desc">يمكنك اختيار مصفف معين أو اختيار أول حلاق متاح لبدء أسرع</p>
        </div>

        {/* Barbers Grid */}
        <div className="barber-cards-grid">
          {/* Any Available Barber Option */}
          <div
            onClick={() => handleSelect('any')}
            className={`barber-card any-barber-card ${selectedBarberId === 'any' ? 'barber-card-selected' : ''}`}
          >
            <div>
              <div className="any-barber-icon-box">
                <Scissors className="any-barber-icon" />
              </div>
              <h3 className="barber-name">أول حلاق متاح ⚡</h3>
              <p className="barber-title">الحجز السريع لتوفير الوقت</p>
              
              <div className="barber-meta-item">
                <Clock className="barber-meta-icon" />
                <span>يبدأ العمل مباشرة عند توفر أول كرسي</span>
              </div>
            </div>

            <button className="btn-barber-select">
              <span>اختيار أول حلاق متاح</span>
              <ArrowLeft className="logo-icon" />
            </button>
          </div>

          {/* Specific Barbers */}
          {barbers.map((barber) => {
            const queueState = getQueueState(barber.id);
            const isSelected = selectedBarberId === barber.id;
            return (
              <div
                key={barber.id}
                onClick={() => handleSelect(barber.id)}
                className={`barber-card ${isSelected ? 'barber-card-selected' : ''}`}
              >
                <div>
                  <div className="barber-avatar-box">
                    <img
                      src={barber.avatar}
                      alt={barber.name}
                      className="barber-img"
                    />
                    <div className="barber-rating">
                      <Star className="logo-icon" style={{ fill: 'var(--accent)', width: 10, height: 10 }} />
                      <span>{barber.rating || '4.9'}</span>
                    </div>
                  </div>

                  <h3 className="barber-name">{barber.name}</h3>
                  <p className="barber-title">{barber.title}</p>
                  
                  <div className="barber-meta-item">
                    <Clock className="barber-meta-icon" />
                    <span>ساعات العمل: {barber.workStart} - {barber.workEnd}</span>
                  </div>

                  <div className="barber-queue-box">
                    <span className="barber-queue-label flex items-center gap-1">
                      <Users style={{ width: 14, height: 14 }} />
                      في الانتظار حالياً:
                    </span>
                    <span className="barber-queue-val">{queueState.queueCount} عملاء</span>
                  </div>
                </div>

                <button className="btn-barber-select">
                  <span>احجز عند {barber.name.split(' ')[0]}</span>
                  <ArrowLeft className="logo-icon" />
                </button>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
