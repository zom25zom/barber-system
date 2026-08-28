"use client";

/**
 * Theme controls (Phase 1 foundation).
 *
 • ThemeToggle       — compact accessible icon button for the navbar.
 • ThemeModeSelector — 3-way segmented control (system/light/dark) for admin settings.
 *
 * next-themes persists the choice in localStorage (key "theme"); "system"
 * follows the OS preference until the user overrides it. The `mounted`
 * guard prevents SSR/client hydration mismatches.
 */

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";

/* ── no-glitch mode swap: temporarily enable color transitions ── */
function withThemeTransition(apply: () => void) {
  document.documentElement.classList.add("bs-theme-transitioning");
  apply();
  window.setTimeout(() => {
    document.documentElement.classList.remove("bs-theme-transitioning");
  }, 250);
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    // Placeholder keeps layout stable before hydration (same box size).
    return (
      <span
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-700/60"
        aria-hidden="true"
      />
    );
  }

  const isDark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => withThemeTransition(() => setTheme(isDark ? "light" : "dark"))}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-700/60 bg-zinc-900/60 text-zinc-300 transition hover:border-amber-500/40 hover:text-amber-400 active:scale-95"
      aria-label={isDark ? "التبديل إلى الوضع الفاتح" : "التبديل إلى الوضع الداكن"}
      title={isDark ? "الوضع الفاتح" : "الوضع الداكن"}
    >
      {isDark ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
    </button>
  );
}

type Mode = "system" | "light" | "dark";

const MODES: { value: Mode; label: string; icon: typeof Monitor }[] = [
  { value: "system", label: "حسب النظام", icon: Monitor },
  { value: "light", label: "فاتح", icon: Sun },
  { value: "dark", label: "داكن", icon: Moon },
];

export function ThemeModeSelector() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <div
      role="radiogroup"
      aria-label="اختيار وضع العرض"
      className="inline-flex overflow-hidden rounded-xl border border-zinc-700/60"
    >
      {MODES.map(({ value, label, icon: Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => withThemeTransition(() => setTheme(value))}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold transition sm:text-sm ${
              active
                ? "bg-amber-500 text-zinc-950"
                : "bg-zinc-900/60 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800/60"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
