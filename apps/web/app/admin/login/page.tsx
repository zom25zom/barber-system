"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { setOwnerToken } from "@/lib/auth";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CircleAlert, Scissors } from "lucide-react";

interface LoginResponse {
  token: string;
  owner: { id: number; username: string };
  salon?: { id: number; name: string; slug: string | null };
}

export default function AdminLoginPage() {
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
      // Tenant resolution happens server-side: the backend identifies the
      // salon purely from username+password and binds the session to it.
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
          <p className="mt-2 text-sm text-[var(--bs-text-muted)]">تسجيل دخول صاحب الصالون والمدير</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="admin-username">اسم المستخدم</Label>
            <Input
              id="admin-username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-password">كلمة المرور</Label>
            <Input
              id="admin-password"
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

          <Button type="submit" disabled={loading} className="w-full py-3 text-base">
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
                الكرسي
                <br />
                <span className="text-[var(--bs-primary)]">تحت</span>
                <br />
                سيطرتك.
              </p>
              <div className="bs-hairline mt-8 max-w-[8rem]" />
              <p className="mt-5 max-w-[16rem] text-sm leading-relaxed text-[var(--bs-text-muted)]">
                الحجوزات، الجداول، الإيرادات، وساعات الذروة — كل شيء عن صالونك من مكان واحد.
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
