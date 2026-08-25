"use client";

import { useEffect, useState } from "react";
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

  const hasSocialLinks = Boolean(
    salon.social_whatsapp ||
      salon.social_instagram ||
      salon.social_facebook ||
      salon.social_tiktok ||
      salon.maps_url
  );

  return (
    <div className="space-y-12">
      {/* ── Hero Section ── */}
      <section className="rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-900 via-zinc-900/90 to-zinc-950 px-6 py-12 text-center shadow-2xl relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl opacity-15 pointer-events-none"
          style={{ backgroundColor: salon.primary_color || "#f59e0b" }}
        />

        {salon.logo_url ? (
          <img
            src={salon.logo_url}
            alt={salon.name}
            className="mx-auto mb-4 h-24 w-24 rounded-3xl border-2 border-amber-500/40 object-cover shadow-xl transition-transform hover:scale-105"
          />
        ) : (
          <span className="inline-block text-5xl mb-3">💈</span>
        )}

        <h1 className="text-3xl font-black sm:text-5xl" style={{ color: salon.primary_color || "#f59e0b" }}>
          {salon.name}
        </h1>

        <p className="mt-4 text-zinc-300 text-sm sm:text-lg max-w-xl mx-auto leading-relaxed">
          احجز موعدك بسهولة وبدون انتظار — اختر الحلاق والخدمة وتابع دورك مباشرة من هاتفك
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
          <Link
            href="/book"
            style={{ backgroundColor: salon.primary_color || "#f59e0b" }}
            className="rounded-xl px-8 py-3.5 font-extrabold text-zinc-950 transition-all hover:opacity-90 shadow-lg hover:shadow-amber-500/20 active:scale-95 text-sm sm:text-base"
          >
            ✂ احجز موعدك الآن
          </Link>

          {salon.phone && (
            <a
              href={`tel:${salon.phone}`}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-6 py-3.5 text-sm sm:text-base font-bold text-emerald-400 hover:bg-emerald-500/20 transition active:scale-95 shadow-sm"
              dir="ltr"
            >
              <span>📞</span>
              <span>{salon.phone}</span>
            </a>
          )}
        </div>
      </section>

      {/* ── Services & Barbers Section ── */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-zinc-100">خدماتنا وأسعارنا</h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">اختر الحلاق أو اضغط على أي خدمة للحجز الفوري</p>
          </div>
        </div>

        {loading && <p className="text-zinc-400 py-8 text-center">جاري تحميل الخدمات…</p>}
        {error && <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-400">{error}</p>}
        {!loading && !error && barbers.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center text-zinc-400">
            لا توجد خدمات متاحة حالياً.
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {barbers.map((barber) => (
            <div
              key={barber.id}
              className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-xl transition-all hover:border-zinc-700"
            >
              <div
                onClick={() => router.push(`/book?barberId=${barber.id}`)}
                className="flex items-center justify-between border-b border-zinc-800/80 px-5 py-4 cursor-pointer hover:bg-zinc-800/40 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {barber.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={barber.photo_url}
                      alt={barber.name}
                      className="h-14 w-14 rounded-full border-2 border-amber-500/50 object-cover shadow-md"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-amber-500/50 bg-zinc-800 text-2xl shadow-md">
                      💈
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-bold text-amber-400">{barber.name}</h3>
                    <p className="text-xs text-zinc-400">{barber.services.length} خدمات متاحة</p>
                  </div>
                </div>
                <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3.5 py-1.5 rounded-xl font-bold">
                  اختيار الحلاق ←
                </span>
              </div>

              {barber.services.length === 0 ? (
                <p className="px-5 py-6 text-sm text-zinc-500 text-center">لا توجد خدمات مسجلة لهذا الحلاق حالياً.</p>
              ) : (
                <ul className="divide-y divide-zinc-800/60">
                  {barber.services.map((s) => (
                    <li
                      key={s.id}
                      onClick={() => router.push(`/book?barberId=${barber.id}&serviceId=${s.id}`)}
                      className="flex items-center justify-between px-5 py-3.5 cursor-pointer transition-all hover:bg-amber-500/10 group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-amber-500 group-hover:scale-125 transition-transform text-sm">✦</span>
                        <div>
                          <p className="font-semibold text-zinc-100 group-hover:text-amber-400 transition-colors text-sm sm:text-base">
                            {s.name}
                          </p>
                          <p className="text-xs text-zinc-500 mt-0.5">⏱ المدة: {s.duration_minutes} دقيقة</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs sm:text-sm font-bold text-amber-400">
                          {s.price} د.أ
                        </span>
                        <span className="text-xs text-zinc-500 hidden sm:inline group-hover:text-zinc-300">احجز</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Public Footer ── */}
      <footer className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl text-center space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
          <div className="flex items-center gap-3">
            {salon.logo_url ? (
              <img src={salon.logo_url} alt={salon.name} className="h-10 w-10 rounded-xl object-cover border border-amber-500/40" />
            ) : (
              <span className="text-2xl">💈</span>
            )}
            <div className="text-right">
              <h3 className="font-bold text-zinc-100 text-base">{salon.name}</h3>
              {salon.phone && (
                <a
                  href={`tel:${salon.phone}`}
                  className="text-xs text-emerald-400 hover:underline inline-flex items-center gap-1.5 mt-0.5"
                  dir="ltr"
                >
                  <IconPhone className="h-3.5 w-3.5" />
                  <span>{salon.phone}</span>
                </a>
              )}
            </div>
          </div>

          {/* Google Maps Location Button */}
          {salon.maps_url && (
            <a
              href={salon.maps_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs sm:text-sm font-bold text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/50 transition active:scale-95"
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
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 transition active:scale-95"
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
                className="inline-flex items-center gap-2 rounded-xl border border-pink-500/30 bg-pink-500/10 px-4 py-2 text-xs font-bold text-pink-400 hover:bg-pink-500/20 transition active:scale-95"
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
                className="inline-flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-xs font-bold text-blue-400 hover:bg-blue-500/20 transition active:scale-95"
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
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-bold text-zinc-200 hover:bg-zinc-800 transition active:scale-95"
              >
                <IconTiktok className="h-4 w-4" />
                <span>تيك توك</span>
              </a>
            )}
          </div>
        )}

        <div className="pt-2 text-xs text-zinc-500 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-zinc-900">
          <p>جميع الحقوق محفوظة © {new Date().getFullYear()} {salon.name}</p>
          <p className="text-[11px] text-zinc-600">نظام حجز الصالونات والمواعيد الذكي</p>
        </div>
      </footer>
    </div>
  );
}
