"use client";

/**
 * Barber Smart — Phase 1 foundation verification page (sandbox).
 *
 * Renders ONLY with the new --bs-* design tokens, in both light & dark mode.
 * No real page consumes these tokens yet; this page exists to confirm:
 *   1. both modes render correctly with the full palette,
 *   2. the toggle swaps every CSS variable without glitches/FOUC,
 *   3. the icon set (lucide-react) matches the reference style,
 *   4. the Arabic-first font stack (IBM Plex Sans Arabic + Inter) works.
 */

import {
  Scissors,
  CalendarDays,
  Users,
  Armchair,
  BarChart3,
  ShoppingBag,
  CreditCard,
  Settings,
  Sun,
  Moon,
  Monitor,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { ThemeToggle, ThemeModeSelector } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter, StatCard } from "@/components/ui/card";
import { useToast } from "@/components/Toaster";

const PALETTE = [
  { name: "الخلفية", v: "--bs-bg", usage: "خلفية التطبيق" },
  { name: "السطح / البطاقة", v: "--bs-surface", usage: "بطاقات، أقسام" },
  { name: "سطح مرتفع", v: "--bs-surface-raised", usage: "قوائم منبثقة، hover" },
  { name: "ذهبي أساسي", v: "--bs-primary", usage: "أزرار، إبرازات" },
  { name: "ذهبي عميق", v: "--bs-primary-strong", usage: "ثانوي، حدود مميزة" },
  { name: "النص", v: "--bs-text", usage: "نص أساسي" },
  { name: "نص ثانوي", v: "--bs-text-muted", usage: "تسميات، وصف" },
  { name: "الحدود", v: "--bs-border", usage: "فواصل، إطارات" },
  { name: "نجاح", v: "--bs-success", usage: "تأكيد الحجز" },
  { name: "خطأ", v: "--bs-error", usage: "أخطاء التحقق" },
];

const ICONS = [
  { icon: Scissors, label: "الخدمات" },
  { icon: CalendarDays, label: "الحجوزات" },
  { icon: Users, label: "الزبائن" },
  { icon: Armchair, label: "الحلاقون" },
  { icon: BarChart3, label: "التقارير" },
  { icon: ShoppingBag, label: "المخزون" },
  { icon: CreditCard, label: "الدفعات" },
  { icon: Settings, label: "الإعدادات" },
];

