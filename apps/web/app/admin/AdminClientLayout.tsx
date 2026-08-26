"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getOwnerToken, clearOwnerToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { useLiveNotifications } from "@/lib/useNotifications";
import { useSalonSettings } from "@/lib/salon";
import ConfirmModal from "@/components/ConfirmModal";
import InstallPrompt from "@/components/InstallPrompt";
import IOSInstallGuide from "@/components/IOSInstallGuide";

const nav = [
  { href: "/admin", label: "الرئيسية", icon: "📊" },
  { href: "/admin/reports", label: "التقارير المالية", icon: "📈" },
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
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
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

  const isItemActive = (href: string) => {
    return pathname === href || (href !== "/admin" && pathname.startsWith(href));
  };

  const desktopLinkCls = (href: string) => {
    const active = isItemActive(href);
    return `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
      active
        ? "bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20 font-bold"
        : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
    }`;
  };

  return (
    <div className="w-full lg:flex lg:gap-8">
      {/* ── Logout Confirmation Modal ── */}
      <ConfirmModal
        isOpen={logoutModalOpen}
        title="تأكيد تسجيل الخروج"
        message="هل أنت متأكد من رغبتك في تسجيل الخروج من لوحة تحكم الصالون؟"
        confirmText="نعم، تسجيل الخروج"
        cancelText="إلغاء"
        variant="warning"
        icon="🚪"
        onConfirm={() => {
          setLogoutModalOpen(false);
          clearOwnerToken();
          router.push("/admin/login");
        }}
        onClose={() => setLogoutModalOpen(false)}
      />

      {/* ── Desktop Sidebar (Visible only on lg screens) ── */}
      <aside className="hidden lg:block shrink-0 space-y-1.5 lg:w-64 sticky top-20 h-fit">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-3 shadow-xl space-y-1">
          {nav.map((item) => {
            const active = isItemActive(item.href);
            return (
              <Link key={item.href} href={item.href} className={desktopLinkCls(item.href)}>
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
                {item.href === "/admin/notifications" && unread > 0 && (
                  <span
                    className={`mr-auto rounded-full px-2 py-0.5 text-xs font-black ${
                      active ? "bg-zinc-950 text-amber-400" : "bg-amber-500 text-zinc-950"
                    }`}
                  >
                    {unread}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </aside>

      {/* ── Main Content (Extra bottom padding on mobile for the fixed nav bar) ── */}
      <div className="min-w-0 flex-1 space-y-6 pb-24 lg:pb-8">
        {/* PWA install (Android/Chrome) + iOS install guide */}
        <InstallPrompt />
        <IOSInstallGuide />
        {children}
      </div>

      {/* ── Persistent Bottom Navigation Bar for Mobile (Visible on < lg screens) ── */}
      <nav
        aria-label="التنقل السفلي للهاتف"
        className="fixed bottom-0 inset-x-0 z-50 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-lg px-2 py-1.5 shadow-2xl lg:hidden safe-area-pb"
      >
        <div className="mx-auto flex max-w-md items-center justify-around">
          {nav.map((item) => {
            const active = isItemActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-1 flex-col items-center justify-center py-1 text-center transition-all ${
                  active ? "text-amber-400 scale-105 font-bold" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {/* Icon with notification badge */}
                <div className="relative">
                  <span className="text-xl leading-none">{item.icon}</span>
                  {item.href === "/admin/notifications" && unread > 0 && (
                    <span className="absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-black text-zinc-950 ring-2 ring-zinc-950 animate-pulse">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </div>

                {/* Short label */}
                <span className="mt-1 text-[10px] sm:text-[11px] leading-tight tracking-tight">
                  {item.label}
                </span>

                {/* Active indicator bar */}
                {active && (
                  <span className="mt-0.5 h-1 w-5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
