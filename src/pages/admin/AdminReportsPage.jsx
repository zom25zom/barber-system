import React, { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import AdminNavbar from '../../components/AdminNavbar';
import FinancialCharts from '../../components/FinancialCharts';

export default function AdminReportsPage() {
  const [dateRange, setDateRange] = useState('MONTH');

  return (
    <div className="min-h-screen pb-24">
      <AdminNavbar />

      <main className="admin-main">
        <div className="page-header">
          <div>
            <h2 className="page-title">
              <TrendingUp style={{ width: 26, height: 26, color: 'var(--accent)' }} />
              التقارير المالية والتحليلات
            </h2>
            <p className="page-subtitle">الأرباح الإجمالية، أداء الحلاقين، الخدمات الأكثر طلباً وأوقات الذروة</p>
          </div>

          {/* Date Range Switcher */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            background: 'var(--surface-raised)',
            border: '1px solid var(--border)',
            padding: '0.35rem',
            borderRadius: 'var(--radius-md)'
          }}>
            {[['TODAY', 'اليوم'], ['WEEK', 'الأسبوع'], ['MONTH', 'الشهر']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setDateRange(val)}
                style={{
                  padding: '0.6rem 1.1rem',
                  borderRadius: 10,
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'var(--transition)',
                  background: dateRange === val
                    ? 'linear-gradient(135deg, var(--accent-hover), var(--accent))'
                    : 'transparent',
                  color: dateRange === val ? '#000' : 'var(--text-muted)',
                  boxShadow: dateRange === val ? '0 2px 8px rgba(194, 112, 61, 0.2)' : 'none'
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <FinancialCharts dateRange={dateRange} />
      </main>
    </div>
  );
}
