import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Scissors, Clock, ArrowLeft, Check } from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import CustomerNavbar from '../../components/CustomerNavbar';

export default function ServiceSelectPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const barberId = searchParams.get('barberId') || 'any';

  const { services, barbers } = useSystem();
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [activeCategory, setActiveCategory] = useState('الكل');

  const barber = barbers.find(b => b.id === barberId);
  const barberName = barber ? barber.name : 'أي حلاق متاح';

  const categories = ['الكل', ...new Set(services.map(s => s.category))];

  const filteredServices = activeCategory === 'الكل'
    ? services
    : services.filter(s => s.category === activeCategory);

  const toggleService = (id) => {
    if (selectedServiceIds.includes(id)) {
      setSelectedServiceIds(selectedServiceIds.filter(i => i !== id));
    } else {
      setSelectedServiceIds([...selectedServiceIds, id]);
    }
  };

  const selectedServices = services.filter(s => selectedServiceIds.includes(s.id));
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);

  const handleNext = () => {
    if (selectedServiceIds.length === 0) return;
    const servicesParam = selectedServiceIds.join(',');
    navigate(`/booking/time?barberId=${barberId}&services=${servicesParam}`);
  };

  return (
    <div className="pb-24 min-h-screen">
      <CustomerNavbar />

      <main className="main-container pt-8">
        {/* Header Breadcrumb */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b">
          <div>
            <span className="text-xs text-amber-400 font-bold block mb-1">
              الحلاق المختار: {barberName}
            </span>
            <h2 className="step-number">
              <Scissors className="logo-icon text-amber-400" />
              الخطوة 2: تحديد الخدمات
            </h2>
          </div>
          <button
            onClick={() => navigate('/')}
            className="btn-secondary py-2 px-4 text-xs"
          >
            تغيير الحلاق
          </button>
        </div>

        {/* Category Filters Container */}
        <div className="category-filters-container">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`category-pill ${activeCategory === cat ? 'category-pill-active' : ''}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Services Grid */}
        <div className="services-grid">
          {filteredServices.map((service) => {
            const isSelected = selectedServiceIds.includes(service.id);
            return (
              <div
                key={service.id}
                onClick={() => toggleService(service.id)}
                className={`service-card ${isSelected ? 'service-card-selected' : ''}`}
              >
                <div>
                  <div className="service-top-meta">
                    <span className="service-category-badge">
                      {service.category}
                    </span>
                    <div className="service-checkbox">
                      {isSelected && <Check style={{ width: 12, height: 12 }} />}
                    </div>
                  </div>

                  <h3 className="service-name">{service.name}</h3>
                  <p className="service-desc">{service.description}</p>
                </div>

                <div className="service-footer">
                  <span className="service-duration">
                    <Clock style={{ width: 14, height: 14 }} />
                    {service.duration} دقيقة
                  </span>
                  <span className="service-price">
                    {service.price} JOD
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Floating Bottom Action Bar */}
      {selectedServiceIds.length > 0 && (
        <div className="floating-action-bar">
          <div className="main-container action-bar-wrapper">
            <div className="action-bar-stats">
              <div className="stat-group">
                <span className="stat-label">الخدمات المختارة ({selectedServiceIds.length})</span>
                <span className="stat-val-small">الوقت المتوقع: {totalDuration} دقيقة</span>
              </div>
              <div className="stat-group">
                <span className="stat-label">المبلغ الإجمالي</span>
                <span className="stat-val-large">{totalPrice} JOD</span>
              </div>
            </div>

            <button
              onClick={handleNext}
              className="gold-gradient-bg"
            >
              <span>متابعة لاختيار الوقت</span>
              <ArrowLeft className="logo-icon" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
