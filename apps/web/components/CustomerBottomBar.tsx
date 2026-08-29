"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getCustomerToken } from "@/lib/auth";
import { buildTenantUrl, useTenantLink } from "@/lib/salonTenant";
import {
  Home,
  CalendarPlus,
  ClipboardList,
  Bell,
  UserRound,
} from "lucide-react";
import { shouldHideSharedChrome, isSuperAdminArea } from "@/lib/chrome";

const items = [
  { href: "/", label: "الرئيسية", Icon: Home, exact: true },
  { href: "/book", label: "الحجز", Icon: CalendarPlus, exact: false },
  { href: "/my-bookings", label: "حجوزاتي", Icon: ClipboardList, exact: false },
];

export default function CustomerBottomBar() {
  const pathname = usePathname();
  const tLink = useTenantLink();
  const [unread, setUnread] = useState(0);

  const loadUnread = useCallback(() => {
    const token = getCustomerToken();
    if (!token) {
      setUnread(0);
      return;
    }
    apiFetch<{ notifications: { is_read: number }[] }>("/api/customer/notifications", { token })
      .then((d) => setUnread(d.notifications.filter((n) => !n.is_read).length))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadUnread();
    const handler = () => loadUnread();
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, [loadUnread]);

  useEffect(() => {
    loadUnread();
  }, [pathname, loadUnread]);

  // Hidden entirely on admin panel (it has its own navigation)
  // and on public/unauthenticated pages (signup, admin login).
  if (
    pathname.startsWith("/admin") ||
    isSuperAdminArea(pathname) ||
    shouldHideSharedChrome(pathname)
  )
    return null;

  // Tenant-aware href — the ONLY way links are built here (ARCHITECTURE.md)
  const effHref = (href: string) => buildTenantUrl(href);

  const isActive = (href: string, exact?: boolean) => {
    const eff = effHref(href);
    return exact ? pathname === eff : pathname === eff || pathname.startsWith(eff);
  };

  // Floating-island style: active item gets a soft gold pill behind icon+label
  const linkCls = (active: boolean) =>
    `relative flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-2 text-center transition-all ${
      active
        ? "bg-[var(--bs-primary-soft)] font-bold text-[var(--bs-primary)]"
        : "text-[var(--bs-text-muted)] hover:text-[var(--bs-text)]"
    }`;

  return (
    <>
      {/* Spacer so fixed bar never covers page content */}
      <div aria-hidden="true" className="h-24" />

      <nav
        aria-label="التنقل السفلي"
        className="bs-skin fixed bottom-0 left-1/2 z-50 w-[min(28rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-2xl border border-[var(--bs-border)] bg-[var(--bs-bg)]/95 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.6)] backdrop-blur-lg"
        style={{ marginBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex items-center justify-around px-2 py-1.5">
          {/* الرئيسية / الحجز / حجوزاتي */}
          {items.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <Link key={item.href} href={effHref(item.href)} className={linkCls(active)}>
                <item.Icon className="h-5 w-5" />
                <span className="text-[10px] leading-none sm:text-[11px]">{item.label}</span>
                {active && (
                  <span className="absolute -bottom-px h-0.5 w-6 rounded-full bg-[var(--bs-primary)]" aria-hidden="true" />
                )}
              </Link>
            );
          })}

          {/* الإشعارات */}
          <Link href={effHref("/notifications")} className={linkCls(pathname === effHref("/notifications"))}>
            <div className="relative">
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--bs-primary)] px-1 text-[9px] font-black text-[var(--bs-on-primary)] ring-2 ring-[var(--bs-bg)]">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </div>
            <span className="text-[10px] leading-none sm:text-[11px]">الإشعارات</span>
            {pathname === effHref("/notifications") && (
              <span className="absolute -bottom-px h-0.5 w-6 rounded-full bg-[var(--bs-primary)]" aria-hidden="true" />
            )}
          </Link>

          {/* حسابي — صفحة البروفايل */}
          <Link
            href={tLink.href("/my-profile")}
            className={linkCls(pathname.startsWith(tLink.href("/my-profile")))}
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-all ${
                pathname.startsWith("/my-profile")
                  ? "border-[var(--bs-primary)]/50 bg-[var(--bs-primary)] text-[var(--bs-on-primary)]"
                  : "border-[var(--bs-primary)]/30 bg-[var(--bs-primary-soft)] text-[var(--bs-primary)]"
              }`}
            >
              <UserRound className="h-4 w-4" />
            </span>
            <span className="text-[10px] leading-none sm:text-[11px]">حسابي</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
