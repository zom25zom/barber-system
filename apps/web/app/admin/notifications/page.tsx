"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getOwnerToken } from "@/lib/auth";
import { formatDateTime } from "@/lib/time";
import { useLiveNotifications } from "@/lib/useNotifications";
import { enableWebPushNotifications } from "@/lib/push";
import Spinner from "@/components/Spinner";
import PushDiagnostics from "@/components/PushDiagnostics";
import { useToast } from "@/components/Toaster";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BellRing } from "lucide-react";
import type { AppNotification } from "@/lib/types";

export default function AdminNotificationsPage() {
  const router = useRouter();
  const token = getOwnerToken();
  const toast = useToast();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  // Button only shows while push permission is not yet granted
  const [pushEnabled, setPushEnabled] = useState<boolean>(
    () => typeof window !== "undefined" && "Notification" in window && Notification.permission !== "granted"
  );

  useEffect(() => {
    if (!token) router.replace("/admin/login");
  }, [token, router]);

  const load = useCallback(() => {
    if (!token) return;
    apiFetch<{ notifications: AppNotification[] }>("/api/owner/notifications", { token })
      .then((d) => setNotifications(d.notifications))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useLiveNotifications("owner", () => load());

  async function markAllRead() {
    if (!token) return;
    try {
      await apiFetch("/api/owner/notifications/read-all", { method: "POST", token });
      toast.success("تم تعليم جميع الإشعارات كمقروءة ✓");
      load();
    } catch {
      toast.error("حدث خطأ أثناء تحديث حالة الإشعارات");
    }
  }

  async function handleEnablePush() {
    setPushStatus("جاري التفعيل والاشتراك في إشعارات الهاتف…");
    const ok = await enableWebPushNotifications("owner");
    if (ok) {
      // Permission granted → hide the button entirely
      setPushEnabled(false);
      const msg = "✓ تم تفعيل الإشعارات بنجاح!";
      setPushStatus(msg);
      toast.success(msg);
    } else {
      const msg = "يرجى التأكد من السماح بالإشعارات في إعدادات المتصفح.";
      setPushStatus(msg);
      toast.warning(msg);
    }
  }

  if (!token) return null;

  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--bs-text)]">إشعارات وتنبيهات الإدارة</h1>
        <div className="flex items-center gap-2">
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
      </div>

      {pushStatus && (
        <div className="rounded-xl border border-[var(--bs-primary)]/30 bg-[var(--bs-primary-soft)] p-3 text-xs sm:text-sm text-[var(--bs-primary)] text-center">
          {pushStatus}
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-[var(--bs-border)] bg-[var(--bs-surface)]/50 p-12 text-center">
          <Spinner size="lg" label="جاري تحميل الإشعارات…" />
        </div>
      )}

      {!loading && notifications.length === 0 && (
        <div className="rounded-2xl border border-[var(--bs-border)] bg-[var(--bs-surface)]/40 p-8 text-center text-[var(--bs-text-muted)]">
          لا توجد إشعارات حالياً.
        </div>
      )}

      <div className="space-y-3">
        {notifications.map((n) => (
          <Card
            key={n.id}
            className={`relative p-4 transition-all ${
              n.is_read
                ? "border-[var(--bs-border)]/60 bg-[var(--bs-surface)]/40 opacity-70"
                : "border-[var(--bs-primary)]/40 bg-[var(--bs-surface)] shadow-md"
            }`}
          >
            {/* Gold unread dot — consistent with Navbar/AdminClientLayout/customer inbox */}
            {!n.is_read && (
              <span
                aria-label="غير مقروء"
                className="absolute -right-1.5 top-5 h-2.5 w-2.5 rounded-full bg-[var(--bs-primary)] shadow-sm shadow-[var(--bs-primary)]/60"
              />
            )}
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <span className="inline-block rounded-lg bg-[var(--bs-primary-soft)] border border-[var(--bs-primary)]/20 px-2.5 py-0.5 text-xs font-bold text-[var(--bs-primary)]">
                  {n.type === "new_booking"
                    ? "حجز جديد"
                    : n.type === "cancellation"
                      ? "إلغاء حجز"
                      : "الموعد متاح"}
                </span>
                <p className={`mt-1 text-sm font-medium ${n.is_read ? "text-[var(--bs-text-muted)]" : "text-[var(--bs-text)]"}`}>
                  {n.message}
                </p>
              </div>
              <span className="text-xs text-[var(--bs-text-faint)] shrink-0">
                {formatDateTime(n.created_at)}
              </span>
            </div>
          </Card>
        ))}
      </div>

      <PushDiagnostics role="owner" />
    </div>
  );
}
