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
  IconTiktok,
  IconWhatsapp,
} from "@/components/icons";
import InstallPrompt from "@/components/InstallPrompt";
import IOSInstallGuide from "@/components/IOSInstallGuide";

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

export default function HomePage() {
  const router = useRouter();
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const salon = useSalonSettings();

  useEffect(() => {
    apiFetch<{ barbers: Barber[] }>("/api/barbers")
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
    <div className="space-y-14">
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
              href="/book"
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
            href="/book"
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
                  onClick={() => router.push(`/book?barberId=${barber.id}`)}
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
                      ? router.push(`/book?barberId=${firstBarber.id}&serviceId=${firstService.id}`)
                      : router.push("/book")
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
      <footer className="space-y-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-8 text-center shadow-2xl">
        <div className="flex flex-col items-center justify-between gap-4 border-b border-zinc-800/80 pb-6 sm:flex-row">
          <div className="flex items-center gap-3">
            {salon.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={salon.logo_url} alt={salon.name} className="h-10 w-10 rounded-xl border border-amber-500/40 object-cover" />
            ) : (
              <span className="text-2xl">💈</span>
            )}
            <div className="text-right">
              <h3 className="text-base font-bold text-zinc-100">{salon.name}</h3>
            </div>
          </div>

          {/* Google Maps Location Button */}
          {salon.maps_url && (
            <a
              href={salon.maps_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-400 transition active:scale-95 hover:border-amber-500/50 hover:bg-amber-500/20 sm:text-sm"
            >
              <IconMapPin className="h-4 w-4" />
              <span>موقعنا على الخريطة</span>
              <span className="text-xs opacity-70">↗</span>
            </a>
          )}
        </div>

        {/* Social Media Links (Only shown if filled) */}
        {hasSocialLinks && (
          <div className="flex flex-wrap items-center justify-center gap-3">
            {salon.social_whatsapp && (
              <a
                href={getWhatsappLink(salon.social_whatsapp)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-400 transition active:scale-95 hover:bg-emerald-500/20"
              >
                <IconWhatsapp className="h-4 w-4" />
                <span>واتساب</span>
              </a>
            )}

            {salon.social_instagram && (
              <a
                href={getSocialLink(salon.social_instagram, "instagram.com")}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-pink-500/30 bg-pink-500/10 px-4 py-2 text-xs font-bold text-pink-400 transition active:scale-95 hover:bg-pink-500/20"
              >
                <IconInstagram className="h-4 w-4" />
                <span>إنستغرام</span>
              </a>
            )}

            {salon.social_facebook && (
              <a
                href={getSocialLink(salon.social_facebook, "facebook.com")}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-xs font-bold text-blue-400 transition active:scale-95 hover:bg-blue-500/20"
              >
                <IconFacebook className="h-4 w-4" />
                <span>فيسبوك</span>
              </a>
            )}

            {salon.social_tiktok && (
              <a
                href={getSocialLink(salon.social_tiktok, "tiktok.com")}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-bold text-zinc-200 transition active:scale-95 hover:bg-zinc-800"
              >
                <IconTiktok className="h-4 w-4" />
                <span>تيك توك</span>
              </a>
            )}
          </div>
        )}

        <div className="flex flex-col items-center justify-between gap-2 border-t border-zinc-900 pt-2 text-xs text-zinc-500 sm:flex-row">
          <p>جميع الحقوق محفوظة © {new Date().getFullYear()} {salon.name}</p>
          <p className="text-[11px] text-zinc-600">نظام حجز الصالونات والمواعيد الذكي</p>
        </div>
      </footer>
    </div>
  );
}
