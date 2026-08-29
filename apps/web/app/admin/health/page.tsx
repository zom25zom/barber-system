"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Spinner from "@/components/Spinner";
import { formatTime12 } from "@/lib/time";
import { useToast } from "@/components/Toaster";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CircleAlert, ClipboardList, RefreshCw } from "lucide-react";

interface ServiceHealth {
  name: string;
  status: "connected" | "active" | "ready" | "degraded" | "error" | "disabled" | "disconnected";
  latencyMs?: number;
  tablesCount?: number;
  r2Bound?: boolean;
}

interface HealthResponse {
  ok: boolean;
  status: "healthy" | "degraded" | "error";
  timestamp: string;
  totalLatencyMs: number;
  services: {
    database: ServiceHealth;
    pushService: ServiceHealth;
    storage: ServiceHealth;
  };
}

export default function AdminHealthPage() {
  const toast = useToast();
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const checkHealth = useCallback(async (isManual?: boolean) => {
    setLoading(true);
    setError(null);

    try {
      // apiFetch applies API_BASE — required in split deployments where the
      // API lives on a different worker origin (raw "/api/health" would hit
      // the web worker and 404).
      const json = await apiFetch<HealthResponse>("/api/health");
      setData(json);
      setLastChecked(formatTime12(new Date()));
      if (isManual) {
        toast.success("تم فحص جميع خدمات النظام بنجاح ✓");
      }
    } catch (err) {
      const msg = (err as Error).message || "تعذر الوصول إلى نقطة فحص النظام";
      setError(msg);
      if (isManual) {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
      case "active":
      case "ready":
      case "healthy":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--bs-success)]/40 bg-[var(--bs-success-soft)] px-3 py-1 text-xs font-bold text-[var(--bs-success)]">
            <span className="h-2 w-2 rounded-full bg-[var(--bs-success)] animate-pulse" />
            متصل ويعمل ✅
          </span>
        );
      case "degraded":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--bs-warning)]/40 bg-[var(--bs-warning-soft)] px-3 py-1 text-xs font-bold text-[var(--bs-warning)]">
            <span className="h-2 w-2 rounded-full bg-[var(--bs-warning)]" />
            أداء جزئي ⚠️
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--bs-error)]/40 bg-[var(--bs-error-soft)] px-3 py-1 text-xs font-bold text-[var(--bs-error)]">
            <span className="h-2 w-2 rounded-full bg-[var(--bs-error)]" />
            غير متصل ❌
          </span>
        );
    }
  };

  return (
    <div className="bs-skin space-y-10">
      {/* Header */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Link
            href="/admin"
            className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-[var(--bs-text-faint)] transition hover:text-[var(--bs-primary)]"
          >
            ← الإدارة
          </Link>
          <p className="mb-1 flex items-center gap-2.5 text-[11px] font-bold tracking-[0.25em] text-[var(--bs-primary)]">
            <span className="inline-block h-px w-8 bg-[var(--bs-primary)]/60" />
            تشخيص النظام
          </p>
          <h1 className="text-2xl font-black text-[var(--bs-text)] sm:text-3xl">فحص حالة النظام والخدمات</h1>
          <p className="mt-2 max-w-lg text-xs leading-relaxed text-[var(--bs-text-muted)]">
            صفحة تشخيصية سرية للتأكد من سلامة اتصال D1 Database و Push Notifications والتخزين بعد النشر.
          </p>
        </div>

        <Button type="button" onClick={() => checkHealth(true)} disabled={loading} className="shrink-0">
          {loading ? (
            <>
              <Spinner size="sm" color="zinc" />
              <span>جاري الفحص…</span>
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              <span>إعادة فحص النظام الآن</span>
            </>
          )}
        </Button>
      </header>

      {error && (
        <div className="rounded-2xl border border-[var(--bs-error)]/40 bg-[var(--bs-error-soft)] p-4 text-sm text-[var(--bs-error)] flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CircleAlert className="h-4 w-4 shrink-0" /> {error}
          </span>
          <button onClick={() => setError(null)} className="text-xs text-[var(--bs-error)] underline opacity-80 hover:opacity-100">
            إغلاق
          </button>
        </div>
      )}

      {/* Overall Health Status — the focal element of this page */}
      {data && (
        <div
          className={`relative overflow-hidden rounded-3xl border p-6 transition-all sm:p-8 ${
            data.ok
              ? "border-[var(--bs-success)]/40 bg-[var(--bs-success-soft)]/50"
              : "border-[var(--bs-warning)]/40 bg-[var(--bs-warning-soft)]/50"
          }`}
        >
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-[11px] font-bold tracking-[0.2em] text-[var(--bs-text-muted)]">الحالة العامة للنظام</p>
              <h2 className="mt-2 text-2xl font-black text-[var(--bs-text)] sm:text-3xl">
                {data.ok ? "جميع الخدمات تعمل بكفاءة عالية" : "بعض الخدمات تواجه بطء أو استجابة جزئية"}
              </h2>
              <p className="mt-2 text-xs text-[var(--bs-text-muted)]">
                زمن الاستجابة الكلي: <span className="font-mono font-bold text-[var(--bs-primary)]">{data.totalLatencyMs}ms</span> · آخر فحص: {lastChecked}
              </p>
            </div>
            {getStatusBadge(data.status)}
          </div>
        </div>
      )}

      {/* Services — asymmetric grid: DB gets the wide primary treatment */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Card 1: Cloudflare D1 Database — primary, floating */}
        <Card className="bs-panel space-y-4 p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-[var(--bs-text)]">قاعدة البيانات D1</h3>
            {data ? getStatusBadge(data.services.database.status) : <Spinner size="sm" />}
          </div>

          <div className="divide-y divide-[var(--bs-border)] border-t border-[var(--bs-border)] pt-1 text-xs text-[var(--bs-text-muted)]">
            <div className="flex justify-between py-2">
              <span>المزود:</span>
              <span className="font-mono text-[var(--bs-text)]">Cloudflare D1 (barber_db)</span>
            </div>
            <div className="flex justify-between py-2">
              <span>زمن الاستعلام (Latency):</span>
              <span className="font-mono font-bold text-[var(--bs-primary)]">
                {data?.services.database.latencyMs != null ? `${data.services.database.latencyMs}ms` : "—"}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span>عدد الجداول النشطة:</span>
              <span className="font-mono text-[var(--bs-text)]">{data?.services.database.tablesCount ?? "—"} جداول</span>
            </div>
          </div>
        </Card>

        {/* Card 2: Push Notifications & Durable Objects */}
        <Card className="space-y-4 rounded-3xl border border-[var(--bs-border)] bg-[var(--bs-surface)]/60 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-[var(--bs-text)]">الإشعارات الفورية</h3>
            {data ? getStatusBadge(data.services.pushService.status) : <Spinner size="sm" />}
          </div>

          <div className="divide-y divide-[var(--bs-border)] border-t border-[var(--bs-border)] pt-1 text-xs text-[var(--bs-text-muted)]">
            <div className="flex justify-between py-2">
              <span>المزود:</span>
              <span className="font-mono text-[var(--bs-text)]">Durable Objects + WS</span>
            </div>
            <div className="flex justify-between py-2">
              <span>زمن الاتصال (Hub Ping):</span>
              <span className="font-mono font-bold text-[var(--bs-primary)]">
                {data?.services.pushService.latencyMs != null ? `${data.services.pushService.latencyMs}ms` : "—"}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span>حالة الربط:</span>
              <span className="font-medium text-[var(--bs-success)]">NotificationHub Ready</span>
            </div>
          </div>
        </Card>

        {/* Card 3: Storage & Uploads */}
        <Card className="space-y-4 rounded-3xl border border-[var(--bs-border)] bg-[var(--bs-surface)]/60 p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-[var(--bs-text)]">تخزين ورفع الصور</h3>
            {data ? getStatusBadge(data.services.storage.status) : <Spinner size="sm" />}
          </div>

          <div className="divide-y divide-[var(--bs-border)] border-t border-[var(--bs-border)] pt-1 text-xs text-[var(--bs-text-muted)]">
            <div className="flex justify-between py-2">
              <span>طريقة التخزين:</span>
              <span className="font-mono text-[var(--bs-text)]">
                {data?.services.storage.r2Bound ? "Cloudflare R2 Bucket" : "D1 High-Perf Blob Storage"}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span>نقطة الرفع:</span>
              <span className="font-mono text-[var(--bs-text)]">POST /api/upload</span>
            </div>
            <div className="flex justify-between py-2">
              <span>نقطة العرض:</span>
              <span className="font-mono text-[var(--bs-text)]">GET /api/uploads/:key</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Logs & Diagnostics Info */}
      <Card className="space-y-3 bg-[var(--bs-surface)]/50 p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--bs-text)]">
          <ClipboardList className="h-4 w-4 text-[var(--bs-primary)]" /> معلومات المراقبة وتسجيل الأخطاء (Error Logging)
        </h3>
        <p className="text-xs leading-relaxed text-[var(--bs-text-muted)]">
          يتم تسجيل جميع الأخطاء الاستثنائية والطلبات الفاشلة عبر تنسيق <code className="rounded bg-[var(--bs-bg)] px-1.5 py-0.5 font-mono text-[var(--bs-primary)]">[ROUTE_ERROR]</code> و <code className="rounded bg-[var(--bs-bg)] px-1.5 py-0.5 font-mono text-[var(--bs-primary)]">[WORKER_ERROR]</code> يشمل الوقت، نوع الخطأ، ونقطة الـ API، ويمكن متابعتها حياً عبر لوحة Cloudflare Workers Logs.
        </p>
      </Card>
    </div>
  );
}
