"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Spinner from "@/components/Spinner";
import { formatTime12 } from "@/lib/time";
import { useToast } from "@/components/Toaster";

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
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            متصل ويعمل ✅
          </span>
        );
      case "degraded":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-400">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            أداء جزئي ⚠️
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-400">
            <span className="h-2 w-2 rounded-full bg-red-400" />
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
            <Link
              href="/admin"
              className="rounded-xl border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition"
            >
              ← الإدارة
            </Link>
            <h1 className="text-2xl font-extrabold text-zinc-100 flex items-center gap-2">
              <span>🩺</span> فحص حالة النظام والخدمات
            </h1>
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            صفحة تشخيصية سرية للتأكد من سلامة اتصال D1 Database و Push Notifications والتخزين بعد النشر.
          </p>
        </div>

        <button
          type="button"
          onClick={() => checkHealth(true)}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-zinc-950 hover:bg-amber-400 transition active:scale-95 disabled:opacity-50 shadow-md"
        >
          {loading ? (
            <>
              <Spinner size="sm" color="zinc" />
              <span>جاري الفحص…</span>
            </>
          ) : (
            <>
              <span>🔄</span>
              <span>إعادة فحص النظام الآن</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-400 flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="text-xs text-red-300 hover:underline">
            إغلاق
          </button>
        </div>
      )}

      {/* Overall Health Status Banner */}
      {data && (
        <div
          className={`rounded-2xl border p-5 transition-all ${
            data.ok
              ? "border-emerald-500/40 bg-emerald-500/5 shadow-lg shadow-emerald-950/20"
              : "border-amber-500/40 bg-amber-500/5"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 text-2xl border border-zinc-800 shadow-inner">
                {data.ok ? "🟢" : "🟡"}
              </div>
              <div>
                <h2 className="text-base font-bold text-zinc-100">
                  {data.ok ? "جميع خدمات النظام تعمل بكفاءة عالية" : "بعض الخدمات تواجه بطء أو استجابة جزئية"}
                </h2>
                <p className="text-xs text-zinc-400">
                  زمن الاستجابة الكلي: <span className="font-mono text-amber-400">{data.totalLatencyMs}ms</span> | آخر فحص: {lastChecked}
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
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 space-y-4 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🗄️</span>
              <h3 className="font-bold text-zinc-100 text-sm">قاعدة البيانات D1</h3>
            </div>
            {data ? getStatusBadge(data.services.database.status) : <Spinner size="sm" />}
          </div>

          <div className="space-y-2 border-t border-zinc-800/80 pt-3 text-xs text-zinc-300">
            <div className="flex justify-between">
              <span className="text-zinc-400">المزود:</span>
              <span className="font-mono text-zinc-200">Cloudflare D1 (barber_db)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">زمن الاستعلام (Latency):</span>
              <span className="font-mono text-amber-400">
                {data?.services.database.latencyMs != null ? `${data.services.database.latencyMs}ms` : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">عدد الجداول النشطة:</span>
              <span className="font-mono text-zinc-200">{data?.services.database.tablesCount ?? "—"} جداول</span>
            </div>
          </div>
        </div>

        {/* Card 2: Push Notifications & Durable Objects */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 space-y-4 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🔔</span>
              <h3 className="font-bold text-zinc-100 text-sm">خدمة الإشعارات الفورية</h3>
            </div>
            {data ? getStatusBadge(data.services.pushService.status) : <Spinner size="sm" />}
          </div>

          <div className="space-y-2 border-t border-zinc-800/80 pt-3 text-xs text-zinc-300">
            <div className="flex justify-between">
              <span className="text-zinc-400">المزود:</span>
              <span className="font-mono text-zinc-200">Durable Objects + WebSockets</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">زمن الاتصال (Hub Ping):</span>
              <span className="font-mono text-amber-400">
                {data?.services.pushService.latencyMs != null ? `${data.services.pushService.latencyMs}ms` : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">حالة الربط:</span>
              <span className="text-emerald-400 font-medium">NotificationHub Ready</span>
            </div>
          </div>
        </div>

        {/* Card 3: Storage & Uploads */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 space-y-4 shadow-md sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🖼️</span>
              <h3 className="font-bold text-zinc-100 text-sm">تخزين ورفع الصور</h3>
            </div>
            {data ? getStatusBadge(data.services.storage.status) : <Spinner size="sm" />}
          </div>

          <div className="space-y-2 border-t border-zinc-800/80 pt-3 text-xs text-zinc-300">
            <div className="flex justify-between">
              <span className="text-zinc-400">طريقة التخزين:</span>
              <span className="font-mono text-zinc-200">
                {data?.services.storage.r2Bound ? "Cloudflare R2 Bucket" : "D1 High-Perf Blob Storage"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">نقطة الرفع:</span>
              <span className="font-mono text-zinc-200">POST /api/upload</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">نقطة العرض:</span>
              <span className="font-mono text-zinc-200">GET /api/uploads/:key</span>
            </div>
          </div>
        </div>
      </div>

      {/* Logs & Diagnostics Info */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-3">
        <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
          <span>📋</span> معلومات المراقبة وتسجيل الأخطاء (Error Logging)
        </h3>
        <p className="text-xs text-zinc-400 leading-relaxed">
          يتم تسجيل جميع الأخطاء الاستثنائية والطلبات الفاشلة عبر تنسيق <code className="rounded bg-zinc-950 px-1.5 py-0.5 font-mono text-amber-400">[ROUTE_ERROR]</code> و <code className="rounded bg-zinc-950 px-1.5 py-0.5 font-mono text-amber-400">[WORKER_ERROR]</code> يشمل الوقت، نوع الخطأ، ونقطة الـ API، ويمكن متابعتها حياً عبر لوحة Cloudflare Workers Logs.
        </p>
      </div>
    </div>
  );
}
