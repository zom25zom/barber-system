"use client";

import { useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "@/lib/api";
import { CircleCheck } from "lucide-react";
import { getOwnerToken } from "@/lib/auth";
import type { OwnerStats } from "@/lib/types";

const STATUS_LABELS: Record<string, string> = {
  confirmed: "مؤكد",
  cancelled: "ملغي",
  completed: "مكتمل",
  no_show: "لم يحضر",
};

// Dot colors mirror the booking status badges in admin/bookings exactly:
// gold = confirmed · green = completed · amber = no-show · gray = cancelled
const STATUS_DOT: Record<string, string> = {
  confirmed: "bg-[var(--bs-primary)]",
  cancelled: "bg-[var(--bs-text-faint)]",
  completed: "bg-[var(--bs-success)]",
  no_show: "bg-[var(--bs-warning)]",
};

// Cell tint per status — same soft backgrounds the badges use, so the meaning
// reads instantly without a legend.
const STATUS_SOFT: Record<string, string> = {
  confirmed: "border-[var(--bs-primary)]/30 bg-[var(--bs-primary-soft)]",
  cancelled: "border-[var(--bs-border)] bg-[var(--bs-surface-raised)]/40",
  completed: "border-[var(--bs-success)]/30 bg-[var(--bs-success-soft)]",
  no_show: "border-[var(--bs-warning)]/30 bg-[var(--bs-warning-soft)]",
};

const STATUS_TEXT: Record<string, string> = {
  confirmed: "text-[var(--bs-primary)]",
  cancelled: "text-[var(--bs-text-muted)]",
  completed: "text-[var(--bs-success)]",
  no_show: "text-[var(--bs-warning)]",
};

/** Shared card header for every section panel — one consistent pattern. */
function PanelHeader({
  title,
  subtitle,
  trailing,
}: {
  title: string;
  subtitle: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--bs-border)] px-5 py-4 sm:px-7 sm:py-5">
      <div className="min-w-0">
        <h2 className="truncate text-lg font-black text-[var(--bs-text)] sm:text-xl">{title}</h2>
        <p className="mt-0.5 truncate text-xs text-[var(--bs-text-faint)]">{subtitle}</p>
      </div>
      {trailing}
    </div>
  );
}

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
              <span className={`text-2xl font-black tabular-nums ${noShow > 0 ? "text-[var(--bs-warning)]" : "text-[var(--bs-text)]"}`}>
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
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        {/* Top services — numbered editorial ranking, hairline rows */}
        <section className="bs-panel overflow-hidden">
          <PanelHeader
            title="أكثر الخدمات طلباً"
            subtitle="الخدمات الأكثر إيراداً وحجوزات"
          />

          {stats.top_services.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-[var(--bs-text-faint)] sm:px-7">لا توجد بيانات بعد.</p>
          ) : (
            <ol className="divide-y divide-[var(--bs-border)] px-5 sm:px-7">
              {stats.top_services.map((s, i) => {
                return (
                  <li key={s.name} className="relative py-4">
                    <div className="relative flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-4">
                        <span className="w-7 shrink-0 text-sm font-black tabular-nums text-[var(--bs-text-muted)]" dir="ltr">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="truncate text-base font-bold text-[var(--bs-text)]">{s.name}</span>
                      </div>
                      <div className="shrink-0 text-left">
                        <p className="text-base font-black text-[var(--bs-text)]">{s.count} حجز</p>
                        <p className="text-xs text-[var(--bs-text-faint)]">{s.revenue} د.أ</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* No-show log — same panel frame, warning-tinted accents to match
            the no_show status badge used across the app */}
        <section className="bs-panel overflow-hidden">
          <PanelHeader
            title="سجل عدم الحضور"
            subtitle="العملاء الذين فاتتهم مواعيدهم — يُنصح بالمتابعة"
            trailing={
              stats.no_shows.length > 0 ? (
                <span className="shrink-0 text-sm font-bold text-[var(--bs-error)]">{stats.no_shows.length} عميل</span>
              ) : undefined
            }
          />

          {stats.no_shows.length === 0 ? (
            <div className="px-5 py-10 text-center sm:px-7">
              <CircleCheck className="mx-auto mb-2 h-8 w-8 text-[var(--bs-success)]" aria-hidden="true" />
              <p className="text-sm text-[var(--bs-text-muted)]">ممتاز! لا يوجد سجل عدم حضور.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--bs-border)]/60 px-5 sm:px-7">
              {stats.no_shows.map((n, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--bs-warning)]" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[var(--bs-text)]">{n.customer_name}</p>
                      <p className="text-xs text-[var(--bs-text-faint)]">مع {n.barber_name}</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-black text-[var(--bs-warning)]">{n.count} مرة</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Status breakdown — adaptive grid: 3 items render as a true
          3-column row on desktop and a clean 2+1 stack on mobile with no
          dangling empty box; other counts adapt the same way. */}
      <section className="bs-panel overflow-hidden">
        <PanelHeader
          title="توزيع حالات الحجوزات"
          subtitle="ملخص شامل لجميع الحجوزات حسب الحالة"
        />

        <StatusGrid totals={stats.totals} totalBookings={totalBookings} />
      </section>
    </div>
  );
}

/**
 * Adaptive status grid — column count follows the data so there is never a
 * dangling empty cell (the old fixed 2-col grid left a broken blank box when
 * only 3 statuses existed):
 *   1 → full width · 2 → stacked/pair · 3 → 2+1 on mobile, 3-up on desktop
 *   4 → 2×2 on mobile, 4-up on desktop · >4 → 2-col mobile, extra cell spans.
 * Each cell is tinted with the same soft badge colors used for booking
 * status badges in admin/bookings, so the dot + color meaning is obvious.
 */
function StatusGrid({
  totals,
  totalBookings,
}: {
  totals: { status: string; count: number }[];
  totalBookings: number;
}) {
  const n = totals.length;
  const gridCls =
    n <= 1
      ? "grid-cols-1"
      : n === 2
        ? "grid-cols-1 sm:grid-cols-2"
        : n === 3
          ? "grid-cols-2 sm:grid-cols-3"
          : "grid-cols-2 sm:grid-cols-4";
  // odd count on the 2-col mobile grid → last cell spans the full row
  const spanCls =
    n === 3 ? "last:col-span-2 sm:last:col-span-1" : n > 4 && n % 2 === 1 ? "last:col-span-2" : "";

  if (n === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-[var(--bs-text-faint)] sm:px-7">لا توجد بيانات بعد.</p>
    );
  }

  return (
    <div className={`grid gap-3 p-5 sm:p-7 ${gridCls}`}>
      {totals.map((t) => {
        const pct = totalBookings > 0 ? Math.round((t.count / totalBookings) * 100) : 0;
        return (
          <div
            key={t.status}
            className={`rounded-2xl border p-5 text-center ${spanCls} ${
              STATUS_SOFT[t.status] ?? "border-[var(--bs-border)] bg-[var(--bs-surface-raised)]/40"
            }`}
          >
            <p className="mb-2 flex items-center justify-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${STATUS_DOT[t.status] ?? "bg-[var(--bs-border-strong)]"}`}
                aria-hidden="true"
              />
              <span className={`text-xs font-bold ${STATUS_TEXT[t.status] ?? "text-[var(--bs-text-muted)]"}`}>
                {STATUS_LABELS[t.status] ?? t.status}
              </span>
            </p>
            <p className="text-4xl font-black tabular-nums leading-none text-[var(--bs-text)]">{t.count}</p>
            <p className="mt-2 text-[11px] text-[var(--bs-text-faint)]">{pct}% من الإجمالي</p>
          </div>
        );
      })}
    </div>
  );
}
