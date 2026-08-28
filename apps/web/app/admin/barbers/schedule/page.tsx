"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { getOwnerToken } from "@/lib/auth";
import { WEEKDAYS_AR, formatTime12 } from "@/lib/time";
import Spinner from "@/components/Spinner";
import ConfirmModal from "@/components/ConfirmModal";
import { useToast } from "@/components/Toaster";
import type { ScheduleDay, BarberTimeOff, BarberBreak } from "@/lib/types";

const defaultSchedule: ScheduleDay[] = Array.from({ length: 7 }, (_, i) => ({
  day_of_week: i,
  start_time: "09:00",
  end_time: "21:00",
  is_day_off: i === 5, // Friday off by default
}));

/* ============================== MAIN ============================== */

function ScheduleContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const token = getOwnerToken();
  const toast = useToast();

  /* ── Weekly Schedule State ── */
  const [days, setDays] = useState<ScheduleDay[]>(defaultSchedule);
  const [barberName, setBarberName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  /* ── Time Off State ── */
  const [timeOffs, setTimeOffs] = useState<BarberTimeOff[]>([]);
  const [timeOffLoading, setTimeOffLoading] = useState(true);
  const [timeOffDate, setTimeOffDate] = useState("");
  const [timeOffReason, setTimeOffReason] = useState("");
  const [addingTimeOff, setAddingTimeOff] = useState(false);
  const [timeOffError, setTimeOffError] = useState<string | null>(null);
  const [deleteTimeOff, setDeleteTimeOff] = useState<BarberTimeOff | null>(null);
  const [deletingTimeOff, setDeletingTimeOff] = useState(false);

  /* ── Breaks State ── */
  const [breaks, setBreaks] = useState<BarberBreak[]>([]);
  const [breaksLoading, setBreaksLoading] = useState(true);
  const [breakDow, setBreakDow] = useState(0);
  const [breakStart, setBreakStart] = useState("12:00");
  const [breakEnd, setBreakEnd] = useState("13:00");
  const [addingBreak, setAddingBreak] = useState(false);
  const [breakError, setBreakError] = useState<string | null>(null);
  const [deleteBreak, setDeleteBreak] = useState<BarberBreak | null>(null);
  const [deletingBreak, setDeletingBreak] = useState(false);

  /* ── Active tab ── */
  const [activeTab, setActiveTab] = useState<"schedule" | "timeoff" | "breaks">("schedule");

  /* ===== Load Data ===== */

  const loadSchedule = useCallback(() => {
    if (!token || !id) return;
    apiFetch<{ schedule: ScheduleDay[] }>(`/api/owner/barbers/${id}/schedule`, { token })
      .then((d) => {
        if (d.schedule.length > 0) {
          const merged = defaultSchedule.map((def) => {
            const found = d.schedule.find((s) => s.day_of_week === def.day_of_week);
            return found ? { ...found, is_day_off: !!found.is_day_off } : def;
          });
          setDays(merged);
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
    apiFetch<{ barbers: { id: number; name: string }[] }>("/api/owner/barbers", { token }).then(
      (d) => {
        const b = d.barbers.find((b) => b.id === Number(id));
        if (b) setBarberName(b.name);
      }
    );
  }, [token, id]);

  const loadTimeOffs = useCallback(() => {
    if (!token || !id) return;
    setTimeOffLoading(true);
    apiFetch<{ time_off: BarberTimeOff[] }>(`/api/owner/barbers/${id}/time-off`, { token })
      .then((d) => setTimeOffs(d.time_off))
      .catch(() => {})
      .finally(() => setTimeOffLoading(false));
  }, [token, id]);

  const loadBreaks = useCallback(() => {
    if (!token || !id) return;
    setBreaksLoading(true);
    apiFetch<{ breaks: BarberBreak[] }>(`/api/owner/barbers/${id}/breaks`, { token })
      .then((d) => setBreaks(d.breaks))
      .catch(() => {})
      .finally(() => setBreaksLoading(false));
  }, [token, id]);

  useEffect(() => {
    loadSchedule();
    loadTimeOffs();
    loadBreaks();
  }, [loadSchedule, loadTimeOffs, loadBreaks]);

  /* ===== No ID Guard ===== */
  if (!id) {
    return (
      <div className="space-y-4">
        <p className="text-[var(--bs-error)]">لم يتم تحديد الحلاق.</p>
        <Link href="/admin/barbers" className="text-[var(--bs-primary)] underline">العودة للحلاقين</Link>
      </div>
    );
  }

  /* ===== Schedule Handlers ===== */

  function updateDay(dow: number, field: keyof ScheduleDay, value: string | boolean) {
    setDays((prev) =>
      prev.map((d) => (d.day_of_week === dow ? { ...d, [field]: value } : d))
    );
    setSuccess(false);
  }

  async function saveSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await apiFetch(`/api/owner/barbers/${id}/schedule`, {
        method: "PUT",
        token,
        body: {
          days: days.map((d) => ({
            day_of_week: d.day_of_week,
            start_time: d.start_time,
            end_time: d.end_time,
            is_day_off: d.is_day_off,
          })),
        },
      });
      setSuccess(true);
      toast.success("تم حفظ وتحديث جدول العمل بنجاح ✓");
    } catch (err) {
      const msg = (err as Error).message || "حدث خطأ أثناء حفظ جدول العمل، يرجى المحاولة ثانية";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  /* ===== Time Off Handlers ===== */

  async function handleAddTimeOff(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setAddingTimeOff(true);
    setTimeOffError(null);
    try {
      await apiFetch(`/api/owner/barbers/${id}/time-off`, {
        method: "POST",
        token,
        body: { date: timeOffDate, reason: timeOffReason || null },
      });
      setTimeOffDate("");
      setTimeOffReason("");
      toast.success("تمت إضافة الإجازة بنجاح ✓");
      loadTimeOffs();
    } catch (err) {
      const msg = (err as Error).message || "حدث خطأ أثناء إضافة الإجازة";
      setTimeOffError(msg);
      toast.error(msg);
    } finally {
      setAddingTimeOff(false);
    }
  }

  async function confirmDeleteTimeOff() {
    if (!token || !deleteTimeOff) return;
    setDeletingTimeOff(true);
    try {
      await apiFetch(`/api/owner/barbers/${id}/time-off/${deleteTimeOff.id}`, {
        method: "DELETE",
        token,
      });
      setDeleteTimeOff(null);
      toast.success("تم حذف الإجازة بنجاح ✓");
      loadTimeOffs();
    } catch (err) {
      const msg = (err as Error).message || "حدث خطأ أثناء حذف الإجازة";
      setTimeOffError(msg);
      toast.error(msg);
      setDeleteTimeOff(null);
    } finally {
      setDeletingTimeOff(false);
    }
  }

  /* ===== Break Handlers ===== */

  async function handleAddBreak(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setAddingBreak(true);
    setBreakError(null);
    try {
      await apiFetch(`/api/owner/barbers/${id}/breaks`, {
        method: "POST",
        token,
        body: { day_of_week: breakDow, start_time: breakStart, end_time: breakEnd },
      });
      setBreakStart("12:00");
      setBreakEnd("13:00");
      toast.success("تمت إضافة فترة الاستراحة بنجاح ✓");
      loadBreaks();
    } catch (err) {
      const msg = (err as Error).message || "حدث خطأ أثناء إضافة فترة الاستراحة";
      setBreakError(msg);
      toast.error(msg);
    } finally {
      setAddingBreak(false);
    }
  }

  async function confirmDeleteBreak() {
    if (!token || !deleteBreak) return;
    setDeletingBreak(true);
    try {
      await apiFetch(`/api/owner/barbers/${id}/breaks/${deleteBreak.id}`, {
        method: "DELETE",
        token,
      });
      setDeleteBreak(null);
      toast.success("تم حذف فترة الاستراحة بنجاح ✓");
      loadBreaks();
    } catch (err) {
      const msg = (err as Error).message || "حدث خطأ أثناء حذف الاستراحة";
      setBreakError(msg);
      toast.error(msg);
      setDeleteBreak(null);
    } finally {
      setDeletingBreak(false);
    }
  }

  /* ===== Helpers ===== */

  // Group breaks by day_of_week
  const breaksByDay = breaks.reduce<Record<number, BarberBreak[]>>((acc, b) => {
    if (!acc[b.day_of_week]) acc[b.day_of_week] = [];
    acc[b.day_of_week].push(b);
    return acc;
  }, {});

  // Filter future time-offs vs past — "today" computed post-mount to avoid
  // hydration mismatch (#418): build-time HTML would bake a stale date
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(new Date().toISOString().slice(0, 10));
  }, []);
  const futureTimeOffs = today ? timeOffs.filter((t) => t.date >= today) : [];
  const pastTimeOffs = today ? timeOffs.filter((t) => t.date < today) : [];

  /* ===== Tabs ===== */
  const tabs = [
    { key: "schedule" as const, label: "📅 جدول العمل الأسبوعي" },
    { key: "timeoff" as const, label: `🏖️ الإجازات (${futureTimeOffs.length})` },
    { key: "breaks" as const, label: `☕ الاستراحات (${breaks.length})` },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/barbers"
          className="rounded-xl border border-[var(--bs-border-strong)] bg-[var(--bs-surface-raised)]/60 px-3.5 py-2 text-sm text-[var(--bs-text-muted)] hover:bg-[var(--bs-surface-raised)] hover:text-white transition"
        >
          ← العودة للحلاقين
        </Link>
        <h1 className="text-2xl font-bold text-[var(--bs-text)]">
          جدول عمل {barberName ? `الحلاق ${barberName}` : `الحلاق #${id}`}
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 rounded-2xl border border-[var(--bs-border)] bg-[var(--bs-surface)]/50 p-1.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 min-w-[120px] rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
              activeTab === t.key
                ? "bg-[var(--bs-primary)] text-[var(--bs-on-primary)] shadow-lg shadow-[var(--bs-primary)]/20"
                : "text-[var(--bs-text-muted)] hover:text-[var(--bs-text)] hover:bg-[var(--bs-surface-raised)]/60"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ========== TAB 1: Weekly Schedule ========== */}
      {activeTab === "schedule" && (
        <div className="space-y-4">
          {error && (
            <div className="rounded-xl border border-[var(--bs-error)]/40 bg-[var(--bs-error-soft)] p-4 text-sm text-[var(--bs-error)] flex items-center justify-between">
              <span>⚠️ {error}</span>
              <button onClick={() => setError(null)} className="text-xs text-[var(--bs-error)] hover:underline">إغلاق</button>
            </div>
          )}

          {success && (
            <div className="rounded-xl border border-[var(--bs-success)]/40 bg-[var(--bs-success-soft)] p-4 text-sm text-[var(--bs-success)] flex items-center justify-between">
              <span>✨ تم حفظ وتحديث جدول العمل بنجاح!</span>
              <button onClick={() => setSuccess(false)} className="text-xs text-[var(--bs-success)] hover:underline">إغلاق</button>
            </div>
          )}

          {loading && (
            <div className="rounded-2xl border border-[var(--bs-border)] bg-[var(--bs-surface)]/50 p-12 text-center">
              <Spinner size="lg" label="جاري تحميل جدول العمل…" />
            </div>
          )}

          {!loading && (
            <form onSubmit={saveSchedule} className="space-y-3">
              {days.map((d) => (
                <div
                  key={d.day_of_week}
                  className={`flex flex-wrap items-center gap-4 rounded-2xl border p-4 transition-colors ${
                    d.is_day_off
                      ? "border-[var(--bs-border)]/60 bg-[var(--bs-surface)]/40 opacity-60"
                      : "border-[var(--bs-border)] bg-[var(--bs-surface)] shadow-sm"
                  }`}
                >
                  <span className="w-20 text-sm font-bold text-[var(--bs-primary)]">
                    {WEEKDAYS_AR[d.day_of_week]}
                  </span>

                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={d.is_day_off}
                      onChange={(e) => updateDay(d.day_of_week, "is_day_off", e.target.checked)}
                      className="h-4 w-4 accent-[var(--bs-primary)]"
                    />
                    <span className="text-sm text-[var(--bs-text-muted)]">إجازة أسبوعية</span>
                  </label>

                  {!d.is_day_off && (
                    <div className="flex flex-1 items-center gap-3">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-[var(--bs-text-muted)]">من</label>
                        <input
                          type="time"
                          value={d.start_time}
                          onChange={(e) => updateDay(d.day_of_week, "start_time", e.target.value)}
                          className="rounded-xl border border-[var(--bs-border-strong)] bg-[var(--bs-bg)] px-3 py-1.5 text-sm text-[var(--bs-text)] outline-none focus:border-[var(--bs-primary)]"
                        />
                        <span className="text-xs text-[var(--bs-text-muted)] font-medium">{formatTime12(d.start_time)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-[var(--bs-text-muted)]">إلى</label>
                        <input
                          type="time"
                          value={d.end_time}
                          onChange={(e) => updateDay(d.day_of_week, "end_time", e.target.value)}
                          className="rounded-xl border border-[var(--bs-border-strong)] bg-[var(--bs-bg)] px-3 py-1.5 text-sm text-[var(--bs-text)] outline-none focus:border-[var(--bs-primary)]"
                        />
                        <span className="text-xs text-[var(--bs-text-muted)] font-medium">{formatTime12(d.end_time)}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--bs-primary)] px-8 py-3 font-bold text-[var(--bs-on-primary)] hover:bg-[var(--bs-primary-strong)] disabled:opacity-50 shadow-md transition active:scale-98"
                >
                  {saving ? (
                    <>
                      <Spinner size="sm" color="zinc" />
                      <span>جاري حفظ الجدول…</span>
                    </>
                  ) : (
                    "💾 حفظ جدول العمل"
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ========== TAB 2: Time Off ========== */}
      {activeTab === "timeoff" && (
        <div className="space-y-5">
          {/* Add Time Off Form */}
          <div className="rounded-2xl border border-[var(--bs-border)] bg-[var(--bs-surface)]/50 p-5 space-y-4">
            <h3 className="text-lg font-bold text-[var(--bs-text)] flex items-center gap-2">
              🏖️ إضافة إجازة جديدة
            </h3>
            <p className="text-sm text-[var(--bs-text-muted)]">
              حدد تاريخ إجازة محدد للحلاق. سيتم حجب هذا اليوم تلقائياً من الحجوزات المتاحة.
            </p>

            {timeOffError && (
              <div className="rounded-xl border border-[var(--bs-error)]/40 bg-[var(--bs-error-soft)] p-3 text-sm text-[var(--bs-error)] flex items-center justify-between">
                <span>⚠️ {timeOffError}</span>
                <button onClick={() => setTimeOffError(null)} className="text-xs text-[var(--bs-error)] hover:underline">إغلاق</button>
              </div>
            )}

            <form onSubmit={handleAddTimeOff} className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[var(--bs-text-muted)] font-medium">التاريخ</label>
                <input
                  type="date"
                  required
                  value={timeOffDate}
                  onChange={(e) => setTimeOffDate(e.target.value)}
                  min={today}
                  className="rounded-xl border border-[var(--bs-border-strong)] bg-[var(--bs-bg)] px-4 py-2 text-sm text-[var(--bs-text)] outline-none focus:border-[var(--bs-primary)]"
                />
              </div>
              <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
                <label className="text-xs text-[var(--bs-text-muted)] font-medium">السبب (اختياري)</label>
                <input
                  type="text"
                  value={timeOffReason}
                  onChange={(e) => setTimeOffReason(e.target.value)}
                  placeholder="مثال: إجازة شخصية"
                  maxLength={120}
                  className="rounded-xl border border-[var(--bs-border-strong)] bg-[var(--bs-bg)] px-4 py-2 text-sm text-[var(--bs-text)] outline-none focus:border-[var(--bs-primary)] placeholder:text-[var(--bs-text-faint)]"
                />
              </div>
              <button
                type="submit"
                disabled={addingTimeOff || !timeOffDate}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--bs-primary)] px-6 py-2.5 font-bold text-[var(--bs-on-primary)] hover:bg-[var(--bs-primary-strong)] disabled:opacity-50 shadow-md transition active:scale-95"
              >
                {addingTimeOff ? (
                  <>
                    <Spinner size="sm" color="zinc" />
                    <span>جاري الإضافة…</span>
                  </>
                ) : (
                  "➕ إضافة إجازة"
                )}
              </button>
            </form>
          </div>

          {/* Time Off List */}
          {timeOffLoading ? (
            <div className="rounded-2xl border border-[var(--bs-border)] bg-[var(--bs-surface)]/50 p-8 text-center">
              <Spinner size="md" label="جاري تحميل الإجازات…" />
            </div>
          ) : futureTimeOffs.length === 0 && pastTimeOffs.length === 0 ? (
            <div className="rounded-2xl border border-[var(--bs-border)]/60 bg-[var(--bs-surface)]/30 p-8 text-center">
              <p className="text-[var(--bs-text-faint)] text-sm">لا توجد إجازات مسجلة حالياً</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Upcoming */}
              {futureTimeOffs.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-[var(--bs-primary)]">📌 إجازات قادمة ({futureTimeOffs.length})</h4>
                  <div className="space-y-2">
                    {futureTimeOffs.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between rounded-xl border border-[var(--bs-border)] bg-[var(--bs-surface)] p-3.5 hover:border-[var(--bs-border-strong)] transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--bs-primary-soft)] border border-[var(--bs-primary)]/40 text-[var(--bs-primary)] text-lg">
                            🏖️
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[var(--bs-text)]">{t.date}</p>
                            <p className="text-xs text-[var(--bs-text-muted)]">
                              {WEEKDAYS_AR[new Date(t.date + "T00:00:00").getDay()]}
                              {t.reason ? ` — ${t.reason}` : ""}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setDeleteTimeOff(t)}
                          className="rounded-xl border border-[var(--bs-error)]/40 bg-[var(--bs-error-soft)] px-3.5 py-1.5 text-xs font-bold text-[var(--bs-error)] hover:brightness-110 transition"
                        >
                          🗑️ حذف
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Past */}
              {pastTimeOffs.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-[var(--bs-text-faint)]">📋 إجازات سابقة ({pastTimeOffs.length})</h4>
                  <div className="space-y-1">
                    {pastTimeOffs.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between rounded-xl border border-[var(--bs-border)]/40 bg-[var(--bs-surface)]/30 p-3 opacity-60"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-[var(--bs-text-faint)]">{t.date}</span>
                          <span className="text-xs text-[var(--bs-text-faint)]">
                            {WEEKDAYS_AR[new Date(t.date + "T00:00:00").getDay()]}
                            {t.reason ? ` — ${t.reason}` : ""}
                          </span>
                        </div>
                        <button
                          onClick={() => setDeleteTimeOff(t)}
                          className="rounded-lg px-2.5 py-1 text-xs text-[var(--bs-text-faint)] hover:text-[var(--bs-error)] transition"
                        >
                          حذف
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Delete Time Off Confirm Modal */}
          <ConfirmModal
            isOpen={!!deleteTimeOff}
            title="حذف الإجازة"
            message={`هل أنت متأكد من حذف إجازة يوم ${deleteTimeOff?.date || ""}؟ سيتم فتح هذا اليوم للحجوزات مجدداً.`}
            confirmText="حذف الإجازة"
            variant="danger"
            isLoading={deletingTimeOff}
            onConfirm={confirmDeleteTimeOff}
            onClose={() => setDeleteTimeOff(null)}
          />
        </div>
      )}

      {/* ========== TAB 3: Breaks ========== */}
      {activeTab === "breaks" && (
        <div className="space-y-5">
          {/* Add Break Form */}
          <div className="rounded-2xl border border-[var(--bs-border)] bg-[var(--bs-surface)]/50 p-5 space-y-4">
            <h3 className="text-lg font-bold text-[var(--bs-text)] flex items-center gap-2">
              ☕ إضافة فترة استراحة
            </h3>
            <p className="text-sm text-[var(--bs-text-muted)]">
              حدد فترات الاستراحة لكل يوم في الأسبوع. سيتم استثناء هذه الأوقات تلقائياً من المواعيد المتاحة للحجز.
            </p>

            {breakError && (
              <div className="rounded-xl border border-[var(--bs-error)]/40 bg-[var(--bs-error-soft)] p-3 text-sm text-[var(--bs-error)] flex items-center justify-between">
                <span>⚠️ {breakError}</span>
                <button onClick={() => setBreakError(null)} className="text-xs text-[var(--bs-error)] hover:underline">إغلاق</button>
              </div>
            )}

            <form onSubmit={handleAddBreak} className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[var(--bs-text-muted)] font-medium">اليوم</label>
                <select
                  value={breakDow}
                  onChange={(e) => setBreakDow(Number(e.target.value))}
                  className="rounded-xl border border-[var(--bs-border-strong)] bg-[var(--bs-bg)] px-4 py-2 text-sm text-[var(--bs-text)] outline-none focus:border-[var(--bs-primary)]"
                >
                  {WEEKDAYS_AR.map((name, i) => (
                    <option key={i} value={i}>{name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[var(--bs-text-muted)] font-medium">من</label>
                <input
                  type="time"
                  required
                  value={breakStart}
                  onChange={(e) => setBreakStart(e.target.value)}
                  className="rounded-xl border border-[var(--bs-border-strong)] bg-[var(--bs-bg)] px-4 py-2 text-sm text-[var(--bs-text)] outline-none focus:border-[var(--bs-primary)]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[var(--bs-text-muted)] font-medium">إلى</label>
                <input
                  type="time"
                  required
                  value={breakEnd}
                  onChange={(e) => setBreakEnd(e.target.value)}
                  className="rounded-xl border border-[var(--bs-border-strong)] bg-[var(--bs-bg)] px-4 py-2 text-sm text-[var(--bs-text)] outline-none focus:border-[var(--bs-primary)]"
                />
              </div>
              <button
                type="submit"
                disabled={addingBreak}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--bs-primary)] px-6 py-2.5 font-bold text-[var(--bs-on-primary)] hover:bg-[var(--bs-primary-strong)] disabled:opacity-50 shadow-md transition active:scale-95"
              >
                {addingBreak ? (
                  <>
                    <Spinner size="sm" color="zinc" />
                    <span>جاري الإضافة…</span>
                  </>
                ) : (
                  "➕ إضافة استراحة"
                )}
              </button>
            </form>
          </div>

          {/* Breaks List grouped by day */}
          {breaksLoading ? (
            <div className="rounded-2xl border border-[var(--bs-border)] bg-[var(--bs-surface)]/50 p-8 text-center">
              <Spinner size="md" label="جاري تحميل الاستراحات…" />
            </div>
          ) : breaks.length === 0 ? (
            <div className="rounded-2xl border border-[var(--bs-border)]/60 bg-[var(--bs-surface)]/30 p-8 text-center">
              <p className="text-[var(--bs-text-faint)] text-sm">لا توجد فترات استراحة مسجلة</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[0, 1, 2, 3, 4, 5, 6].filter((d) => breaksByDay[d]?.length).map((dow) => (
                <div key={dow} className="rounded-2xl border border-[var(--bs-border)] bg-[var(--bs-surface)]/50 overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-[var(--bs-border)]/60 bg-[var(--bs-surface)] px-4 py-3">
                    <span className="text-[var(--bs-primary)] font-bold text-sm">{WEEKDAYS_AR[dow]}</span>
                    <span className="text-xs text-[var(--bs-text-faint)]">({breaksByDay[dow].length} {breaksByDay[dow].length === 1 ? "استراحة" : "استراحات"})</span>
                  </div>
                  <div className="divide-y divide-[var(--bs-border)]/40">
                    {breaksByDay[dow].map((b) => (
                      <div key={b.id} className="flex items-center justify-between px-4 py-3 hover:bg-[var(--bs-surface-raised)]/20 transition">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--bs-success-soft)] border border-[var(--bs-success)]/40 text-[var(--bs-success)] text-sm">
                            ☕
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[var(--bs-text)]">
                              {formatTime12(b.start_time)} — {formatTime12(b.end_time)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setDeleteBreak(b)}
                          className="rounded-xl border border-[var(--bs-error)]/40 bg-[var(--bs-error-soft)] px-3.5 py-1.5 text-xs font-bold text-[var(--bs-error)] hover:brightness-110 transition"
                        >
                          🗑️ حذف
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Delete Break Confirm Modal */}
          <ConfirmModal
            isOpen={!!deleteBreak}
            title="حذف فترة الاستراحة"
            message={`هل أنت متأكد من حذف فترة الاستراحة (${deleteBreak ? `${formatTime12(deleteBreak.start_time)} — ${formatTime12(deleteBreak.end_time)}` : ""}) يوم ${deleteBreak ? WEEKDAYS_AR[deleteBreak.day_of_week] : ""}؟`}
            confirmText="حذف الاستراحة"
            variant="danger"
            isLoading={deletingBreak}
            onConfirm={confirmDeleteBreak}
            onClose={() => setDeleteBreak(null)}
          />
        </div>
      )}
    </div>
  );
}

export default function BarberSchedulePage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center">
          <Spinner size="lg" label="جاري التحميل…" />
        </div>
      }
    >
      <ScheduleContent />
    </Suspense>
  );
}
