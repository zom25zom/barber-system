"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { getCustomerToken, getOwnerToken } from "@/lib/auth";
import { formatDateTime } from "@/lib/time";

interface DiagnosticState {
  notificationPermission: NotificationPermission | "unsupported";
  serviceWorkerState: "unsupported" | "not-registered" | "installing" | "waiting" | "active" | "error";
  pushSubscription: "unsupported" | "not-subscribed" | "subscribed" | "error";
  pushEndpoint: string;
  isPWA: boolean;
  hasPushManager: boolean;
}

interface TestResult {
  ok: boolean;
  push_results: Array<{
    subId: number;
    endpoint: string;
    status: number;
    statusText: string;
    success: boolean;
    error?: string;
    removed?: boolean;
  }>;
  total_subscriptions: number;
  subscriptions: Array<{
    id: number;
    user_type: string;
    customer_id: number | null;
    endpoint: string;
    created_at: string;
  }>;
}

export default function PushDiagnostics({ role }: { role: "customer" | "owner" }) {
  const [state, setState] = useState<DiagnosticState>({
    notificationPermission: "unsupported",
    serviceWorkerState: "unsupported",
    pushSubscription: "unsupported",
    pushEndpoint: "",
    isPWA: false,
    hasPushManager: false,
  });
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const diagnose = useCallback(async () => {
    const next: DiagnosticState = { ...state };

    // 1. Notification permission
    if (typeof window !== "undefined" && "Notification" in window) {
      next.notificationPermission = Notification.permission;
    }

    // 2. PWA check (standalone mode)
    if (typeof window !== "undefined") {
      next.isPWA =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;
    }

    // 3. PushManager support
    if (typeof window !== "undefined" && "PushManager" in window) {
      next.hasPushManager = true;
    }

    // 4. Service Worker
    if ("serviceWorker" in navigator) {
      try {
        const reg = (await navigator.serviceWorker.getRegistration("/")) || (await navigator.serviceWorker.getRegistration("/sw.js")) || (await navigator.serviceWorker.ready);
        if (reg) {
          if (reg.active) next.serviceWorkerState = "active";
          else if (reg.waiting) next.serviceWorkerState = "waiting";
          else if (reg.installing) next.serviceWorkerState = "installing";
          else next.serviceWorkerState = "not-registered";

          // 5. Push subscription
          if (reg.pushManager) {
            const sub = await reg.pushManager.getSubscription();
            if (sub) {
              next.pushSubscription = "subscribed";
              next.pushEndpoint =
                sub.endpoint.length > 60
                  ? sub.endpoint.substring(0, 30) + "..." + sub.endpoint.substring(sub.endpoint.length - 20)
                  : sub.endpoint;
            } else {
              next.pushSubscription = "not-subscribed";
            }
          }
        } else {
          next.serviceWorkerState = "not-registered";
          next.pushSubscription = "not-subscribed";
        }
      } catch {
        next.serviceWorkerState = "error";
        next.pushSubscription = "error";
      }
    }

    setState(next);
  }, []);

  useEffect(() => {
    diagnose();
  }, [diagnose]);

  const sendTestPush = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const token = role === "customer" ? getCustomerToken() : getOwnerToken();
      const result = await apiFetch<TestResult>("/api/push/test", {
        method: "POST",
        token,
        body: {
          userType: role,
          customerId: null,
        },
      });
      setTestResult(result);
    } catch (err: any) {
      setTestResult({
        ok: false,
        push_results: [
          {
            subId: 0,
            endpoint: "N/A",
            status: 0,
            statusText: "CLIENT_ERROR",
            success: false,
            error: err.message || "فشل الاتصال",
          },
        ],
        total_subscriptions: 0,
        subscriptions: [],
      });
    }
    setTesting(false);
    // Re-diagnose after test
    setTimeout(diagnose, 500);
  };

  const statusIcon = (ok: boolean) => (ok ? "✅" : "❌");

  return (
    <div style={{
      marginTop: "2rem",
      padding: "1.25rem",
      borderRadius: "1rem",
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: "none",
          border: "none",
          color: "#a1a1aa",
          cursor: "pointer",
          fontSize: "0.9rem",
          fontFamily: "Tajawal, sans-serif",
          width: "100%",
          textAlign: "right",
          padding: 0,
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <span style={{ transform: expanded ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.2s" }}>▶</span>
        🔧 تشخيص حالة الإشعارات
      </button>

      {expanded && (
        <div style={{ marginTop: "1rem" }}>
          <div style={{ display: "grid", gap: "0.5rem", fontSize: "0.9rem" }}>
            <div>
              {statusIcon(state.notificationPermission === "granted")} صلاحية الإشعارات:{" "}
              <span style={{ color: state.notificationPermission === "granted" ? "#4ade80" : "#f87171", fontWeight: 600 }}>
                {state.notificationPermission === "granted" ? "ممنوحة" : state.notificationPermission === "denied" ? "مرفوضة" : state.notificationPermission === "default" ? "لم تُطلب" : "غير مدعومة"}
              </span>
            </div>

            <div>
              {statusIcon(state.serviceWorkerState === "active")} Service Worker:{" "}
              <span style={{ color: state.serviceWorkerState === "active" ? "#4ade80" : "#f87171", fontWeight: 600 }}>
                {state.serviceWorkerState === "active" ? "مفعّل ✓" : state.serviceWorkerState === "not-registered" ? "غير مسجل" : state.serviceWorkerState === "unsupported" ? "غير مدعوم" : state.serviceWorkerState}
              </span>
            </div>

            <div>
              {statusIcon(state.pushSubscription === "subscribed")} اشتراك Push:{" "}
              <span style={{ color: state.pushSubscription === "subscribed" ? "#4ade80" : "#f87171", fontWeight: 600 }}>
                {state.pushSubscription === "subscribed" ? "مشترك ✓" : state.pushSubscription === "not-subscribed" ? "غير مشترك" : state.pushSubscription === "unsupported" ? "غير مدعوم" : state.pushSubscription}
              </span>
            </div>

            {state.pushEndpoint && (
              <div style={{ color: "#71717a", fontSize: "0.75rem", direction: "ltr", textAlign: "left" }}>
                📡 Endpoint: {state.pushEndpoint}
              </div>
            )}

            <div>
              {statusIcon(state.isPWA)} وضع التطبيق:{" "}
              <span style={{ color: state.isPWA ? "#4ade80" : "#fbbf24", fontWeight: 600 }}>
                {state.isPWA ? "PWA (مثبّت على الشاشة الرئيسية) ✓" : "متصفح عادي — يُنصح بإضافة التطبيق للشاشة الرئيسية"}
              </span>
            </div>

            <div>
              {statusIcon(state.hasPushManager)} PushManager:{" "}
              <span style={{ color: state.hasPushManager ? "#4ade80" : "#f87171", fontWeight: 600 }}>
                {state.hasPushManager ? "مدعوم ✓" : "غير مدعوم في هذا المتصفح"}
              </span>
            </div>
          </div>

          {/* Test Button */}
          <button
            onClick={sendTestPush}
            disabled={testing}
            style={{
              marginTop: "1rem",
              padding: "0.7rem 1.5rem",
              borderRadius: "0.75rem",
              border: "none",
              background: testing ? "#3f3f46" : "linear-gradient(135deg, #f59e0b, #d97706)",
              color: "#fff",
              fontFamily: "Tajawal, sans-serif",
              fontWeight: 700,
              fontSize: "0.9rem",
              cursor: testing ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              width: "100%",
            }}
          >
            {testing ? "⏳ جاري الإرسال..." : "🧪 أرسل إشعار تجريبي"}
          </button>

          {/* Test Results */}
          {testResult && (
            <div style={{
              marginTop: "1rem",
              padding: "1rem",
              borderRadius: "0.75rem",
              background: "rgba(0,0,0,0.3)",
              fontSize: "0.85rem",
            }}>
              <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>
                📋 نتيجة اختبار Push ({testResult.total_subscriptions} اشتراك في قاعدة البيانات)
              </div>

              {testResult.push_results.length === 0 ? (
                <div style={{ color: "#fbbf24" }}>
                  ⚠ لا توجد اشتراكات مسجلة — تأكد من منح صلاحية الإشعارات أولاً
                </div>
              ) : (
                testResult.push_results.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "0.5rem",
                      marginBottom: "0.25rem",
                      borderRadius: "0.5rem",
                      background: r.success ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
                      border: `1px solid ${r.success ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`,
                    }}
                  >
                    <div>
                      {r.success ? "✅" : "❌"} Sub #{r.subId} → {r.status} {r.statusText}
                      {r.removed && " 🗑 (تم حذف الاشتراك المنتهي)"}
                    </div>
                    {r.error && (
                      <div style={{ color: "#f87171", fontSize: "0.75rem", marginTop: "0.25rem", direction: "ltr", textAlign: "left" }}>
                        {r.error}
                      </div>
                    )}
                    <div style={{ color: "#71717a", fontSize: "0.7rem", direction: "ltr", textAlign: "left", marginTop: "0.15rem" }}>
                      {r.endpoint}
                    </div>
                  </div>
                ))
              )}

              {testResult.subscriptions.length > 0 && (
                <details style={{ marginTop: "0.5rem" }}>
                  <summary style={{ cursor: "pointer", color: "#a1a1aa", fontSize: "0.8rem" }}>
                    عرض كل الاشتراكات ({testResult.subscriptions.length})
                  </summary>
                  <div style={{ marginTop: "0.5rem" }}>
                    {testResult.subscriptions.map((s) => (
                      <div key={s.id} style={{ fontSize: "0.75rem", color: "#71717a", marginBottom: "0.25rem" }}>
                        #{s.id} | {s.user_type} | cust_id: {s.customer_id ?? "—"} | {formatDateTime(s.created_at)}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          {/* Refresh button */}
          <button
            onClick={diagnose}
            style={{
              marginTop: "0.5rem",
              padding: "0.5rem",
              borderRadius: "0.5rem",
              border: "1px solid rgba(255,255,255,0.1)",
              background: "transparent",
              color: "#a1a1aa",
              fontFamily: "Tajawal, sans-serif",
              fontSize: "0.8rem",
              cursor: "pointer",
              width: "100%",
            }}
          >
            🔄 تحديث حالة التشخيص
          </button>
        </div>
      )}
    </div>
  );
}
