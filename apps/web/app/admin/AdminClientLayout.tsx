"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getOwnerToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { useLiveNotifications } from "@/lib/useNotifications";
import { useSalonSettings } from "@/lib/salon";

const nav = [
  { href: "/admin", label: "الرئيسية", icon: "📊" },
  { href: "/admin/barbers", label: "الحلاقين", icon: "💈" },
  { href: "/admin/bookings", label: "الحجوزات", icon: "📅" },
  { href: "/admin/notifications", label: "الإشعارات", icon: "🔔" },
  { href: "/admin/settings", label: "إعدادات الصالون", icon: "⚙️" },
];

export default function AdminClientLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const token = getOwnerToken();
  const [unread, setUnread] = useState(0);
  const [mobileMenu, setMobileMenu] = useState(false);
  const salon = useSalonSettings();

  // Dynamically ensure Admin PWA manifest and title are active when in /admin
  useEffect(() => {
    let appleTitle = document.querySelector<HTMLMetaElement>("meta[name='apple-mobile-web-app-title']");
    if (appleTitle) {
      appleTitle.content = `إدارة ${salon.name}`;
    }
  }, [salon.name]);

  useEffect(() => {
    if (pathname === "/admin/login") return;
    if (!token) router.replace("/admin/login");
  }, [token, pathname, router]);

  const loadUnread = useCallback(() => {
    if (!token) return;
    apiFetch<{ notifications: { is_read: number }[] }>("/api/owner/notifications", { token })
      .then((d) => setUnread(d.notifications.filter((n) => !n.is_read).length))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    loadUnread();
  }, [loadUnread]);

  useLiveNotifications("owner", () => loadUnread());

  if (pathname === "/admin/login") return <>{children}</>;
  if (!token) return null;

  const linkCls = (href: string) => {
    const active = pathname === href || (href !== "/admin" && pathname.startsWith(href));
    return `flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
      active ? "bg-amber-500/15 text-amber-400" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
    }`;
  };

  return (
    <div className="mx-auto max-w-7xl lg:flex lg:gap-6">
      {/* ── mobile toggle ── */}
      <button
        onClick={() => setMobileMenu(!mobileMenu)}
        className="mb-4 flex items-center gap-2 rounded-lg border border-zinc-800 px-4 py-2 text-sm text-zinc-400 lg:hidden"
      >
        <span>☰</span> القائمة
      </button>

      {/* ── sidebar ── */}
      <aside
        className={`shrink-0 space-y-1 lg:w-56 lg:block ${mobileMenu ? "block" : "hidden"} mb-6 lg:mb-0`}
      >
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileMenu(false)}
            className={linkCls(item.href)}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
            {item.href === "/admin/notifications" && unread > 0 && (
              <span className="mr-auto rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-zinc-950">
                {unread}
              </span>
            )}
          </Link>
        ))}
      </aside>

      {/* ── main content ── */}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
