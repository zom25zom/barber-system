"use client";
import { useTenantLink } from "@/lib/salonTenant";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getCustomerToken } from "@/lib/auth";
import { formatDateTime } from "@/lib/time";
import { useLiveNotifications } from "@/lib/useNotifications";
import { enableWebPushNotifications } from "@/lib/push";
import Spinner from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { BellRing } from "lucide-react";
import type { AppNotification } from "@/lib/types";

export function NotificationsClient({ salonSlug }: { salonSlug?: string }) {
  const tLink = useTenantLink();
  const router = useRouter();
  const token = getCustomerToken();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  // Button only shows while push permission is not yet granted
  const [pushEnabled, setPushEnabled] = useState<boolean>(
    () => typeof window !== "undefined" && "Notification" in window && Notification.permission !== "granted"
  );

  useEffect(() => {
    if (!token) router.replace(tLink.href("/login"));
  }, [token, router]);

  const load = useCallback(() => {
    if (!token) return;
    apiFetch<{ notifications: AppNotification[] }>("/api/customer/notifications", { token })
      .then((d) => setNotifications(d.notifications))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useLiveNotifications("customer", () => load());

  async function markAllRead() {
    if (!token) return;
    await apiFetch("/api/customer/notifications/read-all", { method: "POST", token });
    load();
  }

  async function handleEnablePush() {
    setPushStatus("جاري التفعيل والاشتراك…");
    const ok = await enableWebPushNotifications("customer");
    if (ok) {
      // Permission granted → hide the button entirely
      setPushEnabled(false);
      setPushStatus("✓ تم تفعيل الإشعارات بنجاح! ستصلك التنبيهات حتى عند إغلاق المتصفح.");
    } else {
      setPushStatus("يرجى السماح بإذن الإشعارات من إعدادات المتصفح في هاتفك.");
    }
  }

  if (!token) return null;

  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="bs-skin mx-auto max-w-2xl pb-4">
      {/* ── header ── */}
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 flex items-center gap-2.5 text-[11px] font-bold tracking-[0.25em] text-[var(--bs-primary)]">
            <span className="inline-block h-px w-8 bg-[var(--bs-primary)]/60" />
            مركز التنبيهات
          </p>
          <h1 className="text-2xl font-black text-[var(--bs-text)] sm:text-3xl">
            الإشعارات
            {unread > 0 && (
              <span className="mr-3 align-middle text-base font-bold text-[var(--bs-text-faint)]">
                {unread} غير مقروءة
              </span>
            )}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {pushEnabled && (
            <Button variant="secondary" size="sm" onClick={handleEnablePush}>
              <BellRing className="h-4 w-4" /> تفعيل الإشعارات
            </Button>
          )}
          {unread > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              تعليم الكل كمقروء
            </Button>
          )}
        </div>
      </header>

      {pushStatus && (
        <div className="mt-5 rounded-xl border border-[var(--bs-primary)]/30 bg-[var(--bs-primary-soft)] p-3 text-center text-xs text-[var(--bs-primary)] sm:text-sm">
          {pushStatus}
        </div>
      )}

      {loading && (
        <div className="py-16 text-center">
          <Spinner size="lg" label="جاري تحميل الإشعارات…" />
        </div>
      )}

      {!loading && notifications.length === 0 && (
        <div className="py-14 text-center text-sm text-[var(--bs-text-muted)]">
          <span className="mb-3 block text-4xl">🔔</span>
          لا توجد إشعارات جديدة حالياً.
        </div>
      )}

      {/* ── timeline: vertical rule + unread dots, no boxed cards ── */}
      {!loading && notifications.length > 0 && (
        <ol className="relative mt-8 space-y-1 border-r border-[var(--bs-border)] pr-5">
          {notifications.map((n) => (
            <li key={n.id} className="relative">
              {/* timeline dot — gold filled when unread, hollow when read */}
              <span
                aria-label={n.is_read ? undefined : "غير مقروء"}
                className={`absolute -right-[26px] top-5 h-3 w-3 rounded-full border-2 ${
                  n.is_read
                    ? "border-[var(--bs-border-strong)] bg-[var(--bs-bg)]"
                    : "border-[var(--bs-primary)] bg-[var(--bs-primary)] shadow-md shadow-[var(--bs-primary)]/50"
                }`}
              />

              <div
                className={`rounded-2xl px-4 py-4 transition-colors ${
                  n.is_read ? "text-[var(--bs-text-muted)]" : "bg-[var(--bs-surface)] shadow-md"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1.5">
                    <span className="block text-[11px] font-bold tracking-[0.2em] text-[var(--bs-primary)]">
                      {n.type === "new_booking"
                        ? "حجز جديد"
                        : n.type === "cancellation"
                          ? "إلغاء حجز"
                          : "الموعد متاح"}
                    </span>
                    <p
                      className={`text-sm leading-relaxed ${
                        n.is_read ? "text-[var(--bs-text-muted)]" : "font-medium text-[var(--bs-text)]"
                      }`}
                    >
                      {n.message}
                    </p>
                  </div>
                  <span className="shrink-0 pt-0.5 text-[11px] text-[var(--bs-text-faint)]">
                    {formatDateTime(n.created_at)}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default NotificationsClient;
