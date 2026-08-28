"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { getOwnerToken } from "@/lib/auth";
import { WEEKDAYS_AR, formatTime12 } from "@/lib/time";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toaster";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Banknote,
  CalendarDays,
  Receipt,
  UserX,
  Download,
  Table2,
  Flame,
  TrendingUp,
  X,
} from "lucide-react";

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
    if (count === 0) return "bg-[var(--bs-surface-raised)]/60 border-[var(--bs-border)]/60 text-[var(--bs-text-faint)]";
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
    <div className="space-y-8">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--bs-border)] bg-[var(--bs-primary-soft)] text-[var(--bs-primary)]">
              <TrendingUp className="h-5 w-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--bs-text)]">
              التقارير المالية وساعات الذروة
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-[var(--bs-text-muted)]">
            تحليل شامل للإيرادات، أداء الحلاقين، الخدمات الأكثر طلباً، وخريطة الكثافة وساعات الذروة.
          </p>
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
      </div>

      {/* ── Period Filter Tabs ── */}
      <Card className="flex flex-wrap items-center justify-between gap-4 p-2 shadow-sm">
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: "today", label: "اليوم" },
            { key: "this_week", label: "هذا الأسبوع" },
            { key: "this_month", label: "هذا الشهر" },
            { key: "week", label: "آخر 7 أيام" },
            { key: "month", label: "آخر 30 يوم" },
            { key: "custom", label: "فترة مخصصة 🗓️" },
          ].map((t) => (
            <Button
              key={t.key}
              type="button"
              size="sm"
              variant={period === t.key ? "default" : "ghost"}
              onClick={() => setPeriod(t.key as any)}
              className="px-4"
            >
              {t.label}
            </Button>
          ))}
        </div>

        {/* Custom Date Range Selectors */}
        {period === "custom" && (
          <div className="flex flex-wrap items-center gap-3 px-2">
            <div className="flex items-center gap-2">
              <label className="text-xs text-[var(--bs-text-muted)]">من:</label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-8 w-auto px-3 py-1.5 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-[var(--bs-text-muted)]">إلى:</label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-8 w-auto px-3 py-1.5 text-xs"
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 px-2">
          {(period !== "this_month" || fromDate !== weekAgo || toDate !== today) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
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

          {data && (
            <div className="text-xs text-[var(--bs-text-faint)]">
              الفترة المحددة: <span className="font-mono text-[var(--bs-text-muted)]">{data.from}</span> إلى <span className="font-mono text-[var(--bs-text-muted)]">{data.to}</span>
            </div>
          )}
        </div>
      </Card>

      {error && (
        <div className="rounded-xl border border-[var(--bs-error)]/40 bg-[var(--bs-error-soft)] p-4 text-sm text-[var(--bs-error)] flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="text-xs text-[var(--bs-error)] underline opacity-80 hover:opacity-100">
            إغلاق
          </button>
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-[var(--bs-border)] bg-[var(--bs-surface)]/50 p-16 text-center">
          <Spinner size="lg" label="جاري تجميع وتحليل البيانات المالية…" />
        </div>
      )}

      {!loading && data && (
        <div className="space-y-8 animate-in fade-in">
          {/* ═══════ 1. KPI Summary Cards (StatCard) ═══════ */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={<Banknote className="h-5 w-5" />}
              label="إجمالي الإيرادات"
              value={
                <>
                  {data.summary.total_revenue.toLocaleString()}{" "}
                  <span className="text-base font-bold text-[var(--bs-text-muted)]">د.أ</span>
                </>
              }
              hint={`منها ${data.summary.completed_revenue.toLocaleString()} د.أ محصلة فعلياً`}
            />
            <StatCard
              icon={<CalendarDays className="h-5 w-5" />}
              label="إجمالي الحجوزات"
              value={
                <>
                  {data.summary.total_bookings}{" "}
                  <span className="text-base font-normal text-[var(--bs-text-muted)]">حجز</span>
                </>
              }
              hint={`${data.summary.completed_count} مكتمل • ${data.summary.confirmed_count} قادم`}
            />
            <StatCard
              icon={<Receipt className="h-5 w-5" />}
              label="متوسط قيمة الفاتورة"
              value={
                <>
                  {data.summary.avg_ticket}{" "}
                  <span className="text-base font-normal text-[var(--bs-text-muted)]">د.أ</span>
                </>
              }
              hint="متوسط الإيراد المتوقع لكل زبون"
            />
            <StatCard
              icon={<UserX className="h-5 w-5" />}
              label="الإلغاء وعدم الحضور"
              value={
                <span className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-[var(--bs-error)]">{data.summary.cancelled_count} ملغي</span>
                  <span className="text-[var(--bs-text-faint)]">/</span>
                  <span className="text-base font-semibold text-[var(--bs-warning)]">{data.summary.no_show_count} غياب</span>
                </span>
              }
              hint={`معدل الالتزام: ${
                data.summary.total_bookings > 0
                  ? `${Math.round(
                      ((data.summary.completed_count + data.summary.confirmed_count) /
                        data.summary.total_bookings) *
                        100
                    )}%`
                  : "100%"
              }`}
            />
          </div>

          {/* ═══════ 2. Barber Revenue & Service Performance ═══════ */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Barber Breakdown */}
            <Card className="space-y-4 p-6 shadow-lg">
              <div className="flex items-center justify-between border-b border-[var(--bs-border)] pb-3">
                <h2 className="flex items-center gap-2 text-base font-bold text-[var(--bs-text)]">
                  💈 الإيرادات حسب الحلاق
                </h2>
                <span className="text-xs text-[var(--bs-text-muted)]">
                  {data.revenue_by_barber.length} حلاقين
                </span>
              </div>

              {data.revenue_by_barber.length === 0 ? (
                <p className="py-6 text-center text-xs text-[var(--bs-text-faint)]">لا توجد بيانات لهذه الفترة</p>
              ) : (
                <div className="space-y-3">
                  {data.revenue_by_barber.map((b) => {
                    const pct =
                      data.summary.total_revenue > 0
                        ? Math.round((b.revenue / data.summary.total_revenue) * 100)
                        : 0;

                    return (
                      <div key={b.barber_id} className="space-y-1.5 rounded-xl border border-[var(--bs-border)]/80 bg-[var(--bs-bg)]/60 p-3.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {b.photo_url ? (
                              <img
                                src={b.photo_url}
                                alt={b.barber_name}
                                className="h-9 w-9 rounded-full border border-[var(--bs-primary)]/40 object-cover"
                              />
                            ) : (
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bs-surface-raised)] text-sm">
                                💈
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-bold text-[var(--bs-text)]">{b.barber_name}</p>
                              <p className="text-xs text-[var(--bs-text-muted)]">
                                {b.bookings_count} حجز ({b.completed_count} منجز)
                              </p>
                            </div>
                          </div>

                          <div className="text-left">
                            <p className="font-mono text-sm font-bold text-[var(--bs-primary)]">{b.revenue} د.أ</p>
                            <p className="text-[11px] text-[var(--bs-text-faint)]">{pct}% من الإجمالي</p>
                          </div>
                        </div>

                        {/* Progress Bar — gold data color */}
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bs-surface-raised)]">
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
            </Card>

            {/* Service Breakdown */}
            <Card className="space-y-4 p-6 shadow-lg">
              <div className="flex items-center justify-between border-b border-[var(--bs-border)] pb-3">
                <h2 className="flex items-center gap-2 text-base font-bold text-[var(--bs-text)]">
                  ✂️ الخدمات الأكثر طلباً وإيراداً
                </h2>
                <span className="text-xs text-[var(--bs-text-muted)]">
                  {data.revenue_by_service.length} خدمات مسجلة
                </span>
              </div>

              {data.revenue_by_service.length === 0 ? (
                <p className="py-6 text-center text-xs text-[var(--bs-text-faint)]">لا توجد بيانات لهذه الفترة</p>
              ) : (
                <div className="space-y-2">
                  {data.revenue_by_service.map((s, idx) => (
                    <div
                      key={s.service_name}
                      className="flex items-center justify-between rounded-xl border border-[var(--bs-border)]/80 bg-[var(--bs-bg)]/60 p-3 transition hover:border-[var(--bs-border-strong)]"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--bs-surface-raised)] text-xs font-bold text-[var(--bs-primary)]">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-[var(--bs-text)]">{s.service_name}</p>
                          <p className="text-xs text-[var(--bs-text-muted)]">تم طلبها {s.count} مرة</p>
                        </div>
                      </div>

                      <div className="text-left">
                        <span className="font-mono text-sm font-bold text-[var(--bs-primary)]">{s.revenue} د.أ</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* ═══════ 3. Peak Hours Heatmap (خريطة ساعات الذروة) ═══════ */}
          <Card className="space-y-5 p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--bs-border)] pb-4">
              <div>
                <h2 className="flex items-center gap-2 text-base sm:text-lg font-bold text-[var(--bs-text)]">
                  <Flame className="h-5 w-5 text-[var(--bs-primary)]" /> خريطة الكثافة وساعات الذروة (Heatmap)
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
                <span>أعلى ذروة 🔥</span>
              </div>
            </div>

            {/* Heatmap Grid */}
            <div className="overflow-x-auto pb-2">
              <div className="min-w-[650px] space-y-2">
                {/* Header Row: Hours */}
                <div className="flex items-center gap-1.5 border-b border-[var(--bs-border)]/60 pb-1 font-mono text-xs text-[var(--bs-text-muted)]">
                  <div className="w-24 shrink-0 font-sans font-bold text-[var(--bs-text)]">اليوم / الساعة</div>
                  {HOURS_RANGE.map((h) => (
                    <div key={h} className="flex-1 text-center font-medium">
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
                          className={`group relative flex h-10 flex-1 cursor-default items-center justify-center rounded-xl border font-mono text-xs transition-all hover:scale-105 ${cellColor}`}
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
          </Card>
        </div>
      )}
    </div>
  );
}
