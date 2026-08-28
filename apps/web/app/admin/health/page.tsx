"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Spinner from "@/components/Spinner";
import { formatTime12 } from "@/lib/time";
import { useToast } from "@/components/Toaster";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CircleAlert, Database, Image as ImageIcon, BellRing, ClipboardList, RefreshCw, Stethoscope } from "lucide-react";

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
      const res = await fetch("/api/health", { cache: "no-store" });
      const json = await res.json();
      setData(json as HealthResponse);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin">← الإدارة</Link>
            </Button>
            <h1 className="flex items-center gap-2 text-2xl font-extrabold text-[var(--bs-text)]">
              <Stethoscope className="h-6 w-6 text-[var(--bs-primary)]" /> فحص حالة النظام والخدمات
            </h1>
          </div>
          <p className="mt-1 text-xs text-[var(--bs-text-muted)]">
            صفحة تشخيصية سرية للتأكد من سلامة اتصال D1 Database و Push Notifications والتخزين بعد النشر.
          </p>
        </div>

        <Button type="button" onClick={() => checkHealth(true)} disabled={loading}>
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
      </div>

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

      {/* Overall Health Status Banner */}
      {data && (
        <div
          className={`rounded-2xl border p-5 transition-all ${
            data.ok
              ? "border-[var(--bs-success)]/40 bg-[var(--bs-success-soft)]/60 shadow-lg"
              : "border-[var(--bs-warning)]/40 bg-[var(--bs-warning-soft)]/60"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--bs-border)] bg-[var(--bs-surface-raised)] text-2xl shadow-inner">
                {data.ok ? "🟢" : "🟡"}
              </div>
              <div>
                <h2 className="text-base font-bold text-[var(--bs-text)]">
                  {data.ok ? "جميع خدمات النظام تعمل بكفاءة عالية" : "بعض الخدمات تواجه بطء أو استجابة جزئية"}
                </h2>
                <p className="text-xs text-[var(--bs-text-muted)]">
                  زمن الاستجابة الكلي: <span className="font-mono text-[var(--bs-primary)]">{data.totalLatencyMs}ms</span> | آخر فحص: {lastChecked}
                </p>
              </div>
            </div>
            {getStatusBadge(data.status)}
          </div>
        </div>
      )}

      {/* Services Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: Cloudflare D1 Database */}
        <Card className="space-y-4 p-5 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Database className="h-5 w-5 text-[var(--bs-primary)]" />
              <h3 className="text-sm font-bold text-[var(--bs-text)]">قاعدة البيانات D1</h3>
            </div>
            {data ? getStatusBadge(data.services.database.status) : <Spinner size="sm" />}
          </div>

          <div className="space-y-2 border-t border-[var(--bs-border)]/80 pt-3 text-xs text-[var(--bs-text-muted)]">
            <div className="flex justify-between">
              <span>المزود:</span>
              <span className="font-mono text-[var(--bs-text)]">Cloudflare D1 (barber_db)</span>
            </div>
            <div className="flex justify-between">
              <span>زمن الاستعلام (Latency):</span>
              <span className="font-mono text-[var(--bs-primary)]">
                {data?.services.database.latencyMs != null ? `${data.services.database.latencyMs}ms` : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>عدد الجداول النشطة:</span>
              <span className="font-mono text-[var(--bs-text)]">{data?.services.database.tablesCount ?? "—"} جداول</span>
            </div>
          </div>
        </Card>

        {/* Card 2: Push Notifications & Durable Objects */}
        <Card className="space-y-4 p-5 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <BellRing className="h-5 w-5 text-[var(--bs-primary)]" />
              <h3 className="text-sm font-bold text-[var(--bs-text)]">خدمة الإشعارات الفورية</h3>
            </div>
            {data ? getStatusBadge(data.services.pushService.status) : <Spinner size="sm" />}
          </div>

          <div className="space-y-2 border-t border-[var(--bs-border)]/80 pt-3 text-xs text-[var(--bs-text-muted)]">
            <div className="flex justify-between">
              <span>المزود:</span>
              <span className="font-mono text-[var(--bs-text)]">Durable Objects + WebSockets</span>
            </div>
            <div className="flex justify-between">
              <span>زمن الاتصال (Hub Ping):</span>
              <span className="font-mono text-[var(--bs-primary)]">
                {data?.services.pushService.latencyMs != null ? `${data.services.pushService.latencyMs}ms` : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>حالة الربط:</span>
              <span className="font-medium text-[var(--bs-success)]">NotificationHub Ready</span>
            </div>
          </div>
        </Card>

        {/* Card 3: Storage & Uploads */}
        <Card className="space-y-4 p-5 shadow-md sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ImageIcon className="h-5 w-5 text-[var(--bs-primary)]" />
              <h3 className="text-sm font-bold text-[var(--bs-text)]">تخزين ورفع الصور</h3>
            </div>
            {data ? getStatusBadge(data.services.storage.status) : <Spinner size="sm" />}
          </div>

          <div className="space-y-2 border-t border-[var(--bs-border)]/80 pt-3 text-xs text-[var(--bs-text-muted)]">
            <div className="flex justify-between">
              <span>طريقة التخزين:</span>
              <span className="font-mono text-[var(--bs-text)]">
                {data?.services.storage.r2Bound ? "Cloudflare R2 Bucket" : "D1 High-Perf Blob Storage"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>نقطة الرفع:</span>
              <span className="font-mono text-[var(--bs-text)]">POST /api/upload</span>
            </div>
            <div className="flex justify-between">
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
