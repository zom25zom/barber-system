"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getOwnerToken } from "@/lib/auth";
import type { OwnerStats } from "@/lib/types";

const STATUS_LABELS: Record<string, string> = {
  confirmed: "مؤكد",
  cancelled: "ملغي",
  completed: "مكتمل",
  no_show: "لم يحضر",
};

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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-9 w-40 animate-pulse rounded-xl bg-[var(--bs-surface)]" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-[var(--bs-surface)]/70" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-[var(--bs-surface)]/70" />
      </div>
    );
  }

  if (!stats) return <p className="rounded-2xl border border-[var(--bs-error)]/40 bg-[var(--bs-error-soft)] px-5 py-4 text-[var(--bs-error)]">تعذر تحميل الإحصائيات.</p>;

  const totalBookings = stats.totals.reduce((s, t) => s + t.count, 0);
  const confirmed = stats.totals.find((t) => t.status === "confirmed")?.count ?? 0;
  const noShow = stats.totals.find((t) => t.status === "no_show")?.count ?? 0;
  const maxDaily = Math.max(...stats.daily.map((d) => d.count), 1);
  const maxServiceCount = Math.max(...stats.top_services.map((s) => s.count), 1);

  return (
    <div className="space-y-8">
      {/* ══════════ Header ══════════ */}
      <header>
        <h1 className="text-3xl font-black text-[var(--bs-text)]">لوحة التحكم</h1>
        <p className="mt-1.5 text-sm text-[var(--bs-text-muted)]">نظرة سريعة على أداء صالونك اليوم</p>
      </header>

      {/* ══════════ Key Stats (prominent) ══════════ */}
      <section aria-label="الإحصائيات الرئيسية" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="حجوزات الأسبوع"
          value={stats.week.bookings}
          sub="خلال آخر 7 أيام"
          color="amber"
          icon={<path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />}
        />
        <StatCard
          label="الإيرادات المتوقعة"
          value={`${stats.week.expected_revenue} د.أ`}
          sub="من حجوزات الأسبوع"
          color="emerald"
          icon={<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />}
        />
        <StatCard
          label="إجمالي الحجوزات"
          value={totalBookings}
          sub={`${confirmed} مؤكد`}
          color="blue"
          icon={<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4" /></>}
        />
        <StatCard
          label="لم يحضر"
          value={noShow}
          sub="يتطلب المتابعة"
          color="red"
          icon={<path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />}
        />
      </section>

      {/* ═════════─ Daily Bookings Chart ══════════ */}
      <section className="rounded-2xl border border-[var(--bs-border)] bg-[var(--bs-surface)]/60 p-6 shadow-lg">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--bs-text)]">حجوزات الأيام السبعة الأخيرة</h2>
            <p className="mt-0.5 text-xs text-[var(--bs-text-faint)]">مقارنة يومية لعدد الحجوزات</p>
          </div>
          <span className="rounded-full border border-[var(--bs-primary)]/40 bg-[var(--bs-primary-soft)] px-3 py-1 text-xs font-bold text-[var(--bs-primary)]">
            {stats.daily.reduce((s, d) => s + d.count, 0)} حجز
          </span>
        </div>

        {stats.daily.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--bs-text-faint)]">لا توجد بيانات بعد.</p>
        ) : (
          <>
            {/* Desktop: column chart */}
            <div className="hidden items-end justify-between gap-3 sm:flex" style={{ height: 180 }}>
              {stats.daily.map((d) => {
                const pct = Math.round((d.count / maxDaily) * 100);
                const isToday = d.date === stats.daily[stats.daily.length - 1]?.date;
                return (
                  <div key={d.date} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                    <span className="text-xs font-bold text-[var(--bs-text-muted)]">{d.count}</span>
                    <div
                      className={`w-full max-w-[52px] rounded-t-lg transition-all duration-300 group-hover:brightness-125 ${
                        isToday ? "bg-gradient-to-t from-[var(--bs-primary-strong)] to-[var(--bs-primary)]" : "bg-gradient-to-t from-[var(--bs-primary-strong)]/70 to-[var(--bs-primary)]/70"
                      }`}
                      style={{ height: `${Math.max(pct, 5)}%` }}
                    />
                    <span className="truncate text-[11px] text-[var(--bs-text-faint)]">{d.date.slice(5)}</span>
                  </div>
                );
              })}
            </div>

            {/* Mobile: horizontal bars */}
            <div className="space-y-2.5 sm:hidden">
              {stats.daily.map((d) => {
                const pct = Math.round((d.count / maxDaily) * 100);
                return (
                  <div key={d.date} className="flex items-center gap-3">
                    <span className="w-12 shrink-0 text-xs text-[var(--bs-text-muted)]">{d.date.slice(5)}</span>
                    <div className="flex-1">
                      <div
                        className="h-5 rounded-md bg-gradient-to-l from-[var(--bs-primary)] to-[var(--bs-primary-strong)]"
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      />
                    </div>
                    <span className="w-6 text-left text-sm font-bold text-[var(--bs-primary)]">{d.count}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* ═════════─ Two-column analytics ══════════ */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top services */}
        <section className="rounded-2xl border border-[var(--bs-border)] bg-[var(--bs-surface)]/60 p-6 shadow-lg">
          <h2 className="text-lg font-bold text-[var(--bs-text)]">أكثر الخدمات طلباً</h2>
          <p className="mb-5 mt-0.5 text-xs text-[var(--bs-text-faint)]">الخدمات الأكثر إيراداً وحجوزات</p>

          {stats.top_services.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--bs-text-faint)]">لا توجد بيانات بعد.</p>
          ) : (
            <ol className="space-y-3">
              {stats.top_services.map((s, i) => {
                const pct = Math.round((s.count / maxServiceCount) * 100);
                const medal = ["🥇", "🥈", "🥉"][i];
                return (
                  <li key={s.name} className="relative overflow-hidden rounded-xl bg-[var(--bs-surface-raised)]/50 px-4 py-3">
                    <div
                      className="absolute inset-y-0 right-0 bg-[var(--bs-primary-soft)] transition-all"
                      style={{ width: `${pct}%` }}
                    />
                    <div className="relative flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--bs-primary-soft)] text-sm font-bold text-[var(--bs-primary)]">
                          {medal ?? i + 1}
                        </span>
                        <span className="truncate text-sm font-semibold text-[var(--bs-text)]">{s.name}</span>
                      </div>
                      <div className="shrink-0 text-left">
                        <p className="text-sm font-bold text-[var(--bs-primary)]">{s.count} حجز</p>
                        <p className="text-xs text-[var(--bs-text-faint)]">{s.revenue} د.أ</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* No-show log */}
        <section className="rounded-2xl border border-[var(--bs-error)]/40 bg-[var(--bs-surface)]/60 p-6 shadow-lg">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-lg font-bold text-[var(--bs-text)]">سجل عدم الحضور</h2>
            {stats.no_shows.length > 0 && (
              <span className="rounded-full border border-[var(--bs-error)]/40 bg-[var(--bs-error-soft)] px-3 py-1 text-xs font-bold text-[var(--bs-error)]">
                {stats.no_shows.length} عميل
              </span>
            )}
          </div>
          <p className="mb-5 text-xs text-[var(--bs-text-faint)]">العملاء الذين فاتتهم مواعيدهم — يُنصح بالمتابعة</p>

          {stats.no_shows.length === 0 ? (
            <div className="py-8 text-center">
              <span className="mb-2 block text-3xl">✅</span>
              <p className="text-sm text-[var(--bs-text-muted)]">ممتاز! لا يوجد سجل عدم حضور.</p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {stats.no_shows.map((n, i) => (
                <li key={i} className="flex items-center justify-between rounded-xl bg-[var(--bs-surface-raised)]/50 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--bs-text)]">{n.customer_name}</p>
                    <p className="text-xs text-[var(--bs-text-faint)]">مع {n.barber_name}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--bs-error-soft)] px-3 py-1 text-xs font-bold text-[var(--bs-error)]">
                    {n.count} مرة
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ═════════─ Status breakdown ══════════ */}
      <section className="rounded-2xl border border-[var(--bs-border)] bg-[var(--bs-surface)]/60 p-6 shadow-lg">
        <h2 className="text-lg font-bold text-[var(--bs-text)]">توزيع حالات الحجوزات</h2>
        <p className="mb-5 mt-0.5 text-xs text-[var(--bs-text-faint)]">ملخص شامل لجميع الحجوزات حسب الحالة</p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.totals.map((t) => {
            const pct = totalBookings > 0 ? Math.round((t.count / totalBookings) * 100) : 0;
            const styles: Record<string, string> = {
              confirmed: "text-[var(--bs-primary)] border-[var(--bs-primary)]/40 bg-[var(--bs-primary-soft)]",
              cancelled: "text-[var(--bs-text-muted)] border-[var(--bs-border-strong)] bg-[var(--bs-surface-raised)]/40",
              completed: "text-[var(--bs-success)] border-[var(--bs-success)]/40 bg-[var(--bs-success-soft)]",
              no_show: "text-[var(--bs-error)] border-[var(--bs-error)]/40 bg-[var(--bs-error-soft)]",
            };
            return (
              <div key={t.status} className={`rounded-xl border p-4 text-center ${styles[t.status] ?? "border-[var(--bs-border)] bg-[var(--bs-surface-raised)]/40 text-[var(--bs-text-muted)]"}`}>
                <p className="text-3xl font-black tabular-nums">{t.count}</p>
                <p className="mt-1 text-xs font-semibold">{STATUS_LABELS[t.status] ?? t.status}</p>
                <p className="mt-0.5 text-[11px] opacity-60">{pct}% من الإجمالي</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color: "amber" | "emerald" | "blue" | "red";
  icon?: React.ReactNode;
}) {
  const styles: Record<string, { card: string; text: string; iconBg: string }> = {
    amber: {
      card: "border-[var(--bs-primary)]/40 bg-gradient-to-br from-[var(--bs-primary-soft)] to-transparent hover:border-[var(--bs-primary)]/50",
      text: "text-[var(--bs-primary)]",
      iconBg: "bg-[var(--bs-primary-soft)] text-[var(--bs-primary)]",
    },
    emerald: {
      card: "border-[var(--bs-success)]/40 bg-gradient-to-br from-[var(--bs-success-soft)] to-transparent hover:border-[var(--bs-success)]/50",
      text: "text-[var(--bs-success)]",
      iconBg: "bg-[var(--bs-success-soft)] text-[var(--bs-success)]",
    },
    blue: {
      card: "border-[var(--bs-success)]/40 bg-gradient-to-br from-[var(--bs-success-soft)] to-transparent hover:border-[var(--bs-success)]/40",
      text: "text-[var(--bs-success)]",
      iconBg: "bg-[var(--bs-success-soft)] text-[var(--bs-success)]",
    },
    red: {
      card: "border-[var(--bs-error)]/40 bg-gradient-to-br from-[var(--bs-error-soft)] to-transparent hover:border-[var(--bs-error)]/40",
      text: "text-[var(--bs-error)]",
      iconBg: "bg-[var(--bs-error-soft)] text-[var(--bs-error)]",
    },
  };

  return (
    <div className={`rounded-2xl border p-5 shadow-lg transition-all hover:-translate-y-0.5 ${styles[color].card}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[var(--bs-text-muted)]">{label}</p>
          <p className={`mt-2 truncate text-3xl font-black tabular-nums ${styles[color].text}`} dir={typeof value === "string" && value.includes("د.أ") ? "rtl" : undefined}>
            {value}
          </p>
          {sub && <p className="mt-1.5 text-[11px] text-[var(--bs-text-faint)]">{sub}</p>}
        </div>
        {icon && (
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${styles[color].iconBg}`}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              {icon}
            </svg>
          </span>
        )}
      </div>
    </div>
  );
}
