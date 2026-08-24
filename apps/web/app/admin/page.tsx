"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getOwnerToken } from "@/lib/auth";
import type { OwnerStats } from "@/lib/types";

export default function AdminDashboard() {
  const token = getOwnerToken();
  const [stats, setStats] = useState<OwnerStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    apiFetch<OwnerStats>("/api/owner/stats", { token })
      .then(setStats)
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <p className="text-zinc-400">جاري تحميل الإحصائيات…</p>;
  if (!stats) return <p className="text-red-400">تعذر تحميل الإحصائيات.</p>;

  const totalBookings = stats.totals.reduce((s, t) => s + t.count, 0);
  const confirmed = stats.totals.find((t) => t.status === "confirmed")?.count ?? 0;
  const cancelled = stats.totals.find((t) => t.status === "cancelled")?.count ?? 0;
  const noShow = stats.totals.find((t) => t.status === "no_show")?.count ?? 0;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-zinc-100">لوحة التحكم</h1>

      {/* ── stat cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="حجوزات الأسبوع" value={stats.week.bookings} color="amber" />
        <StatCard
          label="الإيرادات المتوقعة"
          value={`${stats.week.expected_revenue} د.أ`}
          color="emerald"
        />
        <StatCard label="إجمالي الحجوزات" value={totalBookings} color="blue" />
        <StatCard label="لم يحضر" value={noShow} color="red" />
      </div>

      {/* ── daily chart (text-based) ── */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-4 text-lg font-bold text-zinc-100">حجوزات الأيام السبعة الأخيرة</h2>
        {stats.daily.length === 0 ? (
          <p className="text-sm text-zinc-500">لا توجد بيانات.</p>
        ) : (
          <div className="space-y-2">
            {stats.daily.map((d) => {
              const max = Math.max(...stats.daily.map((x) => x.count), 1);
              const pct = Math.round((d.count / max) * 100);
              return (
                <div key={d.date} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-sm text-zinc-400">{d.date}</span>
                  <div className="flex-1">
                    <div
                      className="h-6 rounded bg-gradient-to-l from-amber-500 to-amber-600 transition-all"
                      style={{ width: `${Math.max(pct, 4)}%` }}
                    />
                  </div>
                  <span className="w-8 text-left text-sm font-bold text-amber-400">{d.count}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── top services ── */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-4 text-lg font-bold text-zinc-100">أكثر الخدمات طلباً</h2>
          {stats.top_services.length === 0 ? (
            <p className="text-sm text-zinc-500">لا توجد بيانات.</p>
          ) : (
            <div className="space-y-2">
              {stats.top_services.map((s, i) => (
                <div
                  key={s.name}
                  className="flex items-center justify-between rounded-lg bg-zinc-800/50 px-4 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/15 text-xs font-bold text-amber-400">
                      {i + 1}
                    </span>
                    <span className="text-sm text-zinc-200">{s.name}</span>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-amber-400">{s.count} مرة</p>
                    <p className="text-xs text-zinc-500">{s.revenue} د.أ</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── no-show leaderboard ── */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-4 text-lg font-bold text-zinc-100">سجل عدم الحضور</h2>
          {stats.no_shows.length === 0 ? (
            <p className="text-sm text-zinc-500">لا يوجد سجل عدم حضور.</p>
          ) : (
            <div className="space-y-2">
              {stats.no_shows.map((n, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-zinc-800/50 px-4 py-2.5"
                >
                  <div>
                    <p className="text-sm text-zinc-200">{n.customer_name}</p>
                    <p className="text-xs text-zinc-500">مع {n.barber_name}</p>
                  </div>
                  <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-bold text-red-400">
                    {n.count} مرة
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── booking status breakdown ── */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-4 text-lg font-bold text-zinc-100">توزيع حالات الحجوزات</h2>
        <div className="flex flex-wrap gap-4">
          {stats.totals.map((t) => (
            <div key={t.status} className="rounded-lg bg-zinc-800/50 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-zinc-100">{t.count}</p>
              <p className="text-xs text-zinc-400">
                {
                  {
                    confirmed: "مؤكد",
                    cancelled: "ملغي",
                    completed: "مكتمل",
                    no_show: "لم يحضر",
                  }[t.status] ?? t.status
                }
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: "amber" | "emerald" | "blue" | "red";
}) {
  const bg: Record<string, string> = {
    amber: "border-amber-500/30 bg-amber-500/5",
    emerald: "border-emerald-500/30 bg-emerald-500/5",
    blue: "border-blue-500/30 bg-blue-500/5",
    red: "border-red-500/30 bg-red-500/5",
  };
  const text: Record<string, string> = {
    amber: "text-amber-400",
    emerald: "text-emerald-400",
    blue: "text-blue-400",
    red: "text-red-400",
  };
  return (
    <div className={`rounded-xl border p-5 ${bg[color]}`}>
      <p className="text-sm text-zinc-400">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${text[color]}`}>{value}</p>
    </div>
  );
}
