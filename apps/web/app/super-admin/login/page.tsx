"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { setSuperAdminToken } from "@/lib/auth";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CircleAlert, ShieldCheck } from "lucide-react";

/**
 * /super-admin/login — the PLATFORM OWNER's entry point.
 *
 * Deliberately visually distinct from the salon-owner admin login: a single
 * centered "control console" card with a shield motif and amber-on-charcoal
 * platform branding. Not linked from any public or tenant navigation.
 */
export default function SuperAdminLoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const d = await apiFetch<{ token: string }>("/api/super-admin/login", {
        method: "POST",
        body: { username, password },
      });
      setSuperAdminToken(d.token);
      toast.success("تم تسجيل الدخول إلى لوحة مالك المنصة ✓");
      router.push("/super-admin/dashboard");
    } catch (err) {
      const msg = (err as Error).message || "بيانات الدخول غير صحيحة";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bs-skin mx-auto flex min-h-[70vh] w-full max-w-md items-center py-8">
      <div className="bs-panel w-full overflow-hidden">
        {/* ── platform-owner banner strip ── */}
        <div className="relative overflow-hidden border-b border-[var(--bs-border)] bg-[var(--bs-surface-raised)] px-7 py-6 sm:px-9">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 90% 120% at 85% -30%, rgba(201,162,39,0.20), transparent 65%)",
            }}
          />
          <div className="bs-grain" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--bs-primary)]/40 bg-[var(--bs-primary-soft)]">
              <ShieldCheck className="h-5 w-5 text-[var(--bs-primary)]" />
            </div>
            <div>
              <p className="text-[10px] font-black tracking-[0.3em] text-[var(--bs-primary)]" dir="ltr">
                PLATFORM OWNER
              </p>
              <p className="mt-0.5 text-sm font-bold text-[var(--bs-text)]">منطقة تحكم المنصة</p>
            </div>
          </div>
        </div>

        {/* ── form ── */}
        <section className="p-7 sm:p-9">
          <h1 className="text-2xl font-black tracking-tight text-[var(--bs-text)] [text-wrap:balance] sm:text-[1.7rem]">دخول المالك العام</h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--bs-text-muted)]">
            بوابة مخصصة لإدارة الصالونات والاشتراكات — ليست لوحة الصالون
          </p>

          <form onSubmit={onSubmit} className="mt-7 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="sa-username">اسم المستخدم</Label>
              <Input
                id="sa-username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="المالك العام"
                autoComplete="username"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sa-password">كلمة المرور</Label>
              <Input
                id="sa-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-[var(--bs-error)]/40 bg-[var(--bs-error-soft)] p-3 text-xs text-[var(--bs-error)] sm:text-sm">
                <CircleAlert className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full py-3 text-base">
              {loading ? (
                <>
                  <Spinner size="sm" color="zinc" />
                  <span>جاري التحقق…</span>
                </>
              ) : (
                "فتح لوحة المنصة ←"
              )}
            </Button>
          </form>

          <p className="mt-6 border-t border-[var(--bs-border)] pt-5 text-center text-[11px] leading-relaxed text-[var(--bs-text-faint)]">
            <span className="font-bold text-[var(--bs-text-muted)]">جلسة محمية</span> — صلاحية 12 ساعة
            فقط، مع تقييد عدد محاولات الدخول
          </p>
        </section>
      </div>
    </div>
  );
}
