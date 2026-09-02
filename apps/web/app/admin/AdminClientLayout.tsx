"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getOwnerToken, clearOwnerToken } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { useLiveNotifications } from "@/lib/useNotifications";
import { useOwnerSalonSettings } from "@/lib/salon";
import { useUnreadBadge } from "@/lib/unreadBadge";
import ConfirmModal from "@/components/ConfirmModal";
import RenewalBanner from "@/components/RenewalBanner";
import InstallPrompt from "@/components/InstallPrompt";
import IOSInstallGuide from "@/components/IOSInstallGuide";
import {
  LayoutDashboard,
  BarChart3,
  Scissors,
  CalendarDays,
  Bell,
  Settings,
  UserRound,
  Lock,
  LogOut,
  type LucideIcon,
} from "lucide-react";

const nav: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin", label: "الرئيسية", icon: LayoutDashboard },
  { href: "/admin/reports", label: "التقارير المالية", icon: BarChart3 },
  { href: "/admin/barbers", label: "الحلاقين", icon: Scissors },
  { href: "/admin/bookings", label: "الحجوزات", icon: CalendarDays },
  { href: "/admin/notifications", label: "الإشعارات", icon: Bell },
  { href: "/admin/settings", label: "إعدادات الصالون", icon: Settings },
  { href: "/admin/profile", label: "حسابي", icon: UserRound },
];

