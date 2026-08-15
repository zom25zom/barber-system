import React from 'react';
import { Scissors, DollarSign, Users, Clock, TrendingUp } from 'lucide-react';
import { useSystem } from '../context/SystemContext';
import { formatTimeTo12h } from '../services/api';

export default function FinancialCharts({ dateRange }) {
  const { bookings, barbers, services } = useSystem();

  // Filter completed bookings for revenue
  const completedBookings = bookings.filter(b => b.status === 'Completed');

  // Total Revenue
  const totalRevenue = completedBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);

  // Most requested services
  const serviceStats = services.map(srv => {
    const srvBookings = bookings.filter(b => b.serviceIds && b.serviceIds.includes(srv.id));
    const totalCount = srvBookings.length;
    const totalRev = srvBookings.filter(b => b.status === 'Completed').reduce((sum, b) => sum + srv.price, 0);
    return {
      ...srv,
      count: totalCount,
      revenue: totalRev
    };
  }).sort((a, b) => b.count - a.count);

  const maxServiceCount = Math.max(...serviceStats.map(s => s.count), 1);

  // Per-barber performance
  const barberStats = barbers.map(barber => {
    const bBookings = bookings.filter(b => b.barberId === barber.id);
    const completed = bBookings.filter(b => b.status === 'Completed');
    const rev = completed.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
    return {
      barber,
      totalCustomers: completed.length,
      revenue: rev
    };
  });

  // Peak hours distribution (14:00 - 24:00)
  const hoursMap = {
    '14:00': 0, '15:00': 0, '16:00': 0, '17:00': 0,
    '18:00': 0, '19:00': 0, '20:00': 0, '21:00': 0,
    '22:00': 0, '23:00': 0, '00:00': 0
  };

  bookings.forEach(b => {
    if (b.time) {
      const hourKey = b.time.split(':')[0] + ':00';
      if (hoursMap[hourKey] !== undefined) {
        hoursMap[hourKey]++;
      } else {
        hoursMap['18:00']++;
      }
    }
  });

  const maxHourValue = Math.max(...Object.values(hoursMap), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Overview Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1.25rem'
      }}>
        {/* Total Revenue */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid rgba(94, 140, 97, 0.2)',
          borderRadius: 'var(--radius-xl)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '120px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>إجمالي الإيرادات (المكتملة)</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(94, 140, 97, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign style={{ width: 18, height: 18, color: 'var(--success)' }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--success)', display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
              {totalRevenue}
              <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>JOD</span>
            </div>
            <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>يحسب بناءً على الخدمات المنفذة والمكتملة فقط</p>
          </div>
        </div>

        {/* Completed Services */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid rgba(194, 112, 61, 0.2)',
          borderRadius: 'var(--radius-xl)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '120px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>عدد الخدمات المكتملة</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(194, 112, 61, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Scissors style={{ width: 18, height: 18, color: 'var(--accent)' }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--accent)', display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
              {completedBookings.length}
              <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>حجز مكتمل</span>
            </div>
            <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>إجمالي العملاء المخدومين بنجاح</p>
          </div>
        </div>

        {/* Average Bill */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: 'var(--radius-xl)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '120px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>متوسط قيمة الحجز</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp style={{ width: 18, height: 18, color: '#B4A08C' }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#B4A08C', display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
              {completedBookings.length ? Math.round(totalRevenue / completedBookings.length) : 0}
              <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>JOD</span>
            </div>
            <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>معدل الفاتورة للعميل الواحد</p>
          </div>
        </div>
      </div>

      {/* Grid: Most Requested Services & Barber Performance */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1.5rem'
      }}>
        {/* Most Requested Services */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{
            fontSize: '1rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1.5rem',
            paddingBottom: '0.75rem',
            borderBottom: '1px solid var(--border)'
          }}>
            <Scissors style={{ width: 18, height: 18, color: 'var(--accent)' }} />
            الخدمات الأكثر طلباً (الأعلى رواجاً)
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {serviceStats.map(srv => {
              const percentage = Math.round((srv.count / maxServiceCount) * 100);
              return (
                <div key={srv.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{srv.name}</span>
                    <span style={{ fontWeight: 800, color: 'var(--accent)' }}>
                      {srv.count} طلبات ({srv.revenue} JOD)
                    </span>
                  </div>
                  <div style={{
                    height: 8,
                    width: '100%',
                    background: 'var(--surface-raised)',
                    borderRadius: 99,
                    overflow: 'hidden',
                    position: 'relative'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${percentage}%`,
                      background: 'linear-gradient(135deg, var(--accent-hover), var(--accent))',
                      borderRadius: 99,
                      transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Barber Performance Comparison */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{
            fontSize: '1rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1.5rem',
            paddingBottom: '0.75rem',
            borderBottom: '1px solid var(--border)'
          }}>
            <Users style={{ width: 18, height: 18, color: 'var(--accent)' }} />
            أداء الحلاقين وتوزيع العوائد
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {barberStats.map(({ barber, totalCustomers, revenue }) => (
              <div key={barber.id} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.875rem 1rem',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border)',
                borderRadius: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <img
                    src={barber.avatar}
                    alt={barber.name}
                    style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', border: '1px solid rgba(194, 112, 61, 0.25)' }}
                  />
                  <div>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.15rem' }}>{barber.name}</h4>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{barber.title}</p>
                  </div>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 900, color: 'var(--success)' }}>{revenue} JOD</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{totalCustomers} عميل مكتمل</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Peak Hours Analysis Bar Chart */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{
          fontSize: '1rem',
          fontWeight: 800,
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '1.5rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid var(--border)'
        }}>
          <Clock style={{ width: 18, height: 18, color: 'var(--accent)' }} />
          تحليل أوقات الذروة والإقبال (حسب الساعات)
        </h3>

        <div style={{
          display: 'flex',
          alignItems: 'end',
          justifyContent: 'space-between',
          gap: '0.5rem',
          paddingTop: '1.5rem',
          minHeight: '160px',
          overflowX: 'auto',
          paddingBottom: '0.5rem'
        }} className="scrollbar-none">
          {Object.entries(hoursMap).map(([hour, count]) => {
            const heightPercent = Math.round((count / maxHourValue) * 100);
            return (
              <div key={hour} style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem',
                minWidth: '35px'
              }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--accent)' }}>
                  {count > 0 ? count : ''}
                </span>
                <div style={{
                  width: '100%',
                  height: '100px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px 6px 0 0',
                  display: 'flex',
                  alignItems: 'end',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: '100%',
                    height: `${Math.max(heightPercent, count > 0 ? 10 : 0)}%`,
                    background: 'linear-gradient(to top, var(--accent), var(--accent))',
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.5s ease'
                  }} />
                </div>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)' }} dir="ltr">{formatTimeTo12h(hour)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
