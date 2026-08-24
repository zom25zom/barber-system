"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { getOwnerToken } from "@/lib/auth";
import { WEEKDAYS_AR } from "@/lib/time";
import Spinner from "@/components/Spinner";

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
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [period, setPeriod] = useState<"today" | "week" | "month" | "custom">("month");
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
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token, period, fromDate, toDate]);

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
  };

  // Export Peak Hours Matrix to CSV
  const exportPeakHoursCSV = () => {
    if (!data) return;

    const header = ["اليوم", ...HOURS_RANGE.map((h) => `${h}:00`)];
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
  };

  // Calculate heatmap max count for dynamic color scaling
  const maxPeakCount = data?.peak_hours.reduce((max, c) => Math.max(max, c.count), 0) || 1;

  const getHeatmapColor = (count: number) => {
    if (count === 0) return "bg-zinc-950/60 border-zinc-800/60 text-zinc-600";
    const ratio = count / maxPeakCount;
    if (ratio < 0.25) return "bg-amber-950/40 border-amber-800/40 text-amber-300";
    if (ratio < 0.5) return "bg-amber-700/40 border-amber-600/50 text-amber-200";
    if (ratio < 0.75) return "bg-amber-600/60 border-amber-500/70 text-amber-100 font-bold";
    return "bg-amber-500 border-amber-400 text-zinc-950 font-black shadow-md shadow-amber-500/20";
  };

  return (
    <div className="space-y-8">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">📈</span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-100">
              التقارير المالية وساعات الذروة
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            تحليل شامل للإيرادات، أداء الحلاقين، الخدمات الأكثر طلباً، وخريطة الكثافة وساعات الذروة.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportFinancialCSV}
            disabled={loading || !data}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-2.5 text-xs font-bold text-zinc-200 hover:bg-zinc-700 hover:text-white transition active:scale-95 disabled:opacity-50 shadow-sm"
          >
            <span>📥</span>
            <span>تصدير المالي (Excel)</span>
          </button>
          <button
            type="button"
            onClick={exportPeakHoursCSV}
            disabled={loading || !data}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-2.5 text-xs font-bold text-zinc-200 hover:bg-zinc-700 hover:text-white transition active:scale-95 disabled:opacity-50 shadow-sm"
          >
            <span>📊</span>
            <span>تصدير الذروة (CSV)</span>
          </button>
        </div>
      </div>

      {/* ── Period Filter Tabs ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-2 shadow-sm">
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: "today", label: "اليوم" },
            { key: "week", label: "آخر 7 أيام" },
            { key: "month", label: "آخر 30 يوم" },
            { key: "custom", label: "فترة مخصصة 🗓️" },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setPeriod(t.key as any)}
              className={`rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-all ${
                period === t.key
                  ? "bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Custom Date Range Selectors */}
        {period === "custom" && (
          <div className="flex flex-wrap items-center gap-3 px-2">
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-400">من:</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-400">إلى:</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 outline-none focus:border-amber-500"
              />
            </div>
          </div>
        )}

        {data && (
          <div className="text-xs text-zinc-500 px-3">
            الفترة المحددة: <span className="font-mono text-zinc-300">{data.from}</span> إلى <span className="font-mono text-zinc-300">{data.to}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-400 flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="text-xs text-red-300 hover:underline">
            إغلاق
          </button>
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-16 text-center">
          <Spinner size="lg" label="جاري تجميع وتحليل البيانات المالية…" />
        </div>
      )}

      {!loading && data && (
        <div className="space-y-8 animate-in fade-in">
          {/* ═══════ 1. KPI Summary Cards ═══════ */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Revenue */}
            <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-zinc-900 to-zinc-950 p-5 shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-amber-400/90">إجمالي الإيرادات</span>
                <span className="text-xl">💰</span>
              </div>
              <p className="mt-3 text-2xl sm:text-3xl font-black text-amber-400 font-mono">
                {data.summary.total_revenue.toLocaleString()} <span className="text-base font-bold text-zinc-400">د.أ</span>
              </p>
              <p className="mt-1 text-[11px] text-zinc-400">
                منها {data.summary.completed_revenue.toLocaleString()} د.أ محصلة فعلياً
              </p>
            </div>

            {/* Total Bookings */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-zinc-400">إجمالي الحجوزات</span>
                <span className="text-xl">📅</span>
              </div>
              <p className="mt-3 text-2xl sm:text-3xl font-black text-zinc-100 font-mono">
                {data.summary.total_bookings} <span className="text-base font-normal text-zinc-400">حجز</span>
              </p>
              <div className="mt-1 flex items-center gap-2 text-[11px]">
                <span className="text-emerald-400 font-bold">{data.summary.completed_count} مكتمل</span>
                <span className="text-zinc-600">•</span>
                <span className="text-amber-400">{data.summary.confirmed_count} قادم</span>
              </div>
            </div>

            {/* Average Ticket */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-zinc-400">متوسط قيمة الفاتورة</span>
                <span className="text-xl">🧾</span>
              </div>
              <p className="mt-3 text-2xl sm:text-3xl font-black text-zinc-100 font-mono">
                {data.summary.avg_ticket} <span className="text-base font-normal text-zinc-400">د.أ</span>
              </p>
              <p className="mt-1 text-[11px] text-zinc-400">
                متوسط الإيراد المتوقع لكل زبون
              </p>
            </div>

            {/* Cancellations & No Shows */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-zinc-400">الإلغاء وعدم الحضور</span>
                <span className="text-xl">🚫</span>
              </div>
              <div className="mt-3 flex items-baseline gap-3">
                <span className="text-2xl font-bold text-red-400 font-mono">{data.summary.cancelled_count} ملغي</span>
                <span className="text-zinc-600">/</span>
                <span className="text-lg font-semibold text-orange-400 font-mono">{data.summary.no_show_count} غياب</span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-400">
                معدل الالتزام بالحضور:{" "}
                <span className="font-bold text-emerald-400">
                  {data.summary.total_bookings > 0
                    ? `${Math.round(
                        ((data.summary.completed_count + data.summary.confirmed_count) /
                          data.summary.total_bookings) *
                          100
                      )}%`
                    : "100%"}
                </span>
              </p>
            </div>
          </div>

          {/* ═══════ 2. Barber Revenue & Service Performance ═══════ */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Barber Breakdown */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 space-y-4 shadow-lg">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                  <span>💈</span> الإيرادات حسب الحلاق
                </h2>
                <span className="text-xs text-zinc-400">
                  {data.revenue_by_barber.length} حلاقين
                </span>
              </div>

              {data.revenue_by_barber.length === 0 ? (
                <p className="text-center py-6 text-xs text-zinc-500">لا توجد بيانات لهذه الفترة</p>
              ) : (
                <div className="space-y-3">
                  {data.revenue_by_barber.map((b) => {
                    const pct =
                      data.summary.total_revenue > 0
                        ? Math.round((b.revenue / data.summary.total_revenue) * 100)
                        : 0;

                    return (
                      <div key={b.barber_id} className="space-y-1.5 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {b.photo_url ? (
                              <img
                                src={b.photo_url}
                                alt={b.barber_name}
                                className="h-9 w-9 rounded-full object-cover border border-amber-500/40"
                              />
                            ) : (
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-sm">
                                💈
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-bold text-zinc-100">{b.barber_name}</p>
                              <p className="text-xs text-zinc-400">
                                {b.bookings_count} حجز ({b.completed_count} منجز)
                              </p>
                            </div>
                          </div>

                          <div className="text-left">
                            <p className="text-sm font-bold text-amber-400 font-mono">{b.revenue} د.أ</p>
                            <p className="text-[11px] text-zinc-500">{pct}% من الإجمالي</p>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-amber-500 transition-all duration-500"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Service Breakdown */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 space-y-4 shadow-lg">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                  <span>✂️</span> الخدمات الأكثر طلباً وإيراداً
                </h2>
                <span className="text-xs text-zinc-400">
                  {data.revenue_by_service.length} خدمات مسجلة
                </span>
              </div>

              {data.revenue_by_service.length === 0 ? (
                <p className="text-center py-6 text-xs text-zinc-500">لا توجد بيانات لهذه الفترة</p>
              ) : (
                <div className="space-y-2">
                  {data.revenue_by_service.map((s, idx) => (
                    <div
                      key={s.service_name}
                      className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3 hover:border-zinc-700 transition"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-800 text-xs font-bold text-amber-400">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-zinc-200">{s.service_name}</p>
                          <p className="text-xs text-zinc-400">تم طلبها {s.count} مرة</p>
                        </div>
                      </div>

                      <div className="text-left">
                        <span className="text-sm font-bold text-amber-400 font-mono">{s.revenue} د.أ</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ═══════ 3. Peak Hours Heatmap (خريطة ساعات الذروة) ═══════ */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 space-y-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-zinc-100 flex items-center gap-2">
                  <span>🔥</span> خريطة الكثافة وساعات الذروة (Heatmap)
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  توزيع الحجوزات الفعلية عبر أيام الأسبوع وساعات العمل لمساعدتك في تنظيم طاقم الحلاقين.
                </p>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                <span>أقل كثافة</span>
                <div className="flex items-center gap-1">
                  <span className="h-3.5 w-3.5 rounded bg-zinc-950 border border-zinc-800" />
                  <span className="h-3.5 w-3.5 rounded bg-amber-950/60 border border-amber-800/50" />
                  <span className="h-3.5 w-3.5 rounded bg-amber-700/50 border border-amber-600/50" />
                  <span className="h-3.5 w-3.5 rounded bg-amber-500 border border-amber-400" />
                </div>
                <span>أعلى ذروة 🔥</span>
              </div>
            </div>

            {/* Heatmap Grid */}
            <div className="overflow-x-auto pb-2">
              <div className="min-w-[650px] space-y-2">
                {/* Header Row: Hours */}
                <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono pb-1 border-b border-zinc-800/60">
                  <div className="w-24 shrink-0 font-sans font-bold text-zinc-300">اليوم / الساعة</div>
                  {HOURS_RANGE.map((h) => (
                    <div key={h} className="flex-1 text-center font-medium">
                      {h}:00
                    </div>
                  ))}
                </div>

                {/* Days Rows */}
                {WEEKDAYS_AR.map((dayName, dow) => (
                  <div key={dayName} className="flex items-center gap-1.5">
                    <div className="w-24 shrink-0 text-xs font-bold text-zinc-300">
                      {dayName}
                    </div>

                    {HOURS_RANGE.map((h) => {
                      const match = data.peak_hours.find((c) => c.day_of_week === dow && c.hour === h);
                      const count = match ? match.count : 0;
                      const cellColor = getHeatmapColor(count);

                      return (
                        <div
                          key={h}
                          title={`${dayName} الساعة ${h}:00 — ${count} حجز`}
                          className={`group relative flex-1 flex h-10 items-center justify-center rounded-xl border text-xs font-mono transition-all hover:scale-105 cursor-default ${cellColor}`}
                        >
                          <span>{count > 0 ? count : ""}</span>

                          {/* Hover Tooltip */}
                          <div className="pointer-events-none absolute -top-8 z-30 hidden rounded-md bg-zinc-950 border border-zinc-700 px-2 py-1 text-[10px] text-zinc-100 whitespace-nowrap shadow-xl group-hover:block">
                            {count} {count === 1 ? "حجز" : "حجوزات"} ({dayName} {h}:00)
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
