"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearCustomerAuth, getCustomerProfile, getOwnerToken, clearOwnerToken } from "@/lib/auth";
import { useSalonSettings } from "@/lib/salon";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const salon = useSalonSettings();

  useEffect(() => {
    const sync = () => {
      setCustomerName(getCustomerProfile()?.username ?? null);
      setIsOwner(!!getOwnerToken());
    };
    sync();
    window.addEventListener("auth-changed", sync);
    return () => window.removeEventListener("auth-changed", sync);
  }, [pathname]);

  const linkCls = (href: string) =>
    `whitespace-nowrap rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition-all ${
      pathname === href
        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
        : "text-zinc-300 hover:text-amber-400 hover:bg-zinc-900"
    }`;

  if (pathname.startsWith("/admin")) {
    return (
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/admin" className="flex items-center gap-2.5">
            {salon.logo_url ? (
              <img
                src={salon.logo_url}
                alt={salon.name}
                className="h-8 w-8 rounded-full border border-amber-500/40 object-cover shadow-sm"
              />
            ) : (
              <span className="text-xl">💈</span>
            )}
            <span className="font-bold text-amber-400 text-sm sm:text-base">لوحة تحكم {salon.name}</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/" className={linkCls("/")}>
              الموقع
            </Link>
            {isOwner && (
              <button
                onClick={() => {
                  clearOwnerToken();
                  router.push("/admin/login");
                }}
                className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs sm:text-sm text-red-400 hover:bg-red-500/10"
              >
                خروج
              </button>
            )}
          </nav>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          {salon.logo_url ? (
            <img
              src={salon.logo_url}
              alt={salon.name}
              className="h-8 w-8 rounded-full border border-amber-500/40 object-cover shadow-sm"
            />
          ) : (
            <span className="text-xl">💈</span>
          )}
          <span className="font-extrabold text-amber-400 text-base sm:text-lg">{salon.name}</span>
        </Link>

        {/* Desktop and Tablet Navigation */}
        <nav className="hidden md:flex items-center gap-2">
          {salon.phone && (
            <a
              href={`tel:${salon.phone}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition"
              dir="ltr"
            >
              <span>📞</span>
              <span>{salon.phone}</span>
            </a>
          )}
          <Link href="/" className={linkCls("/")}>
            الخدمات
          </Link>
          <Link href="/book" className={linkCls("/book")}>
            احجز موعدك
          </Link>
          {customerName ? (
            <>
              <Link href="/my-bookings" className={linkCls("/my-bookings")}>
                حجوزاتي والدور
              </Link>
              <Link href="/notifications" className={linkCls("/notifications")}>
                الإشعارات
              </Link>
              <span className="text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full">
                👋 {customerName}
              </span>
              <button
                onClick={() => {
                  clearCustomerAuth();
                  router.push("/");
                }}
                className="rounded-lg px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
              >
                تسجيل خروج
              </button>
            </>
          ) : (
            <Link href="/login" className={linkCls("/login")}>
              تسجيل الدخول
            </Link>
          )}
        </nav>

        {/* Mobile Hamburger / Quick Links */}
        <div className="flex md:hidden items-center gap-2">
          {salon.phone && (
            <a
              href={`tel:${salon.phone}`}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm hover:bg-emerald-500/20"
              aria-label="اتصل بالصالون"
            >
              📞
            </a>
          )}
          <Link
            href="/book"
            className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-zinc-950 shadow-sm hover:bg-amber-400"
          >
            احجز
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-zinc-300 hover:text-amber-400"
            aria-label="القائمة"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {mobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-zinc-800 bg-zinc-950 px-4 py-3 space-y-2">
          {customerName && (
            <p className="text-xs text-amber-400/90 font-medium pb-1 border-b border-zinc-900">
              مرحباً، {customerName}
            </p>
          )}
          <div className="flex flex-col gap-1.5 pt-1">
            {salon.phone && (
              <a
                href={`tel:${salon.phone}`}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-400"
              >
                <span>📞 الاتصال بالصالون</span>
                <span dir="ltr">{salon.phone}</span>
              </a>
            )}
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className={linkCls("/")}
            >
              ✂ قائمة الخدمات والأسعار
            </Link>
            <Link
              href="/book"
              onClick={() => setMobileMenuOpen(false)}
              className={linkCls("/book")}
            >
              📅 حجز موعد جديد
            </Link>
            {customerName ? (
              <>
                <Link
                  href="/my-bookings"
                  onClick={() => setMobileMenuOpen(false)}
                  className={linkCls("/my-bookings")}
                >
                  ⏳ حجوزاتي وتتبع الدور
                </Link>
                <Link
                  href="/notifications"
                  onClick={() => setMobileMenuOpen(false)}
                  className={linkCls("/notifications")}
                >
                  🔔 الإشعارات
                </Link>
                <button
                  onClick={() => {
                    clearCustomerAuth();
                    setMobileMenuOpen(false);
                    router.push("/");
                  }}
                  className="text-right w-full rounded-lg px-3 py-2 text-xs text-red-400 hover:bg-red-500/10"
                >
                  🚪 تسجيل خروج
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className={linkCls("/login")}
              >
                🔑 تسجيل الدخول / حساب جديد
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
