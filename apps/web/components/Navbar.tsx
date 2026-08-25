"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCustomerProfile, getOwnerToken, clearOwnerToken } from "@/lib/auth";
import { useSalonSettings } from "@/lib/salon";
import ConfirmModal from "@/components/ConfirmModal";
import { IconPhone } from "@/components/icons";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [ownerLogoutOpen, setOwnerLogoutOpen] = useState(false);
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

  if (pathname.startsWith("/admin")) {
    return (
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur">
        {/* Admin Logout Confirmation Modal */}
        <ConfirmModal
          isOpen={ownerLogoutOpen}
          title="تأكيد تسجيل الخروج"
          message="هل أنت متأكد من رغبتك في تسجيل الخروج من لوحة تحكم الصالون؟"
          confirmText="نعم، تسجيل الخروج"
          cancelText="إلغاء"
          variant="warning"
          icon="🚪"
          onConfirm={() => {
            setOwnerLogoutOpen(false);
            clearOwnerToken();
            router.push("/admin/login");
          }}
          onClose={() => setOwnerLogoutOpen(false)}
        />

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
            <Link
              href="/"
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition-all ${
                pathname === "/"
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "text-zinc-300 hover:text-amber-400 hover:bg-zinc-900"
              }`}
            >
              الموقع
            </Link>
            {isOwner && (
              <button
                type="button"
                onClick={() => setOwnerLogoutOpen(true)}
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

  // ── Customer header (navigation lives in the fixed bottom bar) ──
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          {salon.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={salon.logo_url}
              alt={salon.name}
              className="h-9 w-9 rounded-full border border-amber-500/40 object-cover shadow-sm"
            />
          ) : (
            <span className="text-xl">💈</span>
          )}
          <span className="font-extrabold text-amber-400 text-base sm:text-lg">{salon.name}</span>
        </Link>

        {/* Phone contact — replaces the logout button here (logout lives in the profile page) */}
        {salon.phone ? (
          <a
            href={`tel:${salon.phone}`}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/20 active:scale-95 sm:text-sm"
            dir="ltr"
            aria-label={`الاتصال بالصالون ${salon.phone}`}
          >
            <IconPhone className="h-4 w-4" />
            <span>{salon.phone}</span>
          </a>
        ) : customerName ? (
          <span className="text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full sm:text-sm">
            👋 {customerName}
          </span>
        ) : (
          <Link
            href="/login"
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold transition-all ${
              pathname === "/login"
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                : "bg-amber-500 text-zinc-950 hover:bg-amber-400 active:scale-95"
            }`}
          >
            تسجيل الدخول
          </Link>
        )}
      </div>
    </header>
  );
}
