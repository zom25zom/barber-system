"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getCustomerToken } from "@/lib/auth";
import { formatDateTime } from "@/lib/time";
import { useLiveNotifications } from "@/lib/useNotifications";
import { enableWebPushNotifications } from "@/lib/push";
import Spinner from "@/components/Spinner";
import PushDiagnostics from "@/components/PushDiagnostics";
import type { AppNotification } from "@/lib/types";

export default function CustomerNotificationsPage() {
  const router = useRouter();
  const token = getCustomerToken();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushStatus, setPushStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!token) router.replace("/login");
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
      setPushStatus("✓ تم تفعيل إشعارات الهاتف بنجاح! ستصلك التنبيهات حتى عند إغلاق المتصفح.");
    } else {
      setPushStatus("يرجى السماح بإذن الإشعارات من إعدادات المتصفح في هاتفك.");
    }
  }

  if (!token) return null;

  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-100">الإشعارات والتنبيهات</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleEnablePush}
            className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-amber-400 hover:bg-amber-500/20 transition-colors"
          >
            🔔 تفعيل إشعارات الهاتف
          </button>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="rounded-xl border border-zinc-700 px-3.5 py-1.5 text-xs sm:text-sm text-zinc-400 hover:bg-zinc-800 transition"
            >
              تعليم الكل كمقروء
            </button>
          )}
        </div>
      </div>

      {pushStatus && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs sm:text-sm text-amber-300 text-center">
          {pushStatus}
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
          <Spinner size="lg" label="جاري تحميل الإشعارات…" />
        </div>
      )}

      {!loading && notifications.length === 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-zinc-400">
          لا توجد إشعارات جديدة حالياً.
        </div>
      )}

      <div className="space-y-3">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`rounded-2xl border p-4 transition-all ${
              n.is_read
                ? "border-zinc-800/60 bg-zinc-900/40 opacity-70"
                : "border-amber-500/40 bg-zinc-900 shadow-md"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <span className="inline-block rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-400">
                  {n.type === "new_booking"
                    ? "حجز جديد"
                    : n.type === "cancellation"
                      ? "إلغاء حجز"
                      : "الموعد متاح"}
                </span>
                <p className="text-sm font-medium text-zinc-200 mt-1">{n.message}</p>
              </div>
              <span className="text-xs text-zinc-500 shrink-0">
                {formatDateTime(n.created_at)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <PushDiagnostics role="customer" />
    </div>
  );
}
