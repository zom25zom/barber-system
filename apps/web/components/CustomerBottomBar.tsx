"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getCustomerToken } from "@/lib/auth";
import { buildTenantUrl, useTenantLink } from "@/lib/salonTenant";
import {
  IconBell,
  IconCalendarPlus,
  IconClipboardList,
  IconHome,
} from "@/components/icons";

const items = [
  { href: "/", label: "الرئيسية", Icon: IconHome, exact: true },
  { href: "/book", label: "الحجز", Icon: IconCalendarPlus, exact: false },
  { href: "/my-bookings", label: "حجوزاتي", Icon: IconClipboardList, exact: false },
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
  if (pathname.startsWith("/admin")) return null;

  // Tenant-aware href — the ONLY way links are built here (ARCHITECTURE.md)
  const effHref = (href: string) => buildTenantUrl(href);

  const isActive = (href: string, exact?: boolean) => {
    const eff = effHref(href);
    return exact ? pathname === eff : pathname === eff || pathname.startsWith(eff);
  };

  const linkCls = (active: boolean) =>
    `relative flex flex-1 flex-col items-center justify-center gap-1 py-1.5 text-center transition-all ${
      active ? "text-amber-400 font-bold scale-105" : "text-zinc-400 hover:text-zinc-200"
    }`;

  return (
    <>
      {/* Spacer so fixed bar never covers page content */}
      <div aria-hidden="true" className="h-20" />

      <nav
        aria-label="التنقل السفلي"
        className="fixed bottom-0 inset-x-0 z-50 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-lg shadow-2xl safe-area-pb"
      >
        <div className="mx-auto flex max-w-md items-center justify-around px-2 py-1.5">
          {/* الرئيسية / الحجز / حجوزاتي */}
          {items.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <Link key={item.href} href={effHref(item.href)} className={linkCls(active)}>
                <item.Icon className="h-5 w-5" />
                <span className="text-[10px] sm:text-[11px] leading-none">{item.label}</span>
                <span
                  className={`mt-0.5 h-1 w-5 rounded-full transition-all ${
                    active ? "bg-amber-500 shadow-sm shadow-amber-500/50" : "bg-transparent"
                  }`}
                />
              </Link>
            );
          })}

          {/* الإشعارات */}
          <Link href={effHref("/notifications")} className={linkCls(pathname === effHref("/notifications"))}>
            <div className="relative">
              <IconBell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-black text-zinc-950 ring-2 ring-zinc-950">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </div>
            <span className="text-[10px] sm:text-[11px] leading-none">الإشعارات</span>
            <span
              className={`mt-0.5 h-1 w-5 rounded-full transition-all ${
                pathname === "/notifications" ? "bg-amber-500 shadow-sm shadow-amber-500/50" : "bg-transparent"
              }`}
            />
          </Link>

          {/* حسابي — صفحة البروفايل */}
          <Link href={tLink.href("/my-profile")} className={linkCls(pathname.startsWith(tLink.href("/my-profile")))}>
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-all ${
                pathname.startsWith("/my-profile")
                  ? "border-amber-500/50 bg-amber-500 text-zinc-950"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-400"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                <circle cx="12" cy="8" r="4" />
                <path d="M5 21c0-3.9 3.1-7 7-7s7 3.1 7 7" />
              </svg>
            </span>
            <span className="text-[10px] sm:text-[11px] leading-none">حسابي</span>
            <span
              className={`mt-0.5 h-1 w-5 rounded-full transition-all ${
                pathname.startsWith("/my-profile") ? "bg-amber-500 shadow-sm shadow-amber-500/50" : "bg-transparent"
              }`}
            />
          </Link>
        </div>
      </nav>
    </>
  );
}
