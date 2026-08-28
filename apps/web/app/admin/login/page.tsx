"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { setOwnerToken } from "@/lib/auth";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toaster";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  const [salonSlug, setSalonSlug] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const d = await apiFetch<LoginResponse>("/api/auth/owner/login", {
        method: "POST",
        body: {
          username,
          password,
          // Multi-tenant: usernames are unique PER SALON only — the slug tells
          // the backend which tenant this account belongs to.
          ...(salonSlug.trim() ? { salonSlug: salonSlug.trim() } : {}),
        },
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
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md p-8 shadow-xl">
        <div className="text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--bs-primary)]/30 bg-[var(--bs-primary-soft)] text-[var(--bs-primary)]">
            <Scissors className="h-7 w-7" />
          </span>
          <h1 className="mt-3 text-2xl font-bold text-[var(--bs-primary)]">لوحة تحكم الصالون</h1>
          <p className="mt-1 text-sm text-[var(--bs-text-muted)]">تسجيل دخول صاحب الصالون والمدير</p>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="admin-salon-slug">
              معرّف الصالون <span className="text-xs font-normal text-[var(--bs-text-faint)]">(رابط حجز صالونك)</span>
            </Label>
            <Input
              id="admin-salon-slug"
              type="text"
              dir="ltr"
              value={salonSlug}
              onChange={(e) => setSalonSlug(e.target.value)}
              className="text-left"
              placeholder="مثال: salon-nkhba"
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--bs-text-faint)]">
              هو الجزء الذي يأتي بعد الرابط الرئيسي في رابط حجز صالونك:
              <span
                dir="ltr"
                className="mx-1 rounded bg-[var(--bs-surface-raised)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--bs-primary)]"
              >
                example.com/<b>salon-slug</b>
              </span>
            </p>
          </div>

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

          <Button type="submit" disabled={loading} className="w-full py-3">
            {loading ? (
              <>
                <Spinner size="sm" color="zinc" />
                <span>جاري التحقق والدخول…</span>
              </>
            ) : (
              "دخول لوحة التحكم"
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
}
