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
      <div className="animate-pulse space-y-2 rounded-2xl border-2 border-[var(--bs-success)]/60 bg-[var(--bs-success-soft)] p-4 text-center shadow-lg sm:p-5">
        <div className="flex items-center justify-center gap-2">
          <span className="text-2xl">⚡</span>
          <span className="text-base font-black text-[var(--bs-success)] sm:text-lg">
            حان وقت حجزك الآن!
          </span>
        </div>
        <p className="text-xs text-[var(--bs-success)]/80">
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
    <div className="space-y-4 rounded-2xl border border-[var(--bs-border)] bg-[var(--bs-bg)]/70 p-4 shadow-inner sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--bs-border)] pb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--bs-primary)] opacity-60"></span>
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--bs-primary)]"></span>
          </span>
          <span className="text-xs font-bold text-[var(--bs-text)] sm:text-sm">
            العداد التنازلي لموعد دخولك
          </span>
        </div>

        {delayMinutes > 0 ? (
          <span className="rounded-full border border-[var(--bs-warning)]/40 bg-[var(--bs-warning-soft)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--bs-warning)]">
            ⚠️ تأخير متوقع: +{delayMinutes} دقيقة
          </span>
        ) : (
          <span className="rounded-full border border-[var(--bs-success)]/30 bg-[var(--bs-success-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--bs-success)]">
            ✓ في الموعد المحدد
          </span>
        )}
      </div>

      {/* Live human-readable summary — replaces "your turn now" until time actually arrives */}
      <div className="text-center">
        <span className="text-sm font-bold text-[var(--bs-text)] sm:text-base">
          دورك خلال{" "}
          <span className="font-black text-[var(--bs-primary)]">
            {humanizeRemaining(totalSeconds)}
          </span>
        </span>
      </div>

      {/* Countdown Digits Grid */}
      <div className="flex items-center justify-center gap-2 py-1 sm:gap-3" dir="ltr">
        {days > 0 && (
          <>
            <DigitBlock value={pad(days)} label="أيام" />
            <Colon />
          </>
        )}

        <DigitBlock value={pad(hours)} label="ساعات" />
        <Colon />
        <DigitBlock value={pad(minutes)} label="دقائق" />
        <Colon />
        <DigitBlock value={pad(seconds)} label="ثواني" pulse />
      </div>

      {/* Delay / Time details notice */}
      {delayMinutes > 0 ? (
        <div className="rounded-xl border border-[var(--bs-warning)]/30 bg-[var(--bs-warning-soft)] p-2.5 text-center text-xs text-[var(--bs-warning)]">
          تم احتساب وقت الانتهاء المتوقع للزبائن السابقين. الموعد الفعلي المتوقع هو{" "}
          <strong className="font-bold text-[var(--bs-text)]">
            {formatTime12(effectiveStartTime)}
          </strong>{" "}
          (الموعد المحجوز أصلاً: {formatTime12(startTime)}).
        </div>
      ) : (
        <div className="text-center text-[11px] text-[var(--bs-text-faint)]">
          الموعد المقرر: {bookingDate} الساعة {formatTime12(startTime)}
        </div>
      )}
    </div>
  );
}

/** "2155" -> "35 دقيقة و55 ثانية" (Arabic humanized remaining time) */
function humanizeRemaining(totalSeconds: number): string {
  if (totalSeconds <= 0) return "الآن";
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  const parts: string[] = [];
  if (d > 0) parts.push(`${d} يوم`);
  if (h > 0) parts.push(`${h} ساعة`);
  if (m > 0) parts.push(`${m} دقيقة`);
  if (d === 0 && h === 0) parts.push(`${s} ثانية`);
  return parts.join(" و");
}

function DigitBlock({ value, label, pulse }: { value: string; label: string; pulse?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-[var(--bs-border)] bg-[var(--bs-surface)] shadow-sm sm:h-16 sm:w-16">
        <span
          className={`text-2xl font-black tabular-nums text-[var(--bs-primary)] sm:text-3xl ${
            pulse ? "animate-pulse" : ""
          }`}
        >
          {value}
        </span>
      </div>
      <span className="mt-1.5 text-[10px] font-semibold text-[var(--bs-text-faint)] sm:text-xs">
        {label}
      </span>
    </div>
  );
}

function Colon() {
  return <span className="mb-5 text-xl font-bold text-[var(--bs-border-strong)]">:</span>;
}
