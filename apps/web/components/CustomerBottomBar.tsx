"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getCustomerToken } from "@/lib/auth";
import { useSalonSettings } from "@/lib/salon";
import {
  IconBell,
  IconCalendarPlus,
  IconClipboardList,
  IconHome,
  IconPhone,
} from "@/components/icons";

const items = [
  { href: "/", label: "الرئيسية", Icon: IconHome, exact: true },
  { href: "/book", label: "الحجز", Icon: IconCalendarPlus, exact: false },
  { href: "/my-bookings", label: "حجوزاتي", Icon: IconClipboardList, exact: false },
];

export default function CustomerBottomBar() {
  const pathname = usePathname();
  const salon = useSalonSettings();
  const [unread, setUnread] = useState(0);

  const loadUnread = useCallback(() => {
    const token = getCustomerToken();
    if (!token) {
      setUnread(0);
      return;
    }
    apiFetch<{ notifications: { is_read: number }[] }>("/api/notifications", { token })
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

  const isActive = (item: (typeof items)[number]) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href);

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
        className="fixed bottom-0 inset-x-0 z-50 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-lg px-2 py-1.5 shadow-2xl safe-area-pb"
      >
        <div className="mx-auto flex max-w-md items-center justify-around">
          {/* الرئيسية / الحجز / حجوزاتي */}
          {items.map((item) => {
            const active = isActive(item);
            return (
              <Link key={item.href} href={item.href} className={linkCls(active)}>
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
          <Link href="/notifications" className={linkCls(pathname === "/notifications")}>
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

          {/* اتصال بالصالون — المكان الوحيد لرقم التواصل في الصفحة */}
          {salon.phone && (
            <a
              href={`tel:${salon.phone}`}
              className="relative flex flex-1 flex-col items-center justify-center gap-1 py-1.5 text-center text-emerald-400 transition-all hover:text-emerald-300"
              aria-label={`الاتصال بالصالون ${salon.phone}`}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10">
                <IconPhone className="h-4 w-4" />
              </div>
              <span className="text-[10px] sm:text-[11px] leading-none">اتصال</span>
            </a>
          )}
        </div>
      </nav>
    </>
  );
}
