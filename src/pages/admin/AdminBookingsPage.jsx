import React, { useState } from 'react';
import { CalendarCheck, Plus, Search, CheckCircle2, XCircle } from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import { getArabicStatus, formatTimeTo12h, getLocalDateStr } from '../../services/api';
import AdminNavbar from '../../components/AdminNavbar';

export default function AdminBookingsPage() {
  const { bookings, barbers, services, updateBookingStatus, createBooking } = useSystem();

  const [filterBarber, setFilterBarber] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newBarberId, setNewBarberId] = useState(barbers[0]?.id || 'b1');
  const [newServiceIds, setNewServiceIds] = useState([]);
  const [newTime, setNewTime] = useState('17:00');

  const filteredBookings = bookings.filter(b => {
    if (filterBarber !== 'ALL' && b.barberId !== filterBarber) return false;
    if (filterStatus !== 'ALL' && b.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!b.customerName.toLowerCase().includes(q) && !b.customerPhone.includes(q) && !b.id.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const handleCreateManual = async (e) => {
    e.preventDefault();
    const selServices = services.filter(s => newServiceIds.includes(s.id));
    const totalPrice = selServices.reduce((sum, s) => sum + s.price, 0);
    const totalDuration = selServices.reduce((sum, s) => sum + s.duration, 0);
    try {
      await createBooking({
        customerName: newCustName,
        customerPhone: newCustPhone,
        barberId: newBarberId,
        serviceIds: newServiceIds.length ? newServiceIds : [services[0]?.id],
        totalPrice: totalPrice || 0,
        totalDuration: totalDuration || 30,
        date: getLocalDateStr(),
        time: newTime
      });
      setShowAddModal(false);
      setNewCustName('');
      setNewCustPhone('');
      setNewServiceIds([]);
    } catch (err) {
      console.error("Failed to create manual booking:", err);
    }
  };

  const getBadgeClass = (status) => {
    if (status === 'Completed') return 'badge-completed';
    if (status === 'Pending' || status === 'Rescheduled') return 'badge-pending';
    return 'badge-cancelled';
  };

  return (
    <div className="min-h-screen pb-24">
      <AdminNavbar />

      <main className="admin-main">
        {/* Header */}
        <div className="page-header">
          <div>
            <h2 className="page-title">
              <CalendarCheck style={{ width: 26, height: 26, color: 'var(--accent)' }} />
              إدارة جميع الحجوزات
            </h2>
            <p className="page-subtitle">عرض الحجوزات، الفلترة، التعديل، وإضافة حجوزات يدوية</p>
          </div>
          <button onClick={() => setShowAddModal(true)} className="gold-gradient-bg">
            <Plus style={{ width: 16, height: 16 }} />
            <span>إضافة حجز يدوي</span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div className="form-field">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Search style={{ width: 12, height: 12 }} />
              بحث بالاسم أو الهاتف
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ابحث..."
            />
          </div>
          <div className="form-field">
            <label className="form-label">تصفية حسب الحلاق</label>
            <select value={filterBarber} onChange={e => setFilterBarber(e.target.value)}>
              <option value="ALL">جميع الحلاقين</option>
              {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">تصفية حسب الحالة</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="ALL">جميع الحالات</option>
              <option value="Pending">في الانتظار</option>
              <option value="Completed">مكتمل</option>
              <option value="CancelledByCustomer">ملغى من العميل</option>
              <option value="CancelledByOwner">ملغى من المالك</option>
              <option value="Rescheduled">تم تعديل الموعد</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>رقم الحجز</th>
                <th>العميل والجوال</th>
                <th>الحلاق</th>
                <th>التاريخ والوقت</th>
                <th>المبلغ</th>
                <th>الحالة</th>
                <th style={{ textAlign: 'center' }}>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    لا توجد حجوزات مطابقة للفلتر
                  </td>
                </tr>
              ) : (
                filteredBookings.map((b) => {
                  const barber = barbers.find(item => item.id === b.barberId);
                  const barberName = barber ? barber.name : 'غير محدد';
                  return (
                    <tr key={b.id}>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent)', fontSize: '0.72rem' }} dir="ltr">#{b.id}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{b.customerName}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }} dir="ltr">{b.customerPhone}</div>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{barberName}</td>
                      <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '0.75rem' }} dir="ltr">{b.date}<br />{formatTimeTo12h(b.time)}</td>
                      <td>
                        <span style={{ fontWeight: 800, color: 'var(--success)' }}>{b.totalPrice} JOD</span>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{b.totalDuration} دقيقة</div>
                      </td>
                      <td>
                        <span className={getBadgeClass(b.status)}>{getArabicStatus(b.status)}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                          {(b.status === 'Pending' || b.status === 'Rescheduled') && (
                            <button
                              onClick={() => updateBookingStatus(b.id, 'Completed')}
                              title="تعيين كـ مكتمل"
                              className="icon-btn icon-btn-emerald"
                            >
                              <CheckCircle2 style={{ width: 15, height: 15 }} />
                            </button>
                          )}
                          {b.status !== 'CancelledByOwner' && b.status !== 'CancelledByCustomer' && b.status !== 'Completed' && (
                            <button
                              onClick={() => updateBookingStatus(b.id, 'CancelledByOwner')}
                              title="إلغاء من قبل الصالون"
                              className="icon-btn icon-btn-rose"
                            >
                              <XCircle style={{ width: 15, height: 15 }} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: '1rem', fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'left' }}>
          {filteredBookings.length} نتيجة
        </div>
      </main>

      {/* Manual Booking Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3 className="modal-title">إضافة حجز يدوي مباشر</h3>
            <form onSubmit={handleCreateManual} className="form-group">
              <div className="form-field">
                <label className="form-label">اسم العميل</label>
                <input type="text" required value={newCustName} onChange={e => setNewCustName(e.target.value)} placeholder="أدخل الاسم" />
              </div>
              <div className="form-field">
                <label className="form-label">رقم الهاتف</label>
                <input type="tel" required dir="ltr" value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)} placeholder="+966XXXXXXXXX" style={{ textAlign: 'right' }} />
              </div>
              <div className="form-field">
                <label className="form-label">الحلاق</label>
                <select value={newBarberId} onChange={e => setNewBarberId(e.target.value)}>
                  {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">التوقيت</label>
                <input type="time" required value={newTime} onChange={e => setNewTime(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
                <button type="submit" className="gold-gradient-bg flex-1" style={{ padding: '0.875rem' }}>
                  حفظ وتأكيد الحجز
                </button>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary" style={{ padding: '0.875rem 1.25rem' }}>
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
