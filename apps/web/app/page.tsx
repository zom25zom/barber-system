import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Root `/` — PUBLIC SaaS MARKETING LANDING PAGE.
 *
 * Fully static, fully public. No session/auth/salon data of any kind lives
 * here (the legacy default-salon customer home was moved to per-tenant
 * `/{salonSlug}` pages once this became a multi-tenant SaaS).
 *
 * Static rendering: this page is the single marketing surface of the app and
 * depends on no cookies/session/API — unlike the rest of the app (which uses
 * `cache: no-store` by design), it is force-rendered as static HTML so the
 * CDN/edge can serve it instantly.
 */

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Barber Smart — نظام حجز مواعيد الصالونات",
  description:
    "منصة حجز مواعيد للحلاقين والصالونات: رابط حجز عام لكل صالون، إشعارات مباشرة، تذكيرات للزبائن، وتقارير كاملة — سجّل صالونك مجاناً.",
};

/* ── static copy (no data fetching anywhere on this page) ── */

const FEATURES = [
  {
    icon: "📅",
    title: "حجز إلكتروني متكامل",
    body: "رابط حجز عام خاص بكل صالون — الزبون يختار الحلاق والخدمة والوقت في أقل من دقيقة، بدون مكالمات ولا انتظار.",
  },
  {
    icon: "🔔",
    title: "إشعارات مباشرة",
    body: "تنبيهات فورية على لوحة التحكم وعلى هاتف الزبون مع كل حجز جديد أو تغيير في الدور.",
  },
  {
    icon: "⏰",
    title: "تذكيرات تلقائية",
    body: "تذكيرات تُرسل تلقائياً قبل الموعد لتقليل الغياب وحفظ وقت فريقك.",
  },
  {
    icon: "👥",
    title: "إدارة فريق الحلاقين",
    body: "أضف الحلاقين وحدّد خدماتهم وأسعارها وأوقات عملهم — كل حلاق بصفحته الخاصة.",
  },
  {
    icon: "📊",
    title: "تقارير وإحصائيات",
    body: "تابع الحجوزات والإيرادات وأكثر الخدمات طلباً بلوحات تقارير واضحة.",
  },
  {
    icon: "🏢",
    title: "صالونات متعددة",
    body: "كل صالون يحصل على مساحته المستقلة برابطه الخاص — نظام واحد يخدم عدد لا نهائي من الصالونات.",
  },
];

const STEPS = [
  {
    num: "١",
    title: "أنشئ صالونك",
    body: "سجّل باسم الصالون واسم المستخدم وستحصل على رابط حجز عام خاص بك خلال دقيقة.",
  },
  {
    num: "٢",
    title: "أضف فريقك وخدماتك",
    body: "من لوحة التحكم أضف الحلاقين والخدمات والأسعار وأوقات العمل.",
  },
  {
    num: "٣",
    title: "شارك رابطك وابدأ",
    body: "انشر الرابط مع زبائنك — الحجوزات تصلكم مباشرة مع إشعارات وتقارير.",
  },
];

