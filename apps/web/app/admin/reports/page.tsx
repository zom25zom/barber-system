"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { getOwnerToken } from "@/lib/auth";
import { WEEKDAYS_AR, formatTime12 } from "@/lib/time";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Table2, Flame, Scissors, TriangleAlert } from "lucide-react";

interface ReportSummary {
  total_revenue: number;
  completed_revenue: number;
  total_bookings: number;
  completed_count: number;
  confirmed_count: number;
  cancelled_count: number;
  no_show_count: number;
  avg_ticket: number;
}

interface BarberRevenue {
  barber_id: number;
  barber_name: string;
  photo_url: string | null;
  revenue: number;
  bookings_count: number;
  completed_count: number;
}

interface ServiceRevenue {
  service_name: string;
  count: number;
  revenue: number;
}

interface DailyTrend {
  date: string;
  bookings_count: number;
  revenue: number;
}

interface PeakHourCell {
  day_of_week: number; // 0=Sunday..6=Saturday
  hour: number;        // 0..23
  count: number;
}

interface ReportsData {
  period: "today" | "week" | "month" | "custom";
  from: string;
  to: string;
  summary: ReportSummary;
  revenue_by_barber: BarberRevenue[];
  revenue_by_service: ServiceRevenue[];
  daily_trend: DailyTrend[];
  peak_hours: PeakHourCell[];
}

const HOURS_RANGE = Array.from({ length: 14 }, (_, i) => i + 9); // 09:00 to 22:00

