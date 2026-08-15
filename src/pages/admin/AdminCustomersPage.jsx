import React, { useState } from 'react';
import { UserCheck, Search } from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import AdminNavbar from '../../components/AdminNavbar';
import { getArabicStatus } from '../../services/api';

export default function AdminCustomersPage() {
  const { bookings } = useSystem();
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Group bookings by customer phone
  const customerMap = {};
  bookings.forEach(b => {
    if (!b.customerPhone) return;
    if (!customerMap[b.customerPhone]) {
      customerMap[b.customerPhone] = { name: b.customerName, phone: b.customerPhone, totalVisits: 0, completedVisits: 0, totalSpend: 0, history: [] };
    }
    customerMap[b.customerPhone].totalVisits++;
    if (b.status === 'Completed') {
      customerMap[b.customerPhone].completedVisits++;
      customerMap[b.customerPhone].totalSpend += (b.totalPrice || 0);
    }
    customerMap[b.customerPhone].history.push(b);
  });

  const customersList = Object.values(customerMap).filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q);
  });

  return (
    <div className="min-h-screen pb-24">
      <AdminNavbar />

      <main className="admin-main">
        <div className="page-header">
          <div>
            <h2 className="page-title">
              <UserCheck style={{ width: 26, height: 26, color: 'var(--accent)' }} />
              سجل العملاء وإحصائيات الزيارات
            </h2>
            <p className="page-subtitle">تتبع العملاء الدائمين وتاريخ زياراتهم وإجمالي مبالغهم</p>
          </div>
          <div style={{ position: 'relative', width: 280 }}>
            <Search style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="البحث باسم العميل أو جواله"
              style={{ paddingRight: '2.5rem' }}
            />
          </div>
        </div>

        {customersList.length === 0 ? (
          <div className="glass-panel" style={{ padding: '4rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>لا يوجد عملاء مطابقون للبحث</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {customersList.map((cust) => (
              <div key={cust.phone} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{cust.name}</h3>
                    <p style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--accent)' }} dir="ltr">{cust.phone}</p>
                  </div>
                  {cust.completedVisits > 2 && (
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 800, padding: '0.25rem 0.6rem',
                      borderRadius: '99px',
                      background: 'rgba(168, 85, 247, 0.1)',
                      border: '1px solid rgba(168, 85, 247, 0.2)',
                      color: '#a855f7'
                    }}>
                      VIP
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>إجمالي الزيارات</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>{cust.totalVisits}</p>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>إجمالي الإنفاق</p>
                    <p style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--success)', lineHeight: 1 }}>{cust.totalSpend}</p>
                    <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>JOD</p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedCustomer(cust)}
                  className="btn-secondary"
                  style={{ width: '100%', padding: '0.75rem', fontSize: '0.78rem' }}
                >
                  عرض سجل الزيارات ({cust.history.length})
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* History Modal */}
      {selectedCustomer && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '520px' }}>
            <div style={{ marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                سجل الزيارات: {selectedCustomer.name}
              </h3>
              <p style={{ fontSize: '0.72rem', color: 'var(--accent)', fontFamily: 'monospace' }} dir="ltr">{selectedCustomer.phone}</p>
            </div>

            <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingLeft: '0.25rem' }}>
              {selectedCustomer.history.map(b => (
                <div key={b.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.875rem 1rem',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  fontSize: '0.78rem'
                }}>
                  <div>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '0.15rem' }} dir="ltr">#{b.id}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{b.totalPrice} JOD — {getArabicStatus(b.status)}</span>
                  </div>
                  <span style={{ fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 700, fontSize: '0.75rem' }} dir="ltr">{b.date}</span>
                </div>
              ))}
            </div>

            <button onClick={() => setSelectedCustomer(null)} className="btn-secondary" style={{ width: '100%', padding: '0.875rem', marginTop: '1.25rem' }}>
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
