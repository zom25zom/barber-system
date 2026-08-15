import React, { useState } from 'react';
import { Users, Plus, Edit3, Trash2, Clock, Star } from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import AdminNavbar from '../../components/AdminNavbar';
import { formatTimeTo12h } from '../../services/api';

export default function AdminBarbersPage() {
  const { barbers, saveBarber, deleteBarber } = useSystem();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBarber, setEditingBarber] = useState(null);

  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [avatar, setAvatar] = useState('');
  const [workStart, setWorkStart] = useState('14:00');
  const [workEnd, setWorkEnd] = useState('23:00');
  const [isOff, setIsOff] = useState(false);

  const openAddModal = () => {
    setEditingBarber(null);
    setName(''); setTitle(''); setAvatar('https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80');
    setWorkStart('14:00'); setWorkEnd('23:00'); setIsOff(false);
    setModalOpen(true);
  };

  const openEditModal = (barber) => {
    setEditingBarber(barber);
    setName(barber.name); setTitle(barber.title); setAvatar(barber.avatar);
    setWorkStart(barber.workStart || '14:00'); setWorkEnd(barber.workEnd || '23:00'); setIsOff(!!barber.isOff);
    setModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    saveBarber({ id: editingBarber ? editingBarber.id : null, name, title, avatar, workStart, workEnd, isOff, workDays: [0, 1, 2, 3, 4, 6] });
    setModalOpen(false);
  };

  const handleDelete = (id) => {
    if (window.confirm('هل أنت متاكد من حذف هذا الحلاق من الطاقم؟')) deleteBarber(id);
  };

  return (
    <div className="min-h-screen pb-24">
      <AdminNavbar />

      <main className="admin-main">
        <div className="page-header">
          <div>
            <h2 className="page-title">
              <Users style={{ width: 26, height: 26, color: 'var(--accent)' }} />
              إدارة طاقم الحلاقين
            </h2>
            <p className="page-subtitle">تعديل بيانات الحلاقين، أوقات الدوام، وحالة التوفر</p>
          </div>
          <button onClick={openAddModal} className="gold-gradient-bg">
            <Plus style={{ width: 16, height: 16 }} />
            <span>إضافة حلاق جديد</span>
          </button>
        </div>

        {/* Barbers Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {barbers.map((barber) => (
            <div key={barber.id} className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <img
                    src={barber.avatar}
                    alt={barber.name}
                    style={{ width: 64, height: 64, borderRadius: 16, objectFit: 'cover', border: '2px solid rgba(194, 112, 61, 0.3)', flexShrink: 0 }}
                  />
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{barber.name}</h3>
                    <p style={{ fontSize: '0.72rem', color: 'var(--accent)' }}>{barber.title}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.3rem', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      <Star style={{ width: 11, height: 11, color: 'var(--accent)', fill: 'var(--accent)' }} />
                      <span>{barber.rating || '4.9'}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => openEditModal(barber)} className="icon-btn icon-btn-blue" title="تعديل">
                    <Edit3 style={{ width: 14, height: 14 }} />
                  </button>
                  <button onClick={() => handleDelete(barber.id)} className="icon-btn icon-btn-rose" title="حذف">
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              </div>

              {/* Schedule */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 12, padding: '0.875rem', fontSize: '0.78rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Clock style={{ width: 13, height: 13, color: 'var(--accent)' }} />
                    ساعات الدوام
                  </span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }} dir="ltr">
                    {formatTimeTo12h(barber.workStart)} — {formatTimeTo12h(barber.workEnd)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.6rem', borderTop: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>الحالة اليوم</span>
                  <span style={{ fontWeight: 800, color: barber.isOff ? 'var(--danger)' : 'var(--success)' }}>
                    {barber.isOff ? 'في إجازة' : 'متاح للعمل'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Modal */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3 className="modal-title">{editingBarber ? 'تعديل بيانات الحلاق' : 'إضافة حلاق جديد'}</h3>
            <form onSubmit={handleSubmit} className="form-group">
              <div className="form-field">
                <label className="form-label">اسم الحلاق</label>
                <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="الاسم الكامل" />
              </div>
              <div className="form-field">
                <label className="form-label">المسمى الوظيفي / الخبرة</label>
                <input type="text" required value={title} onChange={e => setTitle(e.target.value)} placeholder="حلاق خبير — ١٠ سنوات خبرة" />
              </div>
              <div className="form-field">
                <label className="form-label">رابط الصورة الشخصية</label>
                <input type="url" value={avatar} onChange={e => setAvatar(e.target.value)} dir="ltr" style={{ textAlign: 'left' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-field">
                  <label className="form-label">بداية الدوام</label>
                  <input type="time" value={workStart} onChange={e => setWorkStart(e.target.value)} />
                </div>
                <div className="form-field">
                  <label className="form-label">نهاية الدوام</label>
                  <input type="time" value={workEnd} onChange={e => setWorkEnd(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingTop: '0.25rem' }}>
                <input
                  type="checkbox"
                  id="isOff"
                  checked={isOff}
                  onChange={e => setIsOff(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer', flex: 'none' }}
                />
                <label htmlFor="isOff" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, cursor: 'pointer' }}>
                  الحلاق في إجازة اليوم (غير متاح للحجز)
                </label>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
                <button type="submit" className="gold-gradient-bg flex-1" style={{ padding: '0.875rem' }}>حفظ البيانات</button>
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary" style={{ padding: '0.875rem 1.25rem' }}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
