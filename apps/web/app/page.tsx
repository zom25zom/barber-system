"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { Barber } from "@/lib/types";
import { useSalonSettings } from "@/lib/salon";

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

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 via-zinc-900/80 to-zinc-950 px-6 py-10 text-center shadow-lg">
        {salon.logo_url ? (
          <img
            src={salon.logo_url}
            alt={salon.name}
            className="mx-auto mb-3.5 h-20 w-20 rounded-2xl border-2 border-amber-500/40 object-cover shadow-lg"
          />
        ) : (
          <span className="inline-block text-4xl mb-2">💈</span>
        )}
        <h1 className="text-3xl font-black text-amber-400 sm:text-4xl">{salon.name}</h1>
        <p className="mt-3 text-zinc-300 text-sm sm:text-base max-w-lg mx-auto">
          احجز موعدك بسهولة وبدون انتظار — اختر الحلاق والخدمة وتابع دورك مباشرة من هاتفك
        </p>
        <Link
          href="/book"
          className="mt-6 inline-block rounded-xl bg-amber-500 px-8 py-3.5 font-bold text-zinc-950 transition-all hover:bg-amber-400 shadow-md hover:shadow-amber-500/20 active:scale-95"
        >
          ✂ احجز موعدك الآن
        </Link>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-100">خدماتنا وأسعارنا</h2>
          <span className="text-xs text-zinc-400">اضغط على أي خدمة للحجز الفوري</span>
        </div>

        {loading && <p className="text-zinc-400">جاري التحميل…</p>}
        {error && <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-400">{error}</p>}
        {!loading && !error && barbers.length === 0 && (
          <p className="text-zinc-400">لا توجد خدمات متاحة حالياً.</p>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {barbers.map((barber) => (
            <div
              key={barber.id}
              className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-md transition-all hover:border-zinc-700"
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
                      className="h-14 w-14 rounded-full border-2 border-amber-500/50 object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-amber-500/50 bg-zinc-800 text-2xl">
                      💈
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-bold text-amber-400">{barber.name}</h3>
                    <p className="text-xs text-zinc-400">{barber.services.length} خدمات متاحة</p>
                  </div>
                </div>
                <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-lg font-medium">
                  اختيار الحلاق ←
                </span>
              </div>

              {barber.services.length === 0 ? (
                <p className="px-5 py-4 text-sm text-zinc-500">لا توجد خدمات مسجلة لهذا الحلاق.</p>
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
                          <p className="font-semibold text-zinc-100 group-hover:text-amber-400 transition-colors">
                            {s.name}
                          </p>
                          <p className="text-xs text-zinc-500">{s.duration_minutes} دقيقة</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-sm font-bold text-amber-400">
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
    </div>
  );
}
