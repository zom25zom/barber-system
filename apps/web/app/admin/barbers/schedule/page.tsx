"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { getOwnerToken } from "@/lib/auth";
import { WEEKDAYS_AR, formatTime12 } from "@/lib/time";
import Spinner from "@/components/Spinner";
import type { ScheduleDay } from "@/lib/types";

const defaultSchedule: ScheduleDay[] = Array.from({ length: 7 }, (_, i) => ({
  day_of_week: i,
  start_time: "09:00",
  end_time: "21:00",
  is_day_off: i === 5, // Friday off by default
}));

function ScheduleContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const token = getOwnerToken();
  const [days, setDays] = useState<ScheduleDay[]>(defaultSchedule);
  const [barberName, setBarberName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const load = useCallback(() => {
    if (!token || !id) return;
    apiFetch<{ schedule: ScheduleDay[] }>(`/api/owner/barbers/${id}/schedule`, { token })
      .then((d) => {
        if (d.schedule.length > 0) {
          const merged = defaultSchedule.map((def) => {
            const found = d.schedule.find((s) => s.day_of_week === def.day_of_week);
            return found
              ? { ...found, is_day_off: !!found.is_day_off }
              : def;
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

  useEffect(() => {
    load();
  }, [load]);

  if (!id) {
    return (
      <div className="space-y-4">
        <p className="text-red-400">لم يتم تحديد الحلاق.</p>
        <Link href="/admin/barbers" className="text-amber-400 underline">العودة للحلاقين</Link>
      </div>
    );
  }

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
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/barbers"
          className="rounded-xl border border-zinc-700 bg-zinc-800/60 px-3.5 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition"
        >
          ← العودة للحلاقين
        </Link>
        <h1 className="text-2xl font-bold text-zinc-100">
          جدول عمل {barberName ? `الحلاق ${barberName}` : `الحلاق #${id}`}
        </h1>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-400 flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="text-xs text-red-300 hover:underline">
            إغلاق
          </button>
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-400 flex items-center justify-between">
          <span>✨ تم حفظ وتحديث جدول العمل بنجاح!</span>
          <button onClick={() => setSuccess(false)} className="text-xs text-emerald-300 hover:underline">
            إغلاق
          </button>
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
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
                  ? "border-zinc-800/60 bg-zinc-900/40 opacity-60"
                  : "border-zinc-800 bg-zinc-900 shadow-sm"
              }`}
            >
              <span className="w-20 text-sm font-bold text-amber-400">
                {WEEKDAYS_AR[d.day_of_week]}
              </span>

              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={d.is_day_off}
                  onChange={(e) => updateDay(d.day_of_week, "is_day_off", e.target.checked)}
                  className="h-4 w-4 accent-amber-500"
                />
                <span className="text-sm text-zinc-400">إجازة أسبوعية</span>
              </label>

              {!d.is_day_off && (
                <div className="flex flex-1 items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-zinc-400">من</label>
                    <input
                      type="time"
                      value={d.start_time}
                      onChange={(e) => updateDay(d.day_of_week, "start_time", e.target.value)}
                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-500"
                    />
                    <span className="text-xs text-zinc-400 font-medium">{formatTime12(d.start_time)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-zinc-400">إلى</label>
                    <input
                      type="time"
                      value={d.end_time}
                      onChange={(e) => updateDay(d.day_of_week, "end_time", e.target.value)}
                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-500"
                    />
                    <span className="text-xs text-zinc-400 font-medium">{formatTime12(d.end_time)}</span>
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-8 py-3 font-bold text-zinc-950 hover:bg-amber-400 disabled:opacity-50 shadow-md transition active:scale-98"
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
