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

  return (
    <div className="mx-auto max-w-6xl space-y-14">
      {/* ══════════ Hero Section ══════════ */}
      <section className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 px-6 py-16 text-center shadow-2xl sm:px-10 sm:py-20">
        {/* Decorative glows */}
        <div
          className="pointer-events-none absolute -top-32 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
          style={{ backgroundColor: salon.primary_color || "#f59e0b" }}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-l from-transparent via-white/10 to-transparent" />

        <div className="relative mx-auto max-w-2xl">
          {salon.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={salon.logo_url}
              alt={salon.name}
              className="mx-auto mb-6 h-28 w-28 rounded-3xl border-2 object-cover shadow-2xl ring-4 transition-transform hover:scale-105"
              style={{ borderColor: `${salon.primary_color || "#f59e0b"}66`, boxShadow: `0 0 40px ${salon.primary_color || "#f59e0b"}33` }}
            />
          ) : (
            <span className="mb-6 inline-block text-7xl drop-shadow-lg">💈</span>
          )}

          <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-6xl" style={{ color: salon.primary_color || "#f59e0b" }}>
            {salon.name}
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-zinc-300 sm:text-xl">
            احجز موعدك بسهولة وبدون انتظار — اختر الحلاق والخدمة وتابع دورك مباشرة من هاتفك
          </p>

          {/* Primary CTA */}
          <div className="mt-9 flex justify-center">
            <Link
              href={tLink.href("/book")}
              style={{ backgroundColor: salon.primary_color || "#f59e0b", boxShadow: `0 8px 30px ${salon.primary_color || "#f59e0b"}44` }}
              className="w-full rounded-2xl px-10 py-4 text-lg font-black text-zinc-950 transition-all hover:-translate-y-0.5 hover:brightness-110 active:scale-95 sm:w-auto"
            >
              احجز الآن ✨
            </Link>
          </div>
        </div>
      </section>

      {/* PWA install (Android/Chrome) + iOS install guide */}
      <InstallPrompt />
      <IOSInstallGuide />

      {/* ══════════ Barbers Section ══════════ */}
      <section>
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-zinc-100 sm:text-3xl">حلاقونا</h2>
            <p className="mt-1.5 text-sm text-zinc-400">فريق محترف في خدمتك — اضغط على أي حلاق للحجز معه فوراً</p>
          </div>
          <Link
            href={tLink.href("/book")}
            className="hidden shrink-0 rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-2.5 text-sm font-bold text-amber-400 transition hover:bg-amber-500/20 active:scale-95 sm:block"
          >
            عرض الكل ←
          </Link>
        </div>

        {loading && (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-56 animate-pulse rounded-3xl border border-zinc-800 bg-zinc-900/60" />
            ))}
          </div>
        )}

        {error && (
          <p className="rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-red-400">{error}</p>
        )}

        {!loading && !error && barbers.length === 0 && (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-12 text-center text-zinc-400">
            <span className="mb-3 block text-4xl">💈</span>
            لا توجد خدمات متاحة حالياً، تابعنا قريباً.
          </div>
        )}

        {!loading && !error && barbers.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {barbers.map((barber) => {
              const topServices = [...barber.services].sort((a, b) => b.price - a.price).slice(0, 3);
              return (
                <article
                  key={barber.id}
                  onClick={() => tLink.push(`/book?barberId=${barber.id}`)}
                  className="group cursor-pointer overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 shadow-xl transition-all hover:-translate-y-1 hover:border-amber-500/50 hover:shadow-amber-500/10"
                >
                  <div className="flex items-center gap-4 p-5 pb-4">
                    {barber.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={barber.photo_url}
                        alt={barber.name}
                        className="h-16 w-16 shrink-0 rounded-2xl border-2 border-amber-500/50 object-cover shadow-lg transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-amber-500/50 bg-zinc-800 text-2xl shadow-lg">
                        💈
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-lg font-black text-amber-400">{barber.name}</h3>
                      <p className="mt-0.5 text-xs text-zinc-400">
                        {barber.services.length > 0 ? `${barber.services.length} خدمات متاحة` : "قريباً…"}
                      </p>
                    </div>
                  </div>

                  {topServices.length > 0 && (
                    <div className="border-t border-zinc-800/70 px-5 py-4">
                      <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-zinc-500">أشهر الخدمات</p>
                      <div className="flex flex-wrap gap-2">
                        {topServices.map((s) => (
                          <span
                            key={s.id}
                            className="rounded-full border border-zinc-700/80 bg-zinc-800/60 px-3 py-1 text-xs text-zinc-300"
                          >
                            {s.name} · <span className="font-bold text-amber-400">{s.price} د.أ</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    className="w-full border-t border-zinc-800/70 bg-zinc-900/60 py-3.5 text-sm font-bold text-amber-400 transition-colors group-hover:bg-amber-500 group-hover:text-zinc-950"
                    tabIndex={-1}
                  >
                    احجز مع {barber.name.split(" ")[0]} ←
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ══════════ Services & Prices Grid ══════════ */}
      {!loading && !error && allServices.length > 0 && (
        <section>
          <div className="mb-8">
            <h2 className="text-2xl font-black text-zinc-100 sm:text-3xl">خدماتنا وأسعارنا</h2>
            <p className="mt-1.5 text-sm text-zinc-400">أسعار واضحة بدون مفاجآت — اضغط على أي خدمة للحجز الفوري</p>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
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
                  className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 text-right shadow-lg transition-all hover:-translate-y-1 hover:border-amber-500/50 hover:bg-zinc-900 hover:shadow-amber-500/10 active:scale-95"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-zinc-100 transition-colors group-hover:text-amber-400 sm:text-base">
                        {s.name}
                      </h3>
                      <p className="mt-1 text-xs text-zinc-500">⏱ {s.duration_minutes} دقيقة</p>
                      {s.count > 1 && (
                        <p className="mt-0.5 text-[11px] text-zinc-600">متوفر لدى {s.count} حلاقين</p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-black text-amber-400 sm:text-sm">
                      {s.price} د.أ
                    </span>
                  </div>
                  <span className="absolute bottom-0 right-0 h-1 w-0 rounded-t-full transition-all duration-300 group-hover:w-full" style={{ backgroundColor: salon.primary_color || "#f59e0b" }} />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ══════════ Public Footer ══════════ */}
      <footer className="border-t border-zinc-800 bg-zinc-950">
        {/* Main footer content */}
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {/* Brand column */}
          <div>
            <div className="flex items-center gap-3">
              {salon.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={salon.logo_url} alt={salon.name} className="h-11 w-11 rounded-xl border border-amber-500/40 object-cover" />
              ) : (
                <span className="text-2xl">💈</span>
              )}
              <h3 className="text-base font-black text-zinc-100">{salon.name}</h3>
            </div>
            <p className="mt-3 max-w-xs text-xs leading-relaxed text-zinc-500">
              احجز موعدك بسهولة وبدون انتظار — اختر الحلاق والخدمة وتابع دورك مباشرة من هاتفك.
            </p>
          </div>

          {/* Contact & location column */}
          <div>
            <h4 className="mb-3 text-sm font-bold text-zinc-200">تواصل معنا</h4>
            {salon.phone && (
              <a
                href={`tel:${salon.phone}`}
                className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:underline"
                dir="ltr"
              >
                <IconPhone className="h-3.5 w-3.5" />
                <span>{salon.phone}</span>
              </a>
            )}
            {salon.maps_url && (
              <div className="mt-3">
                <a
                  href={salon.maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-400 transition hover:bg-amber-500/20 active:scale-95"
                >
                  <IconMapPin className="h-3.5 w-3.5" />
                  <span>موقعنا على الخريطة ↗</span>
                </a>
              </div>
            )}
          </div>

          {/* Social links column */}
          {hasSocialLinks && (
            <div>
              <h4 className="mb-3 text-sm font-bold text-zinc-200">تابعنا</h4>
              <div className="flex flex-wrap items-center gap-2.5">
                {salon.social_whatsapp && (
                  <a
                    href={getWhatsappLink(salon.social_whatsapp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 transition hover:bg-emerald-500/20 hover:-translate-y-0.5 active:scale-95"
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
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-pink-500/25 bg-pink-500/10 text-pink-400 transition hover:bg-pink-500/20 hover:-translate-y-0.5 active:scale-95"
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
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-500/25 bg-blue-500/10 text-blue-400 transition hover:bg-blue-500/20 hover:-translate-y-0.5 active:scale-95"
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
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-300 transition hover:bg-zinc-800 hover:-translate-y-0.5 active:scale-95"
                    aria-label="تيك توك"
                  >
                    <IconTiktok className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Copyright strip */}
        <div className="border-t border-zinc-900">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 text-[11px] text-zinc-600 sm:flex-row">
            <p>جميع الحقوق محفوظة © {year ?? ""} {salon.name}</p>
            <p>نظام حجز الصالونات والمواعيد الذكي</p>
          </div>
        </div>
      </footer>
    </div>
  );
}


export default HomeClient;
