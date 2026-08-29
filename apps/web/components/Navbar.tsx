"use client";

import { useTenantLink } from "@/lib/salonTenant";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCustomerProfile, getOwnerToken, clearOwnerToken } from "@/lib/auth";
import { useSalonSettings, useOwnerSalonSettings } from "@/lib/salon";
import { buildTenantUrl } from "@/lib/salonTenant";
import ConfirmModal from "@/components/ConfirmModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Phone, Globe } from "lucide-react";
import { shouldHideSharedChrome, isSuperAdminArea } from "@/lib/chrome";

export default function Navbar() {
  const pathname = usePathname();
  const tLink = useTenantLink();
  const router = useRouter();
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [ownerLogoutOpen, setOwnerLogoutOpen] = useState(false);
  const salon = useSalonSettings();
  // Owner-session-scoped settings (includes the salon slug) — used by the
  // admin topbar's «الموقع» button to reach THIS salon's public booking page.
  const ownerSalon = useOwnerSalonSettings(isOwner);

  useEffect(() => {
    const sync = () => {
      setCustomerName(getCustomerProfile()?.username ?? null);
      setIsOwner(!!getOwnerToken());
    };
    sync();
    window.addEventListener("auth-changed", sync);
    return () => window.removeEventListener("auth-changed", sync);
  }, [pathname]);

  // Public/unauthenticated pages render only their own form content.
  // (Placed after all hooks so the hook order stays stable across navigations.)
  if (shouldHideSharedChrome(pathname)) return null;

  // Super Admin area renders its own platform-owner chrome — the shared
  // navbar must never appear there (and never links to it either).
  if (isSuperAdminArea(pathname)) return null;

  if (pathname.startsWith("/admin")) {
    return (
      <header className="sticky top-0 z-40 border-b border-[var(--bs-border)] bg-[var(--bs-bg)]/95 backdrop-blur">
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
                className="h-8 w-8 rounded-full border border-[var(--bs-primary)]/40 object-cover shadow-sm"
              />
            ) : (
              <span className="text-xl">💈</span>
            )}
            <span className="text-sm font-bold text-[var(--bs-primary)] sm:text-base">
              لوحة تحكم {salon.name}
            </span>
          </Link>
          <nav className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm">
              {/* Tenant's public booking page — NOT the root domain. The slug
                  comes from the owner session server-side and goes through the
                  mandatory tenant-link helper (check-tenant-links.mjs). */}
              <Link href={ownerSalon.slug ? buildTenantUrl("/", ownerSalon.slug) : "/"}>
                <Globe className="h-4 w-4" />
                الموقع
              </Link>
            </Button>
            {isOwner && (
              <Button type="button" variant="destructive" size="sm" onClick={() => setOwnerLogoutOpen(true)}>
                خروج
              </Button>
            )}
          </nav>
        </div>
      </header>
    );
  }

  // ── Customer header (navigation lives in the fixed bottom bar) ──
  return (
    <header className="bs-skin sticky top-0 z-40 bg-[var(--bs-bg)]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
        <Link href={tLink.href("/")} className="flex shrink-0 items-center gap-2.5">
          {salon.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={salon.logo_url}
              alt={salon.name}
              className="h-9 w-9 rounded-lg border border-[var(--bs-border-strong)] object-cover shadow-sm"
            />
          ) : (
            <span className="text-xl">💈</span>
          )}
          <span className="text-base font-black tracking-tight text-[var(--bs-text)] sm:text-lg">
            {salon.name}
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          {/* Theme toggle (Phase 1 foundation — page content unchanged) */}
          <ThemeToggle />

          {/* Phone contact — replaces the logout button here (logout lives in the profile page) */}
          {salon.phone ? (
            <a
              href={`tel:${salon.phone}`}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[var(--bs-success)]/30 bg-[var(--bs-success-soft)] px-3.5 py-2 text-xs font-bold text-[var(--bs-success)] transition hover:brightness-110 active:scale-95 sm:text-sm"
              dir="ltr"
              aria-label={`الاتصال بالصالون ${salon.phone}`}
            >
              <Phone className="h-4 w-4" />
              <span>{salon.phone}</span>
            </a>
          ) : customerName ? (
            <span className="rounded-xl bg-[var(--bs-surface)] px-3 py-1.5 text-xs text-[var(--bs-text-muted)] sm:text-sm">
              👋 {customerName}
            </span>
          ) : (
            <Button asChild size="sm" className="shrink-0 whitespace-nowrap">
              <Link href={tLink.href("/login")}>تسجيل الدخول</Link>
            </Button>
          )}
        </div>
      </div>
      {/* hairline base — fades at both ends, softer than a hard border */}
      <div className="bs-hairline" />
    </header>
  );
}
