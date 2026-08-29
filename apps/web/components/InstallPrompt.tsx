"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Android/Chrome PWA install button.
 * Captures the `beforeinstallprompt` event, shows a prominent install button,
 * triggers the official browser install dialog, and hides itself once the app
 * is installed (`appinstalled`) or already running in standalone mode.
 */
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Already installed / running as an app? never show the banner.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: minimal-ui)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setIsInstalled(true);
      return;
    }

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    // The prompt can only be used once regardless of outcome
    setDeferredPrompt(null);
  };

  if (isInstalled || !deferredPrompt) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--bs-success)]/30 bg-gradient-to-l from-[var(--bs-success)]/10 to-transparent p-5 shadow-lg">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-3.5 text-center sm:text-right">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--bs-success)]/30 bg-[var(--bs-success-soft)] text-[var(--bs-success)]">
            {/* Download/device SVG icon */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
              <rect x="5" y="2" width="14" height="20" rx="3" />
              <path d="M12 7v7m0 0-3-3m3 3 3-3" />
            </svg>
          </span>
          <div>
            <h3 className="text-sm font-bold text-[var(--bs-text)] sm:text-base">ثبّت التطبيق على جهازك 📲</h3>
            <p className="mt-0.5 text-xs text-[var(--bs-text-muted)]">وصول أسرع للصالون وتنبيهات فورية بموعدك</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleInstall}
          className="w-full shrink-0 rounded-xl bg-[var(--bs-success)] px-6 py-2.5 text-sm font-black text-[var(--bs-bg)] shadow-lg shadow-black/25 transition-all hover:brightness-110 active:scale-95 sm:w-auto"
        >
          تثبيت الآن
        </button>
      </div>
    </div>
  );
}
