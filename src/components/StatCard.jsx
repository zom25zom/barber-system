import React from 'react';

export default function StatCard({ title, value, subtitle, icon: Icon, color = 'amber' }) {
  const colorMap = {
    amber: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    blue: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    purple: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
  };

  return (
    <div className="glass-card p-6 flex items-start justify-between">
      <div>
        <span className="text-xs font-semibold text-slate-400 block mb-1">{title}</span>
        <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">{value}</div>
        {subtitle && <span className="text-[11px] text-slate-400 mt-1 block">{subtitle}</span>}
      </div>
      <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${colorMap[color] || colorMap.amber}`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  );
}
