import React, { useState } from 'react';
import { Scissors, Plus, Edit3, Trash2, Clock } from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import AdminNavbar from '../../components/AdminNavbar';

export default function AdminServicesPage() {
  const { services, saveService, deleteService } = useSystem();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);

  const [name, setName] = useState('');
  const [price, setPrice] = useState(75);
  const [duration, setDuration] = useState(30);
  const [category, setCategory] = useState('شعر');
  const [description, setDescription] = useState('');

  const openAddModal = () => {
    setEditingService(null); setName(''); setPrice(75); setDuration(30); setCategory('شعر'); setDescription('');
    setModalOpen(true);
  };

  const openEditModal = (service) => {
    setEditingService(service); setName(service.name); setPrice(service.price);
    setDuration(service.duration); setCategory(service.category); setDescription(service.description);
    setModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    saveService({ id: editingService ? editingService.id : null, name, price: Number(price), duration: Number(duration), category, description });
    setModalOpen(false);
  };

  const handleDelete = (id) => {
    if (window.confirm('هل أنت متاكد من حذف هذه الخدمة من قائمة الأسعار؟')) deleteService(id);
  };

  const categoryColors = {
    'شعر': 'rgba(194, 112, 61, 0.12)',
    'لحية': 'rgba(59, 130, 246, 0.12)',
    'باقات': 'rgba(168, 85, 247, 0.12)',
    'بشرة': 'rgba(94, 140, 97, 0.12)',
    'صبغة': 'rgba(181, 80, 74, 0.12)',
  };
  const categoryText = {
    'شعر': 'var(--accent)',
    'لحية': '#B4A08C',
    'باقات': '#a855f7',
    'بشرة': 'var(--success)',
    'صبغة': 'var(--danger)',
  };

  return (
    <div className="min-h-screen pb-24">
      <AdminNavbar />

      <main className="admin-main">
        <div className="page-header">
          <div>
            <h2 className="page-title">
              <Scissors style={{ width: 26, height: 26, color: 'var(--accent)' }} />
              إدارة قائمة الخدمات والأسعار
            </h2>
            <p className="page-subtitle">تعديل الخدمات المتاحة، أسعارها، ومدة كل خدمة لحساب الطابور</p>
          </div>
          <button onClick={openAddModal} className="gold-gradient-bg">
            <Plus style={{ width: 16, height: 16 }} />
            <span>إضافة خدمة جديدة</span>
          </button>
        </div>

        {/* Services Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {services.map((service) => (
            <div key={service.id} style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-xl)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'var(--transition)'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '0.2rem 0.7rem',
                    borderRadius: '99px',
                    background: categoryColors[service.category] || 'rgba(194, 112, 61, 0.1)',
                    color: categoryText[service.category] || 'var(--accent)',
                    border: `1px solid ${categoryText[service.category] || 'var(--accent)'}33`
                  }}>
                    {service.category}
                  </span>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button onClick={() => openEditModal(service)} className="icon-btn icon-btn-blue">
                      <Edit3 style={{ width: 13, height: 13 }} />
                    </button>
                    <button onClick={() => handleDelete(service.id)} className="icon-btn icon-btn-rose">
                      <Trash2 style={{ width: 13, height: 13 }} />
                    </button>
                  </div>
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{service.name}</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: '1.25rem' }}>{service.description}</p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Clock style={{ width: 14, height: 14, color: 'var(--accent)' }} />
                  {service.duration} دقيقة
                </span>
                <span style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--success)' }}>{service.price} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>JOD</span></span>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Modal */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '480px' }}>
            <h3 className="modal-title">{editingService ? 'تعديل الخدمة' : 'إضافة خدمة جديدة'}</h3>
            <form onSubmit={handleSubmit} className="form-group">
              <div className="form-field">
                <label className="form-label">اسم الخدمة</label>
                <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="قص شعر احترافي" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-field">
                  <label className="form-label">السعر (JOD)</label>
                  <input type="number" required min={1} value={price} onChange={e => setPrice(e.target.value)} />
                </div>
                <div className="form-field">
                  <label className="form-label">المدة (دقائق)</label>
                  <input type="number" required min={5} step={5} value={duration} onChange={e => setDuration(e.target.value)} />
                </div>
              </div>
              <div className="form-field">
                <label className="form-label">التصنيف</label>
                <select value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="شعر">شعر</option>
                  <option value="لحية">لحية</option>
                  <option value="باقات">باقات VIP</option>
                  <option value="بشرة">بشرة</option>
                  <option value="صبغة">صبغة</option>
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">الوصف التفصيلي</label>
                <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="وصف مختصر للخدمة..." />
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
