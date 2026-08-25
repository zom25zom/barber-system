"use client";

import { useEffect, useState } from "react";
import { formatTime12 } from "@/lib/time";

interface BookingCountdownProps {
  bookingDate: string;
  startTime: string;
  effectiveStartTime?: string;
  delayMinutes?: number;
  targetDatetimeIso?: string;
  isMyTurn?: boolean;
}

export default function BookingCountdown({
  bookingDate,
  startTime,
  effectiveStartTime,
  delayMinutes = 0,
  targetDatetimeIso,
  isMyTurn = false,
}: BookingCountdownProps) {
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const timeToUse = effectiveStartTime || startTime;
  let targetMs = 0;

  if (targetDatetimeIso) {
    const parsed = new Date(targetDatetimeIso).getTime();
    if (!Number.isNaN(parsed)) {
      targetMs = parsed;
    }
  }

  if (!targetMs) {
    // Fallback: parse date + time (e.g. 2026-08-24 14:30)
    const [year, month, day] = bookingDate.split("-").map(Number);
    const [hours, mins] = timeToUse.split(":").map(Number);
    const targetDate = new Date(year, month - 1, day, hours, mins, 0, 0);
    targetMs = targetDate.getTime();
  }

  const diffMs = targetMs - now;
  const isTimeReached = diffMs <= 0;

  if (isMyTurn || isTimeReached) {
    return (
      <div className="rounded-2xl border-2 border-emerald-500/60 bg-emerald-500/15 p-4 sm:p-5 text-center shadow-lg animate-pulse space-y-2">
        <div className="flex items-center justify-center gap-2">
          <span className="text-2xl">⚡</span>
          <span className="text-base sm:text-lg font-black text-emerald-300">
            حان وقت حجزك الآن!
          </span>
        </div>
        <p className="text-xs text-emerald-200">
          تفضل بالتوجه لكرسي الحلاقة، الحلاق بانتظارك.
        </p>
      </div>
    );
  }

  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-zinc-900 to-zinc-950 p-4 sm:p-5 shadow-xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
          </span>
          <span className="text-xs sm:text-sm font-bold text-zinc-100">
            العداد التنازلي لموعد دخولك
          </span>
        </div>

        {delayMinutes > 0 ? (
          <span className="rounded-full border border-orange-500/40 bg-orange-500/10 px-2.5 py-0.5 text-[11px] font-bold text-orange-300">
            ⚠️ تأخير متوقع: +{delayMinutes} دقيقة
          </span>
        ) : (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
            ✓ في الموعد المحدد
          </span>
        )}
      </div>

      {/* Countdown Digits Grid */}
      <div className="flex items-center justify-center gap-2 sm:gap-3 py-1" dir="ltr">
        {days > 0 && (
          <>
            <div className="flex flex-col items-center">
              <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-950 shadow-inner">
                <span className="font-mono text-2xl sm:text-3xl font-black text-amber-400">
                  {pad(days)}
                </span>
              </div>
              <span className="mt-1 text-[10px] sm:text-xs font-semibold text-zinc-400">
                أيام
              </span>
            </div>
            <span className="text-xl font-bold text-zinc-600 mb-5">:</span>
          </>
        )}

        <div className="flex flex-col items-center">
          <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-950 shadow-inner">
            <span className="font-mono text-2xl sm:text-3xl font-black text-amber-400">
              {pad(hours)}
            </span>
          </div>
          <span className="mt-1 text-[10px] sm:text-xs font-semibold text-zinc-400">
            ساعات
          </span>
        </div>

        <span className="text-xl font-bold text-zinc-600 mb-5">:</span>

        <div className="flex flex-col items-center">
          <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-950 shadow-inner">
            <span className="font-mono text-2xl sm:text-3xl font-black text-amber-400">
              {pad(minutes)}
            </span>
          </div>
          <span className="mt-1 text-[10px] sm:text-xs font-semibold text-zinc-400">
            دقائق
          </span>
        </div>

        <span className="text-xl font-bold text-zinc-600 mb-5">:</span>

        <div className="flex flex-col items-center">
          <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border border-amber-500/40 bg-zinc-950 shadow-inner">
            <span className="font-mono text-2xl sm:text-3xl font-black text-amber-400 animate-pulse">
              {pad(seconds)}
            </span>
          </div>
          <span className="mt-1 text-[10px] sm:text-xs font-semibold text-amber-400">
            ثواني
          </span>
        </div>
      </div>

      {/* Delay / Time details notice */}
      {delayMinutes > 0 ? (
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-2.5 text-center text-xs text-orange-300">
          تم احتساب وقت الانتهاء المتوقع للزبائن السابقين. الموعد الفعلي المتوقع هو{" "}
          <strong className="font-bold text-white">
            {formatTime12(effectiveStartTime)}
          </strong>{" "}
          (الموعد المحجوز أصلاً: {formatTime12(startTime)}).
        </div>
      ) : (
        <div className="text-center text-[11px] text-zinc-400">
          الموعد المقرر: {bookingDate} الساعة {formatTime12(startTime)}
        </div>
      )}
    </div>
  );
}