export default function AdminReportsPage() {
  const token = getOwnerToken();
  const toast = useToast();
  // Salon-local dates (Jordan UTC+3) — raw toISOString() lags a day between 00:00-03:00 local
  const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() + 3 * 3600_000 - 6 * 24 * 3600_000).toISOString().slice(0, 10);

  const [period, setPeriod] = useState<"today" | "this_week" | "this_month" | "week" | "month" | "custom">("this_month");
  const [fromDate, setFromDate] = useState(weekAgo);
  const [toDate, setToDate] = useState(today);
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    let query = `/api/owner/reports?period=${period}`;
    if (period === "custom") {
      query += `&from=${fromDate}&to=${toDate}`;
    }

    try {
      const res = await apiFetch<ReportsData>(query, { token });
      setData(res);
    } catch (err) {
      const msg = (err as Error).message || "حدث خطأ أثناء تحميل التقارير";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [token, period, fromDate, toDate, toast]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Export Financial Summary to CSV (with UTF-8 BOM for Excel Arabic support)
  const exportFinancialCSV = () => {
    if (!data) return;

    const rows: string[][] = [
      ["تقرير الإيرادات المالية والأداء للصالون"],
      [`الفترة: من ${data.from} إلى ${data.to}`],
      [],
      ["ملخص الأرقام العامة"],
      ["إجمالي الإيرادات (د.أ)", String(data.summary.total_revenue)],
      ["إيرادات الحجوزات المكتملة (د.أ)", String(data.summary.completed_revenue)],
      ["إجمالي الحجوزات", String(data.summary.total_bookings)],
      ["الحجوزات المكتملة", String(data.summary.completed_count)],
      ["الحجوزات المؤكدة", String(data.summary.confirmed_count)],
      ["الحجوزات الملغاة", String(data.summary.cancelled_count)],
      ["حالات عدم الحضور (No-Show)", String(data.summary.no_show_count)],
      ["متوسط قيمة الحجز (د.أ)", String(data.summary.avg_ticket)],
      [],
      ["إيرادات الحلاقين"],
      ["اسم الحلاق", "عدد الحجوزات", "الحجوزات المكتملة", "إجمالي الإيرادات (د.أ)"],
      ...data.revenue_by_barber.map((b) => [
        b.barber_name,
        String(b.bookings_count),
        String(b.completed_count),
        String(b.revenue),
      ]),
      [],
      ["إيرادات الخدمات الأكثر طلباً"],
      ["اسم الخدمة", "عدد المرات", "إجمالي الإيرادات (د.أ)"],
      ...data.revenue_by_service.map((s) => [
        s.service_name,
        String(s.count),
        String(s.revenue),
      ]),
    ];

    const csvContent = "\uFEFF" + rows.map((e) => e.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `salon_financial_report_${data.from}_${data.to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("تم تصدير التقرير المالي (Excel) بنجاح ✓");
  };

  // Export Peak Hours Matrix to CSV
  const exportPeakHoursCSV = () => {
    if (!data) return;

    const header = ["اليوم", ...HOURS_RANGE.map((h) => formatTime12(h))];
    const rows = [
      ["تقرير خريطة ساعات الذروة والكثافة"],
      [`الفترة: من ${data.from} إلى ${data.to}`],
      [],
      header,
      ...WEEKDAYS_AR.map((dayName, dow) => {
        const row = [dayName];
        HOURS_RANGE.forEach((h) => {
          const match = data.peak_hours.find((c) => c.day_of_week === dow && c.hour === h);
          row.push(String(match ? match.count : 0));
        });
        return row;
      }),
    ];

    const csvContent = "\uFEFF" + rows.map((e) => e.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `salon_peak_hours_${data.from}_${data.to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("تم تصدير خريطة ساعات الذروة (CSV) بنجاح ✓");
  };

  // Calculate heatmap max count for dynamic color scaling
  const maxPeakCount = data?.peak_hours.reduce((max, c) => Math.max(max, c.count), 0) || 1;

  /* Gold intensity ramp: cream/soft gold at low → deep bronze at peak.
     Token-driven so contrast holds in BOTH light and dark mode. */
  const getHeatmapColor = (count: number) => {
    if (count === 0) return "bg-[var(--bs-surface-raised)]/60 border-[var(--bs-border)]/60 text-transparent";
    const ratio = count / maxPeakCount;
    if (ratio < 0.25)
      return "bg-[var(--bs-primary-soft)] border-[var(--bs-primary)]/30 text-[var(--bs-primary-strong)]";
    if (ratio < 0.5)
      return "bg-[var(--bs-primary)]/30 border-[var(--bs-primary)]/50 text-[var(--bs-text)]";
    if (ratio < 0.75)
      return "bg-[var(--bs-primary)]/70 border-[var(--bs-primary)] text-[var(--bs-on-primary)] font-bold";
    return "bg-[var(--bs-primary-strong)] border-[var(--bs-primary)] text-[var(--bs-on-primary)] font-black shadow-md shadow-[var(--bs-primary)]/30";
  };

  return (
    <div className="space-y-12">
      {/* ── Page Header ── */}
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 flex items-center gap-2.5 text-[11px] font-bold tracking-[0.25em] text-[var(--bs-primary)]">
            <span className="inline-block h-px w-8 bg-[var(--bs-primary)]/60" />
            التحليل المالي
          </p>
          <h1 className="text-3xl font-black text-[var(--bs-text)] sm:text-4xl">التقارير وساعات الذروة</h1>
        </div>

        {/* Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={exportFinancialCSV} disabled={loading || !data}>
            <Download className="h-4 w-4" />
            تصدير المالي (Excel)
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={exportPeakHoursCSV} disabled={loading || !data}>
            <Table2 className="h-4 w-4" />
            تصدير الذروة (CSV)
          </Button>
        </div>
      </header>

      {/* ── Period Filter Tabs — quiet underline control ── */}
      <div className="border-b border-[var(--bs-border)]">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {[
            { key: "today", label: "اليوم" },
            { key: "this_week", label: "هذا الأسبوع" },
            { key: "this_month", label: "هذا الشهر" },
            { key: "week", label: "آخر 7 أيام" },
            { key: "month", label: "آخر 30 يوم" },
            { key: "custom", label: "فترة مخصصة" },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setPeriod(t.key as any)}
              className={`-mb-px border-b-2 pb-3 text-sm transition-colors ${
                period === t.key
                  ? "border-[var(--bs-primary)] font-bold text-[var(--bs-primary)]"
                  : "border-transparent font-medium text-[var(--bs-text-muted)] hover:text-[var(--bs-text)]"
              }`}
            >
              {t.label}
            </button>
          ))}

          {(period !== "this_month" || fromDate !== weekAgo || toDate !== today) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mr-auto"
              onClick={() => {
                setPeriod("this_month");
                setFromDate(weekAgo);
                setToDate(today);
                toast.info("تمت إعادة ضبط الفلاتر للقيمة الافتراضية");
              }}
            >
              مسح الفلاتر ✕
            </Button>
          )}
        </div>
      </div>

      {/* Custom Date Range Selectors */}
      {period === "custom" && (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-[var(--bs-surface)]/60 p-4">
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--bs-text-muted)]">من:</label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-9 w-auto px-3 py-1.5 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--bs-text-muted)]">إلى:</label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-9 w-auto px-3 py-1.5 text-xs"
            />
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-[var(--bs-error)]/40 bg-[var(--bs-error-soft)] p-4 text-sm text-[var(--bs-error)] flex items-center justify-between">
          <TriangleAlert className="h-4 w-4 shrink-0 self-center" aria-hidden="true" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-xs text-[var(--bs-error)] underline opacity-80 hover:opacity-100">
            إغلاق
          </button>
        </div>
      )}

      {loading && (
        <div className="py-16 text-center">
          <Spinner size="lg" label="جاري تجميع وتحليل البيانات المالية…" />
        </div>
      )}

      {!loading && data && (
        <div className="space-y-14">
          {/* ═══════════════════════════════════════════════════════════
              1. REVENUE HERO — the one dominant number on this page
              ═══════════════════════════════════════════════════════════ */}
          <section className="bs-panel relative overflow-hidden">
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 55% 90% at 88% -20%, rgba(201,162,39,0.14), transparent 65%)",
              }}
            />
            <div className="bs-grain" />

            <div className="relative flex flex-col gap-8 p-6 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-bold tracking-[0.2em] text-[var(--bs-primary)]">
                  إجمالي الإيرادات
                </p>
                <p className="mt-3 text-5xl font-black leading-none tabular-nums text-[var(--bs-text)] sm:text-7xl lg:text-8xl" dir="ltr">
                  {data.summary.total_revenue.toLocaleString()}
                  <span className="mr-2 text-xl font-bold text-[var(--bs-text-faint)] sm:mr-3 sm:text-3xl">د.أ</span>
                </p>
                <p className="mt-4 text-sm text-[var(--bs-text-muted)]">
                  منها <span className="font-bold text-[var(--bs-success)]">{data.summary.completed_revenue.toLocaleString()} د.أ</span> محصلة فعلياً
                </p>
              </div>

              {/* quiet stacked side-stats */}
              <div className="divide-y divide-[var(--bs-border)] border-t border-[var(--bs-border)] lg:min-w-[16rem] lg:border-t-0 lg:border-r lg:pr-8">
                <div className="flex items-baseline justify-between gap-6 py-3.5 lg:justify-end">
                  <span className="text-xs text-[var(--bs-text-muted)]">إجمالي الحجوزات</span>
                  <span className="text-2xl font-black tabular-nums text-[var(--bs-text)]">
                    {data.summary.total_bookings}
                    <span className="mr-1.5 text-xs font-semibold text-[var(--bs-text-faint)]">({data.summary.completed_count} مكتمل · {data.summary.confirmed_count} قادم)</span>
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-6 py-3.5 lg:justify-end">
                  <span className="text-xs text-[var(--bs-text-muted)]">متوسط قيمة الفاتورة</span>
                  <span className="text-2xl font-black tabular-nums text-[var(--bs-text)]">{data.summary.avg_ticket} د.أ</span>
                </div>
                <div className="flex items-baseline justify-between gap-6 py-3.5 lg:justify-end">
                  <span className="text-xs text-[var(--bs-text-muted)]">معدل الالتزام</span>
                  <span className="text-2xl font-black tabular-nums text-[var(--bs-success)]">
                    {data.summary.total_bookings > 0
                      ? `${Math.round(
                          ((data.summary.completed_count + data.summary.confirmed_count) /
                            data.summary.total_bookings) *
                            100
                        )}%`
                      : "100%"}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-6 py-3.5 lg:justify-end">
                  <span className="text-xs text-[var(--bs-text-muted)]">إلغاء / غياب</span>
                  <span className="text-lg font-black tabular-nums">
                    <span className="text-[var(--bs-error)]">{data.summary.cancelled_count}</span>
                    <span className="mx-1 text-[var(--bs-text-faint)]">/</span>
                    <span className="text-[var(--bs-warning)]">{data.summary.no_show_count}</span>
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ═══════ 2. Barber Revenue & Service Performance ═══════ */}
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-8">
            {/* Barber Breakdown — editorial share bars */}
            <section>
              <div className="flex items-center justify-between border-b border-[var(--bs-border)] pb-4">
                <h2 className="text-xl font-black text-[var(--bs-text)]">الإيرادات حسب الحلاق</h2>
                <span className="text-xs text-[var(--bs-text-faint)]">{data.revenue_by_barber.length} حلاقين</span>
              </div>

              {data.revenue_by_barber.length === 0 ? (
                <p className="py-10 text-center text-xs text-[var(--bs-text-faint)]">لا توجد بيانات لهذه الفترة</p>
              ) : (
                <div className="divide-y divide-[var(--bs-border)]">
                  {data.revenue_by_barber.map((b) => {
                    const pct =
                      data.summary.total_revenue > 0
                        ? Math.round((b.revenue / data.summary.total_revenue) * 100)
                        : 0;

                    return (
                      <div key={b.barber_id} className="py-5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3.5">
                            {b.photo_url ? (
                              <img
                                src={b.photo_url}
                                alt={b.barber_name}
                                className="h-11 w-11 rounded-full border border-[var(--bs-border-strong)] object-cover"
                              />
                            ) : (
                              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--bs-border-strong)] bg-[var(--bs-surface-raised)]">
                                <Scissors className="h-4 w-4 text-[var(--bs-text-faint)]" aria-hidden="true" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-base font-black text-[var(--bs-text)]">{b.barber_name}</p>
                              <p className="text-xs text-[var(--bs-text-faint)]">
                                {b.bookings_count} حجز ({b.completed_count} منجز)
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 text-left">
                            <p className="text-base font-black tabular-nums text-[var(--bs-primary)]">{b.revenue} د.أ</p>
                            <p className="text-[11px] text-[var(--bs-text-faint)]">{pct}% من الإجمالي</p>
                          </div>
                        </div>

                        {/* thin gold share bar */}
                        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-[var(--bs-surface-raised)]">
                          <div
                            className="h-full rounded-full bg-[var(--bs-primary)] transition-all duration-500"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Service Breakdown — dotted-leader menu board */}
            <section>
              <div className="flex items-center justify-between border-b border-[var(--bs-border)] pb-4">
                <h2 className="text-xl font-black text-[var(--bs-text)]">الخدمات الأكثر طلباً وإيراداً</h2>
                <span className="text-xs text-[var(--bs-text-faint)]">{data.revenue_by_service.length} خدمات</span>
              </div>

              {data.revenue_by_service.length === 0 ? (
                <p className="py-10 text-center text-xs text-[var(--bs-text-faint)]">لا توجد بيانات لهذه الفترة</p>
              ) : (
                <div className="pt-2">
                  {data.revenue_by_service.map((s, idx) => (
                    <button
                      key={s.service_name}
                      type="button"
                      tabIndex={-1}
                      className="bs-leader group w-full border-b border-[var(--bs-border)]/60 py-4 text-start"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-[var(--bs-text)]">
                          <span className="ml-2 text-[11px] font-black text-[var(--bs-text-faint)]" dir="ltr">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          {s.service_name}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-[var(--bs-text-faint)]">
                          تم طلبها {s.count} مرة
                        </span>
                      </span>
                      <span className="bs-leader-dots" aria-hidden="true" />
                      <span className="shrink-0 text-base font-black text-[var(--bs-primary)]">
                        {s.revenue} <span className="text-[11px] font-bold">د.أ</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* ═══════ 3. Peak Hours Heatmap (خريطة ساعات الذروة) ═══════ */}
          <section>
            <div className="flex flex-col justify-between gap-4 border-b border-[var(--bs-border)] pb-4 sm:flex-row sm:items-end">
              <div>
                <h2 className="flex items-center gap-2.5 text-xl font-black text-[var(--bs-text)]">
                  <Flame className="h-5 w-5 text-[var(--bs-primary)]" /> خريطة الكثافة وساعات الذروة
                </h2>
                <p className="mt-1 text-xs text-[var(--bs-text-muted)]">
                  توزيع الحجوزات الفعلية عبر أيام الأسبوع وساعات العمل لمساعدتك في تنظيم طاقم الحلاقين.
                </p>
              </div>

              {/* Legend — mirrors the gold ramp */}
              <div className="flex items-center gap-2 text-[11px] text-[var(--bs-text-muted)]">
                <span>أقل كثافة</span>
                <div className="flex items-center gap-1">
                  <span className="h-3.5 w-3.5 rounded border border-[var(--bs-border)] bg-[var(--bs-surface-raised)]" />
                  <span className="h-3.5 w-3.5 rounded border border-[var(--bs-primary)]/30 bg-[var(--bs-primary-soft)]" />
                  <span className="h-3.5 w-3.5 rounded border border-[var(--bs-primary)]/50 bg-[var(--bs-primary)]/40" />
                  <span className="h-3.5 w-3.5 rounded border border-[var(--bs-primary)] bg-[var(--bs-primary-strong)]" />
                </div>
                <span className="inline-flex items-center gap-1"><Flame className="h-3.5 w-3.5" aria-hidden="true" /> أعلى ذروة</span>
              </div>
            </div>

            {/* Heatmap Grid — contained horizontal scroll on small screens */}
            <div className="overflow-x-auto pt-5">
              <div className="min-w-[680px] space-y-1.5">
                {/* Header Row: Hours */}
                <div className="flex items-center gap-1.5 border-b border-[var(--bs-border)]/60 pb-1.5 text-[11px] text-[var(--bs-text-muted)]">
                  <div className="w-24 shrink-0 font-bold text-[var(--bs-text)]">اليوم / الساعة</div>
                  {HOURS_RANGE.map((h) => (
                    <div key={h} className="flex-1 text-center">
                      {formatTime12(h)}
                    </div>
                  ))}
                </div>

                {/* Days Rows */}
                {WEEKDAYS_AR.map((dayName, dow) => (
                  <div key={dayName} className="flex items-center gap-1.5">
                    <div className="w-24 shrink-0 text-xs font-bold text-[var(--bs-text)]">
                      {dayName}
                    </div>

                    {HOURS_RANGE.map((h) => {
                      const match = data.peak_hours.find((c) => c.day_of_week === dow && c.hour === h);
                      const count = match ? match.count : 0;
                      const cellColor = getHeatmapColor(count);

                      return (
                        <div
                          key={h}
                          title={`${dayName} الساعة ${formatTime12(h)} — ${count} حجز`}
                          className={`group relative flex h-10 flex-1 cursor-default items-center justify-center rounded-lg border text-xs transition-all hover:scale-105 ${cellColor}`}
                        >
                          <span>{count > 0 ? count : ""}</span>

                          {/* Hover Tooltip — token background, legible in both modes */}
                          <div className="pointer-events-none absolute -top-8 z-30 hidden whitespace-nowrap rounded-md border border-[var(--bs-border-strong)] bg-[var(--bs-surface)] px-2 py-1 text-[10px] text-[var(--bs-text)] shadow-xl group-hover:block">
                            {count} {count === 1 ? "حجز" : "حجوزات"} ({dayName} {formatTime12(h)})
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