export default function ThemeDemoClient() {
  const toast = useToast();
  return (
    <div
      className="bs-typography mx-auto max-w-4xl space-y-8 pb-16"
      style={{
        fontFamily:
          'var(--bs-font-sans, "IBM Plex Sans Arabic", "Inter", "Segoe UI", system-ui, sans-serif)',
      }}
    >
      {/* ── header ── */}
      <header
        className="rounded-2xl border p-6"
        style={{
          backgroundColor: "var(--bs-surface)",
          borderColor: "var(--bs-border)",
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--bs-text)" }}>
              Barber Smart — أساس التصميم
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--bs-text-muted)" }}>
              صفحة تحقق للمرحلة الأولى: الرموز التصميمية، الوضعان الفاتح والداكن، ومجموعة الأيقونات
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeModeSelector />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ── token swatches ── */}
      <section
        className="rounded-2xl border p-6"
        style={{ backgroundColor: "var(--bs-surface)", borderColor: "var(--bs-border)" }}
      >
        <h2 className="mb-4 text-lg font-bold" style={{ color: "var(--bs-text)" }}>
          لوحة الألوان (تتبدل مع الوضع تلقائياً)
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {PALETTE.map(({ name, v, usage }) => (
            <div
              key={v}
              className="overflow-hidden rounded-xl border"
              style={{ borderColor: "var(--bs-border)" }}
            >
              <div
                className="h-14 w-full"
                style={{ backgroundColor: `var(${v})` }}
                aria-hidden="true"
              />
              <div className="p-2" style={{ backgroundColor: "var(--bs-surface-raised)" }}>
                <p className="text-xs font-bold" style={{ color: "var(--bs-text)" }}>
                  {name}
                </p>
                <p dir="ltr" className="text-left text-[10px]" style={{ color: "var(--bs-text-faint)" }}>
                  {v}
                </p>
                <p className="text-[10px]" style={{ color: "var(--bs-text-muted)" }}>
                  {usage}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── typography ── */}
      <section
        className="rounded-2xl border p-6"
        style={{ backgroundColor: "var(--bs-surface)", borderColor: "var(--bs-border)" }}
      >
        <h2 className="mb-4 text-lg font-bold" style={{ color: "var(--bs-text)" }}>
          الخطوط — IBM Plex Sans Arabic (أساسي للعربية) + Inter (لاتيني)
        </h2>
        <div className="space-y-3">
          <p className="text-3xl font-bold" style={{ color: "var(--bs-text)" }}>
            صالون حلاقة فاخر — Barber Smart
          </p>
          <p className="text-lg" style={{ color: "var(--bs-text-muted)" }}>
            احجز موعدك مع حلاقك المفضل في أقل من دقيقة — Booking made simple.
          </p>
          <p className="text-sm" style={{ color: "var(--bs-text-faint)" }}>
            نص ثانوي توضيحي: Lorem ipsum 12345 — أحرف عربية: ص ش س ب ت ن م ك هـ و
          </p>
        </div>
      </section>

      {/* ── icon system ── */}
      <section
        className="rounded-2xl border p-6"
        style={{ backgroundColor: "var(--bs-surface)", borderColor: "var(--bs-border)" }}
      >
        <h2 className="mb-4 text-lg font-bold" style={{ color: "var(--bs-text)" }}>
          مجموعة الأيقونات (lucide-react) — للاستخدام في المراحل القادمة
        </h2>
        <div className="grid grid-cols-4 gap-4 sm:grid-cols-8">
          {ICONS.map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-xl border"
                style={{
                  color: "var(--bs-primary)",
                  borderColor: "var(--bs-border)",
                  backgroundColor: "var(--bs-primary-soft)",
                }}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-[11px]" style={{ color: "var(--bs-text-muted)" }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── components preview ── */}
      <section
        className="rounded-2xl border p-6"
        style={{ backgroundColor: "var(--bs-surface)", borderColor: "var(--bs-border)" }}
      >
        <h2 className="mb-4 text-lg font-bold" style={{ color: "var(--bs-text)" }}>
          عناصر الواجهة في الوضعين
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-xl px-5 py-2.5 text-sm font-bold transition active:scale-95"
            style={{ backgroundColor: "var(--bs-primary)", color: "var(--bs-on-primary)" }}
          >
            زر أساسي ذهبي
          </button>
          <button
            type="button"
            className="rounded-xl border px-5 py-2.5 text-sm font-bold transition active:scale-95"
            style={{
              borderColor: "var(--bs-primary-strong)",
              color: "var(--bs-primary-strong)",
            }}
          >
            زر ثانوي
          </button>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
            style={{ backgroundColor: "var(--bs-success-soft)", color: "var(--bs-success)" }}
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> تم التأكيد
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
            style={{ backgroundColor: "var(--bs-error-soft)", color: "var(--bs-error)" }}
          >
            <XCircle className="h-3.5 w-3.5" /> فشل
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
            style={{ backgroundColor: "var(--bs-warning-soft)", color: "var(--bs-warning)" }}
          >
            <AlertTriangle className="h-3.5 w-3.5" /> تنبيه
          </span>
        </div>
        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-bold" style={{ color: "var(--bs-text-muted)" }}>
            حقل إدخال تجريبي
          </label>
          <input
            type="text"
            placeholder="اكتب هنا…"
            className="w-full max-w-sm rounded-xl border px-4 py-2.5 text-sm outline-none"
            style={{
              backgroundColor: "var(--bs-surface-raised)",
              borderColor: "var(--bs-border)",
              color: "var(--bs-text)",
            }}
          />
        </div>
      </section>

      {/* ── phase 2: shadcn components ── */}
      <section
        className="rounded-2xl border p-6"
        style={{ backgroundColor: "var(--bs-surface)", borderColor: "var(--bs-border)" }}
      >
        <h2 className="mb-4 text-lg font-bold" style={{ color: "var(--bs-text)" }}>
          المرحلة الثانية — مكونات shadcn/ui بثيم Barber Smart
        </h2>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Button>زر أساسي</Button>
          <Button variant="secondary">زر ثانوي</Button>
          <Button variant="ghost">زر شبحي</Button>
          <Button variant="destructive">زر حذف</Button>
          <Button variant="outline">زر محدد</Button>
          <Button size="sm">مصغر</Button>
          <Button size="lg">مكبر</Button>
        </div>
        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          <StatCard icon={<Users className="h-5 w-5" />} value={128} label="إجمالي الزبائن" hint="هذا الأسبوع +12" />
          <StatCard icon={<CalendarDays className="h-5 w-5" />} value={43} label="حجوزات اليوم" hint="7 قيد الانتظار" />
          <StatCard icon={<Scissors className="h-5 w-5" />} value={"4,250 JD"} label="إيرادات الشهر" />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>بطاقة نموذجية</CardTitle>
            <CardDescription>نمط موحّد يعاد استخدامه في كل صفحات المراحل القادمة</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--bs-text-muted)]">محتوى البطاقة — نفس الحدود والسطح والظل في كل مكان.</p>
          </CardContent>
          <CardFooter className="gap-3">
            <Button size="sm">إجراء</Button>
            <Button size="sm" variant="ghost">إلغاء</Button>
          </CardFooter>
        </Card>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button size="sm" variant="secondary" onClick={() => toast.success("تم الحفظ بنجاح ✓")}>Toast نجاح</Button>
          <Button size="sm" variant="secondary" onClick={() => toast.error("حدث خطأ في العملية ⚠️")}>Toast خطأ</Button>
          <Button size="sm" variant="secondary" onClick={() => toast.warning("تحذير تجريبي")}>Toast تنبيه</Button>
          <Button size="sm" variant="secondary" onClick={() => toast.info("معلومة تجريبية")}>Toast معلومة</Button>
        </div>
      </section>

      {/* ── mode legend ── */}
      <p
        className="flex items-center justify-center gap-2 text-center text-xs"
        style={{ color: "var(--bs-text-faint)" }}
      >
        <Sun className="h-3.5 w-3.5" />
        <Moon className="h-3.5 w-3.5" />
        <Monitor className="h-3.5 w-3.5" />
        <span>
          اختيارك يُحفظ في المتصفح — «حسب النظام» يتبع إعداد جهازك تلقائياً
        </span>
      </p>
    </div>
  );
}
