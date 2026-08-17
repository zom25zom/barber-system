import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, DollarSign, CalendarCheck, Clock, 
  Sparkles, Bell, ArrowLeft, CheckCircle2
} from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import { useAuth } from '../../context/AuthContext';
import { useAdminNotifications } from '../../context/AdminNotificationContext';
import AdminNavbar from '../../components/AdminNavbar';
import { formatTimeTo12h, getLocalDateStr } from '../../services/api';

function StatCard({ title, value, subtitle, icon: Icon, color }) {
  const colorMap = {
    emerald: 'stat-icon-box-emerald',
    amber: 'stat-icon-box-amber',
    blue: 'stat-icon-box-blue',
    purple: 'stat-icon-box-purple',
  };
  return (
    <div className="stat-card">
      <div className={`stat-icon-box ${colorMap[color] || 'stat-icon-box-amber'}`}>
        <Icon style={{ width: 24, height: 24 }} />
      </div>
      <div>
        <p className="stat-title">{title}</p>
        <p className="stat-value">{value}</p>
        <p className="stat-subtitle">{subtitle}</p>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { bookings, barbers, getQueueState, updateBookingStatus } = useSystem();
  const { notifications } = useAdminNotifications();

  if (!isAdmin) {
    navigate('/admin/login');
    return null;
  }

  const todayStr = getLocalDateStr();
  const todayBookings = bookings.filter(b => b.date === todayStr);
  const completedToday = todayBookings.filter(b => b.status === 'Completed');
  const pendingToday = todayBookings.filter(b => b.status === 'Pending' || b.status === 'Rescheduled');
  const todayRevenue = completedToday.reduce((sum, b) => sum + (b.totalPrice || 0), 0);

  return (
    <div className="min-h-screen pb-24">
      <AdminNavbar />

      <main className="admin-main">
        {/* Page Header */}
        <div className="page-header">
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
              أهلاً بك، مالك الصالون
            </span>
            <h2 className="page-title">
              <Sparkles style={{ width: 28, height: 28, color: 'var(--accent)' }} />
              ملخص اليوم والطوابير المباشرة
            </h2>
          </div>
          <button onClick={() => navigate('/admin/bookings')} className="gold-gradient-bg">
            <span>إدارة الحجوزات</span>
            <ArrowLeft style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
          <StatCard
            title="إيرادات اليوم (المكتملة)"
            value={`${todayRevenue} JOD`}
            subtitle={`${completedToday.length} حجز مكتمل`}
            icon={DollarSign}
            color="emerald"
          />
          <StatCard
            title="إجمالي حجوزات اليوم"
            value={todayBookings.length}
            subtitle="حجوزات مسجلة لليوم"
            icon={CalendarCheck}
            color="amber"
          />
          <StatCard
            title="الطابور النشط حالياً"
            value={pendingToday.length}
            subtitle="عملاء في الانتظار"
            icon={Clock}
            color="blue"
          />
          <StatCard
            title="طاقم الحلاقين"
            value={barbers.length}
            subtitle="حلاقين في الصالون"
            icon={Users}
            color="purple"
          />
        </div>

        {/* Barber Queue Section */}
        <div style={{ marginBottom: '3rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock style={{ width: 20, height: 20, color: 'var(--accent)' }} />
            الطوابير المباشرة لكل حلاق
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.2rem 0.7rem', background: 'rgba(94, 140, 97, 0.1)', border: '1px solid rgba(94, 140, 97, 0.2)', borderRadius: '99px', fontSize: '0.65rem', fontWeight: 700, color: 'var(--success)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />
              مباشر
            </span>
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.25rem' }}>
            {barbers.map((barber) => {
              const qState = getQueueState(barber.id);
              const currentClient = qState.items && qState.items[0];

              return (
                <div key={barber.id} style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-xl)',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}>
                  {/* Barber Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                    <img
                      src={barber.avatar}
                      alt={barber.name}
                      style={{ width: 56, height: 56, borderRadius: 14, objectFit: 'cover', border: '2px solid rgba(194, 112, 61, 0.3)', flexShrink: 0 }}
                    />
                    <div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.15rem' }}>{barber.name}</h4>
                      <p style={{ fontSize: '0.72rem', color: 'var(--accent)' }}>{barber.title}</p>
                    </div>
                  </div>

                  {/* Queue Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div style={{ background: 'rgba(194, 112, 61, 0.05)', border: '1px solid rgba(194, 112, 61, 0.1)', borderRadius: 12, padding: '0.875rem', textAlign: 'center' }}>
                      <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>في الانتظار</p>
                      <p style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--accent)' }}>{qState.queueCount}</p>
                    </div>
                    <div style={{ background: 'rgba(94, 140, 97, 0.05)', border: '1px solid rgba(94, 140, 97, 0.1)', borderRadius: 12, padding: '0.875rem', textAlign: 'center' }}>
                      <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>دقيقة انتظار</p>
                      <p style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--success)' }}>{qState.totalWaitMinutes}</p>
                    </div>
                  </div>

                  {/* Current Client */}
                  <div>
                    <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '0.6rem' }}>العميل الحالي على الكرسي</p>
                    {currentClient ? (
                      <div style={{
                        padding: '1rem',
                        background: 'rgba(194, 112, 61, 0.06)',
                        border: '1px solid rgba(194, 112, 61, 0.2)',
                        borderRadius: 12
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-primary)' }}>{currentClient.customerName}</span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)' }} dir="ltr">{formatTimeTo12h(currentClient.time)}</span>
                        </div>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.875rem' }} dir="ltr">{currentClient.customerPhone}</p>
                        <button
                          onClick={() => updateBookingStatus(currentClient.id, 'Completed')}
                          style={{
                            width: '100%', padding: '0.625rem',
                            background: 'rgba(94, 140, 97, 0.85)',
                            border: 'none', borderRadius: 10,
                            color: '#fff', fontWeight: 800, fontSize: '0.78rem',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                            transition: 'var(--transition)'
                          }}
                        >
                          <CheckCircle2 style={{ width: 14, height: 14 }} />
                          تعيين كـ مكتمل
                        </button>
                      </div>
                    ) : (
                      <div style={{
                        padding: '1rem',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--border)',
                        borderRadius: 12,
                        textAlign: 'center',
                        fontSize: '0.78rem',
                        color: 'var(--text-muted)'
                      }}>
                        الكرسي شاغر حالياً
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Notifications Feed */}
        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell style={{ width: 18, height: 18, color: 'var(--accent)' }} />
            التنبيهات المباشرة الأخيرة
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {notifications.slice(0, 5).length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '2rem 0' }}>لا توجد تنبيهات جديدة</p>
            ) : (
              notifications.slice(0, 5).map((n) => (
                <div key={n.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '1rem 1.25rem',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  fontSize: '0.8rem'
                }}>
                  <div>
                    <h5 style={{ fontWeight: 800, color: 'var(--accent)', marginBottom: '0.2rem', fontSize: '0.78rem' }}>{n.title}</h5>
                    <p style={{ color: 'var(--text-muted)' }}>{n.message}</p>
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', marginRight: '1rem' }} dir="ltr">
                    {new Date(n.timestamp).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
