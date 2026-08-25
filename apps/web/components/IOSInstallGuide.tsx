"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "ios_install_guide_dismissed";

/**
 * Detects iOS Safari (real Safari only — Chrome/Firefox on iOS use WebKit
 * but can't add to home screen) and shows a one-time guided install modal.
 */
function isIOSSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;

  // iOS device? (iPadOS 13+ may report as Macintosh — check touch support too)
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  if (!isIOS) return false;

  // Real Safari only: exclude in-app browsers & third-party iOS browsers
  const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS|OPiOS|FBIOS|Instagram/i.test(ua);
  return isSafari;
}

export default function IOSInstallGuide() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isIOSSafari()) return;

    // Already installed as a standalone app → never show
    if ((window.navigator as unknown as { standalone?: boolean }).standalone === true) return;

    // User asked not to show it again on this device
    try {
      if (localStorage.getItem(DISMISS_KEY) === "true") return;
    } catch {}

    const timer = setTimeout(() => setShow(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  // Close on Escape key (same UX as ConfirmModal)
  useEffect(() => {
    if (!show) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShow(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [show]);

  const dismissForever = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "true");
    } catch {}
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="إرشادات تثبيت التطبيق">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in" onClick={() => setShow(false)} />

      {/* Modal Card — same style as ConfirmModal */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/15 text-amber-400">
            {/* Phone with arrow SVG icon */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
              <rect x="5" y="2" width="14" height="20" rx="3" />
              <path d="M12 16v.01M9.5 8.5 12 6l2.5 2.5" />
              <path d="M12 6v6" />
            </svg>
          </span>
          <div className="flex-1 text-right">
            <h3 className="text-lg font-bold text-zinc-100">ثبّت التطبيق على شاشتك الرئيسية 📲</h3>
            <p className="mt-1 text-xs text-zinc-400">ثلاث خطوات بسيطة داخل متصفح سفاري:</p>
          </div>
        </div>

        {/* Steps */}
        <ol className="mt-5 space-y-4">
          <li className="flex items-center gap-3.5 rounded-xl border border-zinc-800 bg-zinc-800/40 p-3.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-sm font-black text-amber-400">1</span>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-200">
              {/* iOS Safari Share button icon */}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                <path d="M12 3v12" />
                <path d="m8 7 4-4 4 4" />
                <path d="M8 11H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-2" />
              </svg>
            </span>
            <p className="text-sm leading-relaxed text-zinc-300">اضغط على زر المشاركة بالأسفل</p>
          </li>

          <li className="flex items-center gap-3.5 rounded-xl border border-zinc-800 bg-zinc-800/40 p-3.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-sm font-black text-amber-400">2</span>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-200">
              {/* Add to home screen (+ square) icon */}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="4" />
                <path d="M12 8v8M8 12h8" />
              </svg>
            </span>
            <p className="text-sm leading-relaxed text-zinc-300">
              اختر <span className="font-bold text-zinc-100">&quot;إضافة إلى الشاشة الرئيسية&quot;</span>
            </p>
          </li>

          <li className="flex items-center gap-3.5 rounded-xl border border-zinc-800 bg-zinc-800/40 p-3.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-sm font-black text-amber-400">3</span>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-200">
              {/* Checkmark circle icon */}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="m8.5 12.5 2.5 2.5 4.5-5" />
              </svg>
            </span>
            <p className="text-sm leading-relaxed text-zinc-300">اضغط <span className="font-bold text-zinc-100">&quot;إضافة&quot;</span></p>
          </li>
        </ol>

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-3 border-t border-zinc-800/80 pt-4 sm:flex-row-reverse sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => setShow(false)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-8 py-2.5 text-sm font-bold text-zinc-950 shadow-lg shadow-amber-950/50 transition active:scale-95 hover:bg-amber-400"
          >
            فهمت
          </button>
          <button
            type="button"
            onClick={dismissForever}
            className="text-xs text-zinc-500 underline-offset-4 transition hover:text-zinc-300 hover:underline"
          >
            لا تُظهر هذا مجدداً
          </button>
        </div>
      </div>
    </div>
  );
}
