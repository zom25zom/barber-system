"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { Barber } from "@/lib/types";
import { useSalonSettings } from "@/lib/salon";
import {
  IconFacebook,
  IconInstagram,
  IconMapPin,
  IconPhone,
  IconTiktok,
  IconWhatsapp,
} from "@/components/icons";
import InstallPrompt from "@/components/InstallPrompt";
import IOSInstallGuide from "@/components/IOSInstallGuide";
import { withSlug, useTenantLink } from "@/lib/salonTenant";
import { Button } from "@/components/ui/button";
import { Scissors } from "lucide-react";

function getWhatsappLink(wa: string): string {
  if (wa.startsWith("http://") || wa.startsWith("https://")) return wa;
  const clean = wa.replace(/\D/g, "");
  return `https://wa.me/${clean}`;
}

function getSocialLink(urlOrHandle: string, domain: string): string {
  if (urlOrHandle.startsWith("http://") || urlOrHandle.startsWith("https://")) {
    return urlOrHandle;
  }
  const clean = urlOrHandle.replace(/^@/, "").trim();
  return `https://${domain}/${clean}`;
}

/* ── editorial helpers (pure formatting, no data logic) ── */
const pad2 = (n: number) => String(n).padStart(2, "0");

const DEFAULT_TICKER = ["قص شعر", "حلاقة ذقن", "عناية بالبشرة", "تصفيف وتثبيت", "استشارة الحلاق"];

