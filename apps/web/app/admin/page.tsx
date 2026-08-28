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

const STATUS_DOT: Record<string, string> = {
  confirmed: "bg-[var(--bs-primary)]",
  cancelled: "bg-[var(--bs-text-faint)]",
  completed: "bg-[var(--bs-success)]",
  no_show: "bg-[var(--bs-error)]",
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
      <div className="space-y-10">
        <div className="h-9 w-40 animate-pulse rounded-xl bg-[var(--bs-surface)]" />
        <div className="h-48 animate-pulse rounded-3xl bg-[var(--bs-surface)]/70" />
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
    <div className="space-y-12">
      {/* ══════════ Header ══════════ */}
      <header>
        <p className="mb-2 flex items-center gap-2.5 text-[11px] font-bold tracking-[0.25em] text-[var(--bs-primary)]">
          <span className="inline-block h-px w-8 bg-[var(--bs-primary)]/60" />
          لوحة التحكم
        </p>
        <h1 className="text-3xl font-black text-[var(--bs-text)] sm:text-4xl">نظرة سريعة على أداء صالونك</h1>
      </header>

      {/* ═══════════════════════════════════════════════════════════
          OPERATIONS HERO — revenue is the one dominant number on the page
          ═══════════════════════════════════════════════════════════ */}
      <section aria-label="المؤشرات الرئيسية" className="bs-panel relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 55% 90% at 88% -20%, rgba(201,162,39,0.14), transparent 65%)",
          }}
        />
        <div className="bs-grain" />

        <div className="relative flex flex-col gap-8 p-6 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
          {/* focal metric */}
          <div>
            <p className="text-[11px] font-bold tracking-[0.2em] text-[var(--bs-primary)]">
              الإيرادات المتوقعة · هذا الأسبوع
            </p>
            <p className="mt-3 text-5xl font-black leading-none tabular-nums text-[var(--bs-text)] sm:text-7xl lg:text-8xl" dir="ltr">
              {stats.week.expected_revenue}
              <span className="mr-2 text-xl font-bold text-[var(--bs-text-faint)] sm:mr-3 sm:text-3xl">د.أ</span>
            </p>
            <p className="mt-4 text-sm text-[var(--bs-text-muted)]">
              من <span className="font-bold text-[var(--bs-text)]">{stats.week.bookings}</span> حجزاً خلال آخر 7 أيام
            </p>
          </div>

          {/* quiet stacked side-stats — hairline-divided, deliberately smaller */}
          <div className="divide-y divide-[var(--bs-border)] border-t border-[var(--bs-border)] lg:min-w-[15rem] lg:border-t-0 lg:border-r lg:pr-8">
            <div className="flex items-baseline justify-between gap-6 py-3.5 lg:justify-end">
              <span className="text-xs text-[var(--bs-text-muted)]">إجمالي الحجوزات</span>
              <span className="text-2xl font-black tabular-nums text-[var(--bs-text)]">
                {totalBookings}
                <span className="mr-1.5 text-xs font-semibold text-[var(--bs-text-faint)]">({confirmed} مؤكد)</span>
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-6 py-3.5 lg:justify-end">
              <span className="text-xs text-[var(--bs-text-muted)]">لم يحضروا</span>
              <span className={`text-2xl font-black tabular-nums ${noShow > 0 ? "text-[var(--bs-error)]" : "text-[var(--bs-text)]"}`}>
                {noShow}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-6 py-3.5 lg:justify-end">
              <span className="text-xs text-[var(--bs-text-muted)]">حجوزات الأسبوع</span>
              <span className="text-2xl font-black tabular-nums text-[var(--bs-text)]">{stats.week.bookings}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          Daily chart — editorial column chart on a hairline, no boxed card
          ═══════════════════════════════════════════════════════════ */}
      <section>
        <div className="flex items-end justify-between gap-4 border-b border-[var(--bs-border)] pb-4">
          <div>
            <h2 className="text-xl font-black text-[var(--bs-text)]">حجوزات الأيام السبعة الأخيرة</h2>
            <p className="mt-1 text-xs text-[var(--bs-text-faint)]">مقارنة يومية لعدد الحجوزات</p>
          </div>
          <span className="text-sm font-bold text-[var(--bs-primary)]">
            {stats.daily.reduce((s, d) => s + d.count, 0)} حجز
          </span>
        </div>

        {stats.daily.length === 0 ? (
          <p className="py-10 text-center text-sm text-[var(--bs-text-faint)]">لا توجد بيانات بعد.</p>
        ) : (
          <>
            {/* Desktop: column chart */}
            <div className="hidden items-end justify-between gap-3 pt-6 sm:flex" style={{ height: 190 }}>
              {stats.daily.map((d) => {
                const pct = Math.round((d.count / maxDaily) * 100);
                const isToday = d.date === stats.daily[stats.daily.length - 1]?.date;
                return (
                  <div key={d.date} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                    <span className={`text-xs font-bold ${isToday ? "text-[var(--bs-primary)]" : "text-[var(--bs-text-faint)]"}`}>{d.count}</span>
                    <div
                      className={`w-full max-w-[52px] rounded-t-lg transition-all duration-300 group-hover:brightness-125 ${
                        isToday
                          ? "bg-gradient-to-t from-[var(--bs-primary-strong)] to-[var(--bs-primary)] shadow-lg shadow-[var(--bs-primary)]/25"
                          : "bg-[var(--bs-surface-raised)] group-hover:bg-[var(--bs-primary)]/40"
                      }`}
                      style={{ height: `${Math.max(pct, 4)}%` }}
                    />
                    <span className="truncate text-[11px] text-[var(--bs-text-faint)]">{d.date.slice(5)}</span>
                  </div>
                );
              })}
            </div>

            {/* Mobile: horizontal bars */}
            <div className="space-y-3 pt-6 sm:hidden">
              {stats.daily.map((d) => {
                const pct = Math.round((d.count / maxDaily) * 100);
                const isToday = d.date === stats.daily[stats.daily.length - 1]?.date;
                return (
                  <div key={d.date} className="flex items-center gap-3">
                    <span className="w-12 shrink-0 text-xs text-[var(--bs-text-muted)]">{d.date.slice(5)}</span>
                    <div className="flex-1">
                      <div
                        className={`h-5 rounded-md ${
                          isToday ? "bg-[var(--bs-primary)]" : "bg-[var(--bs-surface-raised)]"
                        }`}
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      />
                    </div>
                    <span className={`w-6 text-left text-sm font-bold ${isToday ? "text-[var(--bs-primary)]" : "text-[var(--bs-text)]"}`}>{d.count}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════
          Top services × No-show log — asymmetric editorial pairing
          ═══════════════════════════════════════════════════════════ */}
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-8">
        {/* Top services — numbered editorial ranking, hairline rows */}
        <section>
          <div className="border-b border-[var(--bs-border)] pb-4">
            <h2 className="text-xl font-black text-[var(--bs-text)]">أكثر الخدمات طلباً</h2>
            <p className="mt-1 text-xs text-[var(--bs-text-faint)]">الخدمات الأكثر إيراداً وحجوزات</p>
          </div>

          {stats.top_services.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--bs-text-faint)]">لا توجد بيانات بعد.</p>
          ) : (
            <ol className="divide-y divide-[var(--bs-border)]">
              {stats.top_services.map((s, i) => {
                const pct = Math.round((s.count / maxServiceCount) * 100);
                return (
                  <li key={s.name} className="relative overflow-hidden py-4">
                    <div
                      className="absolute inset-y-0 right-0 bg-[var(--bs-primary-soft)] transition-all"
                      style={{ width: `${pct}%` }}
                    />
                    <div className="relative flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-4">
                        <span className="w-7 shrink-0 text-sm font-black text-[var(--bs-text-faint)]" dir="ltr">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="truncate text-base font-bold text-[var(--bs-text)]">{s.name}</span>
                      </div>
                      <div className="shrink-0 text-left">
                        <p className="text-base font-black text-[var(--bs-primary)]">{s.count} حجز</p>
                        <p className="text-xs text-[var(--bs-text-faint)]">{s.revenue} د.أ</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* No-show log — borderless tinted panel, deliberately quieter */}
        <section className="rounded-3xl bg-[var(--bs-error-soft)]/40 p-6">
          <div className="flex items-center justify-between border-b border-[var(--bs-error)]/20 pb-4">
            <div>
              <h2 className="text-xl font-black text-[var(--bs-text)]">سجل عدم الحضور</h2>
              <p className="mt-1 text-xs text-[var(--bs-text-faint)]">العملاء الذين فاتتهم مواعيدهم — يُنصح بالمتابعة</p>
            </div>
            {stats.no_shows.length > 0 && (
              <span className="text-sm font-bold text-[var(--bs-error)]">{stats.no_shows.length} عميل</span>
            )}
          </div>

          {stats.no_shows.length === 0 ? (
            <div className="py-10 text-center">
              <span className="mb-2 block text-3xl">✅</span>
              <p className="text-sm text-[var(--bs-text-muted)]">ممتاز! لا يوجد سجل عدم حضور.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--bs-error)]/10">
              {stats.no_shows.map((n, i) => (
                <li key={i} className="flex items-center justify-between py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[var(--bs-text)]">{n.customer_name}</p>
                    <p className="text-xs text-[var(--bs-text-faint)]">مع {n.barber_name}</p>
                  </div>
                  <span className="shrink-0 text-sm font-black text-[var(--bs-error)]">{n.count} مرة</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          Status breakdown — borderless stat blocks separated by hairlines
          ═══════════════════════════════════════════════════════════ */}
      <section>
        <div className="border-b border-[var(--bs-border)] pb-4">
          <h2 className="text-xl font-black text-[var(--bs-text)]">توزيع حالات الحجوزات</h2>
          <p className="mt-1 text-xs text-[var(--bs-text-faint)]">ملخص شامل لجميع الحجوزات حسب الحالة</p>
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-[var(--bs-border)]/60 sm:grid-cols-4">
          {stats.totals.map((t) => {
            const pct = totalBookings > 0 ? Math.round((t.count / totalBookings) * 100) : 0;
            return (
              <div key={t.status} className="bg-[var(--bs-surface)] p-5 text-center">
                <span className={`mx-auto mb-2 block h-2 w-2 rounded-full ${STATUS_DOT[t.status] ?? "bg-[var(--bs-border-strong)]"}`} />
                <p className="text-4xl font-black tabular-nums text-[var(--bs-text)]">{t.count}</p>
                <p className="mt-1.5 text-xs font-bold text-[var(--bs-text-muted)]">{STATUS_LABELS[t.status] ?? t.status}</p>
                <p className="mt-0.5 text-[11px] text-[var(--bs-text-faint)]">{pct}% من الإجمالي</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
