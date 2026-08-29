"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { setOwnerToken } from "@/lib/auth";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CircleAlert, Scissors, Store } from "lucide-react";

interface LoginResponse {
  token: string;
  owner: { id: number; username: string };
  salon?: { id: number; name: string; slug: string | null };
}

/**
 * Per-salon admin login page — /{salonSlug}/admin/login
 *
 * The tenant is taken directly from the URL path (no input needed), so this
 * page is ideal for salons with their own branded entry link. After a
 * successful login the owner session is bound to THAT salon server-side and
 * the user lands on the shared dashboard /admin.
 */
export default function SalonAdminLoginPage() {
  const params = useParams<{ salonSlug: string }>();
  const salonSlug = String(params?.salonSlug ?? "");
  const router = useRouter();
  const toast = useToast();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validSlug = /^[a-zA-Z0-9-_]{1,60}$/.test(salonSlug);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // No slug is sent: the backend resolves the salon from username+password
      // alone and binds the session server-side to the correct salon_id.
      const d = await apiFetch<LoginResponse>("/api/auth/owner/login", {
        method: "POST",
        body: { username, password },
      });
      setOwnerToken(d.token);
      toast.success(
        d.salon?.name
          ? `مرحباً بك في إدارة «${d.salon.name}» — تم تسجيل الدخول بنجاح ✓`
          : "مرحباً بك! تم تسجيل الدخول بنجاح ✓",
      );
      router.push("/admin");
    } catch (err) {
      const msg = (err as Error).message || "اسم المستخدم أو كلمة المرور غير صحيحة";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bs-skin mx-auto max-w-4xl py-6">
      <div className="bs-panel grid overflow-hidden md:grid-cols-[1fr_1.15fr]">
        {/* ── form side (reads first in RTL — right column) ── */}
        <section className="p-7 sm:p-10">
          {/* compact brand header — mobile only */}
          <div className="mb-6 flex items-center gap-2 md:hidden">
            <Scissors className="h-5 w-5 text-[var(--bs-primary)]" />
            <span className="text-[10px] font-bold tracking-[0.3em] text-[var(--bs-primary)]" dir="ltr">
              ADMIN PANEL
            </span>
          </div>

          <p className="text-[11px] font-bold tracking-[0.25em] text-[var(--bs-primary)]">الإدارة</p>
          <h1 className="mt-2 text-3xl font-black text-[var(--bs-text)] sm:text-4xl">لوحة تحكم الصالون</h1>
          {validSlug ? (
            <p
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--bs-primary)]/30 bg-[var(--bs-primary-soft)] px-3 py-1 text-xs font-bold text-[var(--bs-primary)]"
              dir="ltr"
            >
              <Store className="h-3.5 w-3.5" /> /{salonSlug}
            </p>
          ) : (
            <p className="mt-3 rounded-lg border border-[var(--bs-error)]/40 bg-[var(--bs-error-soft)] p-2 text-xs text-[var(--bs-error)]">
              معرّف الصالون في الرابط غير صالح
            </p>
          )}

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="salon-admin-username">اسم المستخدم</Label>
            <Input
              id="salon-admin-username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="salon-admin-password">كلمة المرور</Label>
            <Input
              id="salon-admin-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-[var(--bs-error)]/40 bg-[var(--bs-error-soft)] p-3 text-xs sm:text-sm text-[var(--bs-error)] flex items-center gap-2">
              <CircleAlert className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" disabled={loading || !validSlug} className="w-full py-3 text-base">
            {loading ? (
              <>
                <Spinner size="sm" color="zinc" />
                <span>جاري التحقق والدخول…</span>
              </>
            ) : (
              "دخول لوحة التحكم ←"
            )}
          </Button>
        </form>

          {/* secondary: owners without an account → public signup.
              Absolute /signup (a non-tenant route) — correct from any salon's login page. */}
          <p className="mt-6 border-t border-[var(--bs-border)] pt-5 text-center text-sm text-[var(--bs-text-muted)]">
            لا تملك صالوناً بعد؟{" "}
            <Link
              href="/signup"
              className="font-bold text-[var(--bs-primary)] transition-colors hover:text-[var(--bs-primary-strong)] hover:underline"
            >
              أنشئ حسابك الآن ←
            </Link>
          </p>
        </section>

        {/* ── brand side — editorial statement panel (desktop only) ── */}
        <aside className="relative hidden overflow-hidden md:block" aria-hidden="true">
          <div className="absolute inset-0 bg-[var(--bs-surface-raised)]" />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 90% 70% at 80% -10%, rgba(201,162,39,0.22), transparent 60%)",
            }}
          />
          <div className="bs-grain" />

          <div className="relative flex h-full flex-col justify-between p-10">
            <div className="flex items-center gap-3">
              <Scissors className="h-7 w-7 text-[var(--bs-primary)]" />
              <span className="text-[10px] font-bold tracking-[0.3em] text-[var(--bs-primary)]" dir="ltr">
                ADMIN PANEL
              </span>
            </div>

            <div>
              <p className="text-5xl font-black leading-[1.15] text-[var(--bs-text)]">
                كراسي
                <br />
                <span className="text-[var(--bs-primary)]">صالونك</span>
                <br />
                تُدار من هنا.
              </p>
              <div className="bs-hairline mt-8 max-w-[8rem]" />
              <p className="mt-5 max-w-[16rem] text-sm leading-relaxed text-[var(--bs-text-muted)]">
                جلسة إدارة مرتبطة بهذا الصالون فقط — دخول آمن لعقلك وسلمك.
              </p>
            </div>

            <p className="text-[11px] text-[var(--bs-text-faint)]">
              <span className="font-bold text-[var(--bs-text-muted)]">دخول آمن</span> — جلسة مرتبطة بصالونك فقط
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