export default function AdminClientLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const token = getOwnerToken();
  // Unread badge is SHARED state (lib/unreadBadge.ts): the notifications page
  // updates it instantly after mark-all-read / clear-all, and live WebSocket
  // notifications bump it here — no page reload needed anywhere.
  const [unread, setUnread, bumpUnread] = useUnreadBadge();
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  // ── Subscription enforcement (client mirror of the server-side checks) ──
  // • locked  → the salon's subscription_status is 'expired': the server
  //   rejects every /api/owner/* call with the configurable lockout message,
  //   so the whole panel is replaced by a lockout screen immediately.
  // • renewalBanner → active + within 2 days of the salon's OWN cycle end:
  //   the persistent non-dismissible reminder from platform_settings.
  const [lockoutMessage, setLockoutMessage] = useState<string | null>(null);
  const [renewalBanner, setRenewalBanner] = useState<string | null>(null);
  // Owner-session-scoped branding. Disabled on the login page (no session yet
  // → previously fired a pointless GET /api/salon-settings that 404'd).
  const isLoginPage = pathname === "/admin/login";
  const salon = useOwnerSalonSettings(!isLoginPage && !!token);

  const loadSubscriptionStatus = useCallback(() => {
    if (!token) return;
    apiFetch<{
      status: string;
      renewal_banner: string | null;
    }>("/api/owner/subscription-status", { token })
      .then((d) => {
        setLockoutMessage(null);
        setRenewalBanner(d.renewal_banner ?? null);
      })
      .catch((err: Error & { code?: string }) => {
        if (err.code === "SUBSCRIPTION_EXPIRED") {
          setLockoutMessage(err.message);
          setRenewalBanner(null);
        }
      });
  }, [token]);

  // Re-check on every admin page navigation AND whenever the dashboard
  // regains focus — so a super-admin status change (renewal or lockout)
  // is reflected without waiting for a 403 from the next API call.
  useEffect(() => {
    if (isLoginPage || !token) return;
    loadSubscriptionStatus();
    const onFocus = () => loadSubscriptionStatus();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [pathname, isLoginPage, token, loadSubscriptionStatus]);

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
  }, [token, setUnread]);

  useEffect(() => {
    loadUnread();
  }, [loadUnread]);

  // Live WebSocket notifications are unread by definition → bump the shared
  // badge immediately (the notifications page prepends them to its own list).
  useLiveNotifications("owner", () => bumpUnread());

  if (pathname === "/admin/login") return <>{children}</>;
  if (!token) return null;

  // ── Subscription lockout: the salon was set to 'expired' by the platform
  // owner. Every admin page is replaced by the configurable Arabic lockout
  // message. Cleared automatically once the salon is reactivated (the next
  // status fetch succeeds and the panel renders again).
  if (lockoutMessage) {
    return (
      <div className="bs-skin w-full">
        <div className="mx-auto max-w-lg py-14">
          <div className="bs-panel p-8 text-center sm:p-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--bs-error)]/40 bg-[var(--bs-error-soft)]">
              <Lock className="h-7 w-7 text-[var(--bs-error)]" aria-hidden="true" />
            </div>
            <h1 className="mt-6 text-2xl font-black text-[var(--bs-text)]">لوحة التحكم موقوفة مؤقتاً</h1>
            <p className="mt-4 text-sm leading-relaxed text-[var(--bs-text-muted)]">{lockoutMessage}</p>
            <div className="bs-hairline mx-auto mt-8 max-w-[10rem]" />
            <p className="mt-6 text-xs text-[var(--bs-text-faint)]">
              سيتم استعادة الوصول تلقائياً فور تجديد الاشتراك
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isItemActive = (href: string) => {
    return pathname === href || (href !== "/admin" && pathname.startsWith(href));
  };

  const desktopLinkCls = (href: string) => {
    const active = isItemActive(href);
    return `relative flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-all ${
      active
        ? "bg-[var(--bs-primary-soft)] font-bold text-[var(--bs-primary)]"
        : "font-medium text-[var(--bs-text-muted)] hover:bg-[var(--bs-primary-soft)]/50 hover:text-[var(--bs-text)]"
    }`;
  };

  return (
    <div className="bs-skin w-full">
      {/* ── Logout Confirmation Modal ── */}
      <ConfirmModal
        isOpen={logoutModalOpen}
        title="تأكيد تسجيل الخروج"
        message="هل أنت متأكد من رغبتك في تسجيل الخروج من لوحة تحكم الصالون؟"
        confirmText="نعم، تسجيل الخروج"
        cancelText="إلغاء"
        variant="warning"
        icon={<LogOut className="h-5 w-5 text-[var(--bs-warning)]" aria-hidden="true" />}
        onConfirm={() => {
          setLogoutModalOpen(false);
          clearOwnerToken();
          router.push("/admin/login");
        }}
        onClose={() => setLogoutModalOpen(false)}
      />

      {/* ── Desktop/Tablet Sidebar: fixed to the right edge, always visible ── */}
      <aside
        aria-label="التنقل الجانبي"
        className="fixed inset-y-0 right-0 z-40 hidden w-60 flex-col border-e border-[var(--bs-border)] bg-[var(--bs-surface)]/95 backdrop-blur-lg md:flex"
      >
        <div className="flex-1 space-y-0.5 overflow-y-auto p-3 pt-6">
          {nav.map((item) => {
            const active = isItemActive(item.href);
            return (
              <Link key={item.href} href={item.href} className={desktopLinkCls(item.href)}>
                {/* gold edge marker on the active item (RTL: right side) */}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-2 right-0 w-0.5 rounded-full bg-[var(--bs-primary)]"
                  />
                )}
                <item.icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
                {item.href === "/admin/notifications" && unread > 0 && (
                  <span
                    className={`mr-auto rounded-full px-2 py-0.5 text-xs font-black ${
                      active
                        ? "bg-[var(--bs-primary)] text-[var(--bs-on-primary)]"
                        : "bg-[var(--bs-primary-soft)] text-[var(--bs-primary)]"
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

      {/* ── Main Content ──
          • md+: ms-60 reserves space for the fixed right-edge sidebar
            (logical property → margin-right under RTL).
          • Extra bottom padding on mobile for the fixed bottom nav bar. ── */}
      <div className="min-w-0 space-y-6 pb-24 md:pb-8 md:ms-60 md:me-6">
        {/* Renewal reminder — persistent, non-dismissible, computed per salon */}
        {renewalBanner && <RenewalBanner message={renewalBanner} />}
        {/* PWA install (Android/Chrome) + iOS install guide */}
        <InstallPrompt />
        <IOSInstallGuide />
        {children}
      </div>

      {/* ── Persistent Bottom Navigation Bar for Mobile (Visible on < lg screens) ── */}
      <nav
        aria-label="التنقل السفلي للهاتف"
        className="fixed bottom-0 inset-x-0 z-50 border-t border-[var(--bs-border)] bg-[var(--bs-bg)]/95 px-2 py-1.5 shadow-2xl backdrop-blur-lg md:hidden safe-area-pb"
      >
        <div className="mx-auto flex max-w-md items-center justify-around">
          {nav.map((item) => {
            const active = isItemActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-1 flex-col items-center justify-center py-1 text-center transition-all ${
                  active
                    ? "scale-105 font-bold text-[var(--bs-primary)]"
                    : "text-[var(--bs-text-muted)] hover:text-[var(--bs-text)]"
                }`}
              >
                {/* Icon with notification badge */}
                <div className="relative">
                  <item.icon className="h-5 w-5" />
                  {item.href === "/admin/notifications" && unread > 0 && (
                    <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--bs-primary)] px-1 text-[9px] font-black text-[var(--bs-on-primary)] ring-2 ring-[var(--bs-bg)]">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </div>

                {/* Short label */}
                <span className="mt-1 text-[10px] leading-tight tracking-tight sm:text-[11px]">
                  {item.label}
                </span>

                {/* Active indicator bar */}
                {active && (
                  <span className="mt-0.5 h-1 w-5 rounded-full bg-[var(--bs-primary)] shadow-sm shadow-[var(--bs-primary)]/50" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
