"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { setOwnerToken } from "@/lib/auth";
import Spinner from "@/components/Spinner";
import { useToast } from "@/components/Toaster";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
      const d = await apiFetch<LoginResponse>("/api/auth/owner/login", {
        method: "POST",
        body: { username, password, salonSlug },
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
          {validSlug ? (
            <p
              className="mt-2 inline-flex items-center gap-2 rounded-lg border border-[var(--bs-primary)]/30 bg-[var(--bs-primary-soft)] px-3 py-1 text-xs font-bold text-[var(--bs-primary)]"
              dir="ltr"
            >
              <Store className="h-3.5 w-3.5" /> /{salonSlug}
            </p>
          ) : (
            <p className="mt-2 rounded-lg border border-[var(--bs-error)]/40 bg-[var(--bs-error-soft)] p-2 text-xs text-[var(--bs-error)]">
              معرّف الصالون في الرابط غير صالح
            </p>
          )}
        </div>

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

          <Button type="submit" disabled={loading || !validSlug} className="w-full py-3">
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