export default function LandingPage() {
  return (
    <div className="bs-skin">
      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative -mx-4 overflow-hidden">
        <div className="absolute inset-0 bg-[var(--bs-surface)]" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 90% at 82% -12%, #C9A2272E, transparent 62%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 40% 55% at 8% 108%, rgba(201,162,39,0.10), transparent 70%)",
          }}
        />
        <div className="bs-grain" />

        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-12 sm:pb-20 sm:pt-16">
          {/* eyebrow */}
          <div className="flex items-center gap-3">
            <span className="text-2xl">💈</span>
            <span
              className="text-[11px] font-bold tracking-[0.35em] text-[var(--bs-primary)]"
              dir="ltr"
            >
              BARBER BOOKING SAAS
            </span>
            <span className="bs-hairline hidden flex-1 sm:block" />
          </div>

          <h1 className="mt-6 max-w-3xl text-4xl font-black leading-[1.15] text-[var(--bs-text)] sm:mt-8 sm:text-6xl">
            نظام حجز مواعيد يدير صالونك
            <span className="text-[var(--bs-primary)]"> عنك</span>.
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-[var(--bs-text-muted)] sm:text-lg">
            منصة سحابية للحلاقين والصالونات — أعطِ زبائنك حجزاً إلكترونياً
            سهلاً، واستقبل إشعارات وتقارير وتذكيرات تلقائية، بدون تطبيقات ولا
            تعقيد. سجّل صالونك مجاناً خلال دقيقة واحدة.
          </p>

          {/* CTA cluster */}
          <div className="mt-9 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <Button
              asChild
              size="lg"
              className="px-10 text-base shadow-lg shadow-[var(--bs-primary)]/20"
            >
              <Link href="/signup">
                أنشئ صالونك مجاناً <span aria-hidden="true">←</span>
              </Link>
            </Button>
            <a
              href="#features"
              className="text-sm font-bold text-[var(--bs-text-faint)] transition-colors hover:text-[var(--bs-primary)]"
            >
              اكتشف المزايا ↓
            </a>
          </div>

          {/* owner login — generic entry point (admin login is session-global,
              then routes to that owner's own salon — never a hardcoded slug) */}
          <p className="mt-6 text-sm text-[var(--bs-text-muted)]">
            لديك صالون مسجّل بالفعل؟{" "}
            <Link
              href="/admin/login"
              className="font-bold text-[var(--bs-primary)] hover:underline"
            >
              دخول لوحة التحكم
            </Link>
          </p>
        </div>
      </section>

      {/* ═══════════════ FEATURES ═══════════════ */}
      <section id="features" className="scroll-mt-8 py-14 sm:py-20">
        <div className="flex items-center gap-3">
          <span
            className="text-[11px] font-bold tracking-[0.35em] text-[var(--bs-primary)]"
            dir="ltr"
          >
            FEATURES
          </span>
          <span className="bs-hairline flex-1" />
        </div>
        <h2 className="mt-4 text-3xl font-black text-[var(--bs-text)] sm:text-4xl">
          كل ما يحتاجه صالونك في مكان واحد
        </h2>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="bs-panel p-6">
              <span className="text-3xl" aria-hidden="true">
                {f.icon}
              </span>
              <h3 className="mt-4 text-lg font-black text-[var(--bs-text)]">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--bs-text-muted)]">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════ HOW IT WORKS ═══════════════ */}
      <section className="py-14 sm:py-16">
        <div className="bs-hairline" />
        <h2 className="mt-8 text-3xl font-black text-[var(--bs-text)] sm:text-4xl">
          ابدأ في ثلاث خطوات
        </h2>

        <ol className="mt-10 grid gap-5 sm:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.num} className="bs-panel relative overflow-hidden p-6">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -top-3 left-2 select-none text-7xl font-black text-[var(--bs-text)] opacity-[0.06]"
              >
                {s.num}
              </span>
              <span className="text-sm font-black text-[var(--bs-primary)]">
                الخطوة {s.num}
              </span>
              <h3 className="mt-2 text-lg font-black text-[var(--bs-text)]">
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--bs-text-muted)]">
                {s.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* ═══════════════ FINAL CTA ═══════════════ */}
      <section className="relative my-10 overflow-hidden rounded-3xl border border-[var(--bs-border)] bg-[var(--bs-surface)] px-6 py-14 text-center">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 90% at 50% -20%, rgba(201,162,39,0.18), transparent 65%)",
          }}
        />
        <div className="bs-grain" />
        <div className="relative">
          <h2 className="text-3xl font-black text-[var(--bs-text)] sm:text-4xl">
            جاهز لتحويل صالونك إلى تجربة رقمية؟
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-[var(--bs-text-muted)] sm:text-base">
            أنشئ رابط الحجز الخاص بصالونك الآن — مجاناً، بدون بطاقة ائتمان.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-8 px-12 text-base shadow-lg shadow-[var(--bs-primary)]/20"
          >
            <Link href="/signup">
              أنشئ صالونك مجاناً <span aria-hidden="true">←</span>
            </Link>
          </Button>
        </div>
      </section>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer className="mt-10 border-t border-[var(--bs-border)] py-10">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">💈</span>
            <span className="text-base font-black text-[var(--bs-text)]" dir="ltr">
              Barber Smart
            </span>
          </div>
          <nav className="flex items-center gap-6 text-sm font-bold">
            <Link
              href="/signup"
              className="text-[var(--bs-text-muted)] transition-colors hover:text-[var(--bs-primary)]"
            >
              إنشاء صالون
            </Link>
            <Link
              href="/admin/login"
              className="text-[var(--bs-text-muted)] transition-colors hover:text-[var(--bs-primary)]"
            >
              دخول المالكين
            </Link>
          </nav>
        </div>
        <div className="mt-8 flex flex-col items-center gap-3">
          <span className="bs-hairline w-40" />
          <p className="text-xs text-[var(--bs-text-faint)]">
            © {new Date().getFullYear()} Barber Smart — جميع الحقوق محفوظة
          </p>
        </div>
      </footer>
    </div>
  );
}