export function HomeClient({ salonSlug }: { salonSlug?: string }) {
  const tLink = useTenantLink();
  const router = useRouter();
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const salon = useSalonSettings(salonSlug);
  // Year computed post-mount — a build-time Date() causes hydration mismatch (#418) after New Year
  const [year, setYear] = useState<number | null>(null);

  useEffect(() => {
    setYear(new Date().getFullYear());
  }, []);

  useEffect(() => {
    apiFetch<{ barbers: Barber[] }>(withSlug("/api/barbers"))
      .then((d) => setBarbers(d.barbers))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Aggregate all unique services (by name) across barbers for the pricing grid
  const allServices = useMemo(() => {
    const seen = new Map<string, { name: string; price: number; duration_minutes: number; count: number }>();
    for (const b of barbers) {
      for (const s of b.services) {
        const key = `${s.name}|${s.price}`;
        const existing = seen.get(key);
        if (existing) existing.count += 1;
        else seen.set(key, { name: s.name, price: s.price, duration_minutes: s.duration_minutes, count: 1 });
      }
    }
    return [...seen.values()].sort((a, b) => a.price - b.price);
  }, [barbers]);

  const hasSocialLinks = Boolean(
    salon.social_whatsapp ||
      salon.social_instagram ||
      salon.social_facebook ||
      salon.social_tiktok ||
      salon.maps_url
  );

  const brandColor = salon.primary_color || "var(--bs-primary)";
  const tickerItems = allServices.length > 0 ? allServices.map((s) => s.name) : DEFAULT_TICKER;

  return (
    <div className="bs-skin mx-auto max-w-6xl">
      {/* ═══════════════════════════════════════════════════════════
          HERO — full-bleed editorial cover, giant wordmark is the focal point
          ═══════════════════════════════════════════════════════════ */}
      <section className="relative -mx-4 overflow-hidden">
        {/* layered background: surface → brand glow → grain → bottom glow */}
        <div className="absolute inset-0 bg-[var(--bs-surface)]" />
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 70% 90% at 82% -12%, ${salon.primary_color || "#C9A227"}2E, transparent 62%)`,
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

        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 sm:pb-20 sm:pt-20">
          {/* eyebrow: emblem + Latin small-caps + hairline */}
          <div className="flex items-center gap-3">
            {salon.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={salon.logo_url}
                alt={salon.name}
                className="h-11 w-11 rounded-full border border-[var(--bs-border-strong)] object-cover shadow-lg"
              />
            ) : (
              <span className="text-2xl">💈</span>
            )}
            <span className="text-[11px] font-bold tracking-[0.35em] text-[var(--bs-primary)]" dir="ltr">
              BARBERSHOP &amp; GROOMING
            </span>
            <span className="bs-hairline hidden flex-1 sm:block" />
          </div>

          {/* the wordmark itself — huge, confident, unequaled */}
          <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[1.08] text-[var(--bs-text)] sm:mt-8 sm:text-7xl lg:text-8xl">
            {salon.name}
            <span style={{ color: brandColor }}>.</span>
          </h1>

          <div className="mt-7 flex flex-col gap-8 sm:mt-10 sm:flex-row sm:items-end sm:justify-between">
            <p className="max-w-md text-base leading-relaxed text-[var(--bs-text-muted)] sm:text-lg">
              احجز موعدك بسهولة وبدون انتظار — اختر الحلاق والخدمة، وتابع دورك مباشرة من هاتفك.
            </p>

            {/* CTA cluster */}
            <div className="flex shrink-0 flex-col items-start gap-4 sm:items-end">
              <Button asChild size="lg" className="px-10 text-base shadow-lg shadow-[var(--bs-primary)]/20">
                <Link href={tLink.href("/book")}>
                  احجز الآن <span aria-hidden="true">←</span>
                </Link>
              </Button>
              <a
                href="#services"
                className="text-xs font-bold text-[var(--bs-text-faint)] transition-colors hover:text-[var(--bs-primary)]"
              >
                أو تصفّح قائمة الخدمات والأسعار ↓
              </a>
            </div>
          </div>

          {/* quiet derived stats — no invented data, just what's loaded */}
          {!loading && !error && barbers.length > 0 && (
            <p className="mt-10 text-xs text-[var(--bs-text-faint)]">
              <span className="font-bold text-[var(--bs-text-muted)]">{barbers.length}</span> حلاقين جاهزين
              <span className="mx-2 text-[var(--bs-border-strong)]">·</span>
              <span className="font-bold text-[var(--bs-text-muted)]">{allServices.length}</span> خدمة متاحة
              <span className="mx-2 text-[var(--bs-border-strong)]">·</span>
              تأكيد فوري
            </p>
          )}
        </div>

        {/* hairline hand-off into the ticker */}
        <div className="bs-hairline relative" />
      </section>

      {/* ══════════ service ticker — the "shop window" strip ══════════ */}
      <section className="relative -mx-4 overflow-hidden border-b border-[var(--bs-border)]/60 py-3" dir="ltr">
        <div className="bs-marquee">
          <div className="bs-marquee-track">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex shrink-0 items-center" aria-hidden={copy === 1}>
                {[...tickerItems, ...tickerItems].map((item, i) => (
                  <span
                    key={`${copy}-${i}`}
                    className="flex shrink-0 items-center text-xs text-[var(--bs-text-faint)]"
                  >
                    <span className="px-5">{item}</span>
                    <span style={{ color: brandColor }} className="text-[9px]">✦</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PWA install (Android/Chrome) + iOS install guide */}
      <InstallPrompt />
      <IOSInstallGuide />

      {/* ═══════════════════════════════════════════════════════════
          BARBERS — editorial index: numbered hairline rows, not cards
          ═══════════════════════════════════════════════════════════ */}
      <section className="pt-16 sm:pt-20">
        <header className="flex items-end justify-between gap-4">
          <div>
            <p className="mb-2 flex items-center gap-2.5 text-[11px] font-bold tracking-[0.25em] text-[var(--bs-primary)]">
              <span className="inline-block h-px w-8 bg-[var(--bs-primary)]/60" />
              فريقنا
            </p>
            <h2 className="text-3xl font-black text-[var(--bs-text)] sm:text-4xl">حلاقونا</h2>
          </div>
          <p className="hidden pb-1 text-xs text-[var(--bs-text-faint)] sm:block">
            اضغط على أي حلاق للحجز معه فوراً
          </p>
        </header>

        {loading && (
          <div className="mt-8 divide-y divide-[var(--bs-border)] border-y border-[var(--bs-border)]">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex animate-pulse items-center gap-5 py-6">
                <div className="h-4 w-8 rounded bg-[var(--bs-surface-raised)]" />
                <div className="h-16 w-16 rounded-2xl bg-[var(--bs-surface-raised)]" />
                <div className="space-y-2">
                  <div className="h-5 w-28 rounded bg-[var(--bs-surface-raised)]" />
                  <div className="h-3 w-20 rounded bg-[var(--bs-surface-raised)]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="mt-8 rounded-2xl border border-[var(--bs-error)]/40 bg-[var(--bs-error-soft)] px-5 py-4 text-[var(--bs-error)]">
            {error}
          </p>
        )}

        {!loading && !error && barbers.length === 0 && (
          <div className="mt-8 rounded-2xl bg-[var(--bs-surface)]/50 p-12 text-center text-[var(--bs-text-muted)]">
            <span className="mb-3 block text-4xl">💈</span>
            لا يوجد حلاقون متاحون حالياً — يرجى المحاولة لاحقاً.
          </div>
        )}

        {!loading && !error && barbers.length > 0 && (
          <div className="mt-8 divide-y divide-[var(--bs-border)] border-y border-[var(--bs-border)]">
            {barbers.map((barber, idx) => {
              const sorted = [...barber.services].sort((a, b) => b.price - a.price);
              const topServices = sorted.slice(0, 3);
              const minPrice = sorted.length > 0 ? sorted[sorted.length - 1].price : null;
              return (
                <button
                  key={barber.id}
                  onClick={() => tLink.push(`/book?barberId=${barber.id}`)}
                  className="group relative flex w-full items-center gap-4 px-2 py-6 text-start transition-colors duration-200 hover:bg-[var(--bs-surface)] sm:gap-6 sm:px-4"
                >
                  {/* index numeral — quiet, editorial */}
                  <span className="w-8 shrink-0 text-sm font-bold text-[var(--bs-text-faint)]" dir="ltr">
                    {pad2(idx + 1)}
                  </span>

                  {barber.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={barber.photo_url}
                      alt={barber.name}
                      className="h-16 w-16 shrink-0 rounded-2xl border border-[var(--bs-border-strong)] object-cover shadow-lg transition-transform duration-300 group-hover:scale-105 sm:h-20 sm:w-20"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-[var(--bs-border-strong)] bg-[var(--bs-surface-raised)] text-2xl shadow-lg sm:h-20 sm:w-20">
                      💈
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-xl font-black text-[var(--bs-text)] transition-colors group-hover:text-[var(--bs-primary)] sm:text-2xl">
                      {barber.name}
                    </h3>
                    <p className="mt-1 text-xs text-[var(--bs-text-faint)]">
                      {barber.services.length > 0
                        ? `${barber.services.length} خدمات متاحة`
                        : "قريباً…"}
                    </p>
                    {topServices.length > 0 && (
                      <p className="mt-2 hidden truncate text-xs text-[var(--bs-text-muted)] sm:block">
                        {topServices.map((s) => s.name).join(" · ")}
                      </p>
                    )}
                  </div>

                  {minPrice !== null && (
                    <span className="hidden shrink-0 text-left sm:block">
                      <span className="block text-[10px] text-[var(--bs-text-faint)]">يبدأ من</span>
                      <span className="text-base font-bold" style={{ color: brandColor }}>
                        {minPrice} د.أ
                      </span>
                    </span>
                  )}

                  {/* arrow chip slides in on hover */}
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--bs-border)] text-[var(--bs-text-muted)] transition-all duration-300 group-hover:border-[var(--bs-primary)] group-hover:bg-[var(--bs-primary)] group-hover:text-[var(--bs-on-primary)]"
                    aria-hidden="true"
                  >
                    ←
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SERVICES — the price menu: dotted leaders like a barbershop menu board
          ═══════════════════════════════════════════════════════════ */}
      {!loading && !error && allServices.length > 0 && (
        <section id="services" className="scroll-mt-24 pt-16 sm:pt-20">
          <header className="max-w-xl">
            <p className="mb-2 flex items-center gap-2.5 text-[11px] font-bold tracking-[0.25em] text-[var(--bs-primary)]">
              <span className="inline-block h-px w-8 bg-[var(--bs-primary)]/60" />
              قائمة الأسعار
            </p>
            <h2 className="text-3xl font-black text-[var(--bs-text)] sm:text-4xl">خدماتنا وأسعارنا</h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--bs-text-muted)]">
              أسعار واضحة بدون مفاجآت — الدفع نقداً عند الحضور. اضغط على أي خدمة للحجز الفوري.
            </p>
          </header>

          <div className="mt-10 columns-1 gap-x-12 sm:columns-2 lg:columns-3">
            {allServices.map((s) => {
              const firstBarber = barbers.find((b) => b.services.some((x) => x.name === s.name && x.price === s.price));
              const firstService = firstBarber?.services.find((x) => x.name === s.name && x.price === s.price);
              return (
                <button
                  key={`${s.name}-${s.price}`}
                  onClick={() =>
                    firstBarber && firstService
                      ? tLink.push(`/book?barberId=${firstBarber.id}&serviceId=${firstService.id}`)
                      : tLink.push("/book")
                  }
                  className="bs-leader group w-full break-inside-avoid border-b border-[var(--bs-border)]/60 py-4 text-start transition-colors hover:border-[var(--bs-primary)]/50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-[var(--bs-text)] transition-colors group-hover:text-[var(--bs-primary)]">
                      {s.name}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-[var(--bs-text-faint)]">
                      {s.duration_minutes} دقيقة
                      {s.count > 1 ? ` · متوفر لدى ${s.count} حلاقين` : ""}
                    </span>
                  </span>
                  <span className="bs-leader-dots" aria-hidden="true" />
                  <span className="shrink-0 text-base font-black transition-colors group-hover:text-[var(--bs-primary)]" style={{ color: brandColor }}>
                    {s.price} <span className="text-[11px] font-bold">د.أ</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-8 flex justify-end">
            <Button asChild variant="secondary" className="gap-2">
              <Link href={tLink.href("/book")}>
                <Scissors className="h-4 w-4" />
                احجز موعدك الآن
              </Link>
            </Button>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════
          FOOTER — full-bleed, giant ghost wordmark, asymmetric columns
          ═══════════════════════════════════════════════════════════ */}
      <footer className="-mx-4 mt-20 overflow-hidden border-t border-[var(--bs-border)] bg-[var(--bs-bg)]">
        <div className="mx-auto max-w-6xl px-4 pb-8 pt-12">
          {/* oversized wordmark */}
          <p className="text-4xl font-black leading-none text-[var(--bs-text)] sm:text-6xl" style={{ opacity: 0.92 }}>
            {salon.name}
          </p>
          <p className="mt-3 max-w-xs text-xs leading-relaxed text-[var(--bs-text-faint)]">
            احجز موعدك بسهولة وبدون انتظار — اختر الحلاق والخدمة وتابع دورك مباشرة من هاتفك.
          </p>

          <div className="bs-hairline mt-10" />

          <div className="grid gap-10 pt-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
            {/* Contact & location column */}
            <div>
              <h4 className="mb-4 text-[11px] font-bold tracking-[0.25em] text-[var(--bs-text-faint)]">تواصل معنا</h4>
              {salon.phone && (
                <a
                  href={`tel:${salon.phone}`}
                  className="inline-flex items-center gap-2 text-lg font-bold text-[var(--bs-success)] hover:underline"
                  dir="ltr"
                >
                  <IconPhone className="h-4 w-4" />
                  <span>{salon.phone}</span>
                </a>
              )}
              {salon.maps_url && (
                <div className="mt-4">
                  <a
                    href={salon.maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--bs-primary)]/25 bg-[var(--bs-primary-soft)] px-3 py-1.5 text-xs font-bold text-[var(--bs-primary)] transition hover:brightness-110 active:scale-95"
                  >
                    <IconMapPin className="h-3.5 w-3.5" />
                    <span>موقعنا على الخريطة ↗</span>
                  </a>
                </div>
              )}
            </div>

            {/* filler brand blurb on wide screens keeps columns uneven */}
            <div className="hidden lg:block" />

            {/* Social links column */}
            {hasSocialLinks && (
              <div>
                <h4 className="mb-4 text-[11px] font-bold tracking-[0.25em] text-[var(--bs-text-faint)]">تابعنا</h4>
                <div className="flex flex-wrap items-center gap-2.5">
                  {salon.social_whatsapp && (
                    <a
                      href={getWhatsappLink(salon.social_whatsapp)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--bs-success)]/25 bg-[var(--bs-success-soft)] text-[var(--bs-success)] transition hover:-translate-y-0.5 hover:brightness-110 active:scale-95"
                      aria-label="واتساب"
                    >
                      <IconWhatsapp className="h-4 w-4" />
                    </a>
                  )}
                  {salon.social_instagram && (
                    <a
                      href={getSocialLink(salon.social_instagram, "instagram.com")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-pink-500/25 bg-pink-500/10 text-pink-600 transition hover:-translate-y-0.5 hover:bg-pink-500/20 active:scale-95 dark:text-pink-400"
                      aria-label="إنستغرام"
                    >
                      <IconInstagram className="h-4 w-4" />
                    </a>
                  )}
                  {salon.social_facebook && (
                    <a
                      href={getSocialLink(salon.social_facebook, "facebook.com")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-blue-500/25 bg-blue-500/10 text-blue-600 transition hover:-translate-y-0.5 hover:bg-blue-500/20 active:scale-95 dark:text-blue-400"
                      aria-label="فيسبوك"
                    >
                      <IconFacebook className="h-4 w-4" />
                    </a>
                  )}
                  {salon.social_tiktok && (
                    <a
                      href={getSocialLink(salon.social_tiktok, "tiktok.com")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--bs-border)] bg-[var(--bs-surface)] text-[var(--bs-text-muted)] transition hover:-translate-y-0.5 hover:bg-[var(--bs-surface-raised)] active:scale-95"
                      aria-label="تيك توك"
                    >
                      <IconTiktok className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Copyright strip */}
        <div className="border-t border-[var(--bs-border)]/60">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 text-[11px] text-[var(--bs-text-faint)] sm:flex-row">
            <p>جميع الحقوق محفوظة © {year ?? ""} {salon.name}</p>
            <p>نظام حجز الصالونات والمواعيد الذكي</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default HomeClient;
