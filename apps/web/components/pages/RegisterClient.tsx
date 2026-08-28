"use client";
import { useTenantLink } from "@/lib/salonTenant";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import Spinner from "@/components/Spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { getCurrentSalonSlug, withSlug } from "@/lib/salonTenant";

export function RegisterClient({ salonSlug }: { salonSlug?: string }) {
  const tLink = useTenantLink();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 خانات على الأقل");
      return;
    }
    setLoading(true);
    try {
      await apiFetch<{ ok: boolean }>(withSlug("/api/auth/customer/register"), {
        method: "POST",
        body: { username: username.trim(), phone: phone.trim(), password },
      });
      // No auto-login — the customer signs in explicitly with phone + password
      setSuccess(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bs-skin mx-auto max-w-4xl py-4">
      <div className="bs-panel grid overflow-hidden md:grid-cols-[1fr_1.15fr]">
        {/* ── form side (reads first in RTL — right column) ── */}
        <section className="p-7 sm:p-10">
          {/* compact brand header — mobile only */}
          <div className="mb-6 flex items-center gap-2 md:hidden">
            <span className="text-xl">💈</span>
            <span className="text-[10px] font-bold tracking-[0.3em] text-[var(--bs-primary)]" dir="ltr">
              BARBERSHOP
            </span>
          </div>

          {success ? (
            <div className="py-6 text-center sm:py-10">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[var(--bs-success)]/30 bg-[var(--bs-success-soft)] text-[var(--bs-success)]">
                <CircleCheck className="h-8 w-8" />
              </span>
              <h1 className="mt-6 text-3xl font-black text-[var(--bs-text)]">تم إنشاء حسابك بنجاح!</h1>
              <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-[var(--bs-text-muted)]">
                سجّل دخولك الآن برقم هاتفك وكلمة المرور لتبدأ الحجز
              </p>
              <Button type="button" onClick={() => tLink.push("/login")} className="mt-8 w-full py-3">
                تسجيل الدخول الآن ←
              </Button>
            </div>
          ) : (
            <>
              <p className="text-[11px] font-bold tracking-[0.25em] text-[var(--bs-primary)]">خطوتك الأولى</p>
              <h1 className="mt-2 text-3xl font-black text-[var(--bs-text)] sm:text-4xl">إنشاء حساب جديد</h1>
              <p className="mt-2 text-sm text-[var(--bs-text-muted)]">
                سجّل باسمك ورقم هاتفك وكلمة مرور لحجز مواعيدك بسهولة
              </p>

              <form onSubmit={onSubmit} className="mt-8 space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="reg-name">الاسم</Label>
                  <Input
                    id="reg-name"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="مثال: أحمد علي"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reg-phone">رقم الهاتف</Label>
                  <Input
                    id="reg-phone"
                    type="tel"
                    required
                    dir="ltr"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="text-left"
                    placeholder="0790000000 أو +962..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reg-password">كلمة المرور</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    required
                    minLength={6}
                    dir="ltr"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="text-left"
                    placeholder="6 خانات على الأقل"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 rounded-xl border border-[var(--bs-error)]/40 bg-[var(--bs-error-soft)] p-3 text-xs text-[var(--bs-error)] sm:text-sm">
                    <TriangleAlert className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button type="submit" disabled={loading} className="w-full py-3 text-base">
                  {loading ? (
                    <>
                      <Spinner size="sm" color="zinc" />
                      <span>جاري إنشاء الحساب…</span>
                    </>
                  ) : (
                    "إنشاء الحساب ←"
                  )}
                </Button>
              </form>

              <div className="bs-hairline mt-8" />
              <p className="mt-5 text-sm text-[var(--bs-text-muted)]">
                لديك حساب بالفعل؟{" "}
                <Link href={tLink.href("/login")} className="font-bold text-[var(--bs-primary)] hover:underline">
                  سجل دخولك الآن
                </Link>
              </p>
            </>
          )}
        </section>

        {/* ── brand side — editorial statement panel (desktop only) ── */}
        {!success && (
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
                <span className="text-3xl">💈</span>
                <span className="text-[10px] font-bold tracking-[0.3em] text-[var(--bs-primary)]" dir="ltr">
                  BARBERSHOP &amp; GROOMING
                </span>
              </div>

              <div>
                <p className="text-5xl font-black leading-[1.15] text-[var(--bs-text)]">
                  كرسيك
                  <br />
                  <span className="text-[var(--bs-primary)]">محجوز</span>
                  <br />
                  باسمك.
                </p>
                <div className="bs-hairline mt-8 max-w-[8rem]" />
                <p className="mt-5 max-w-[16rem] text-sm leading-relaxed text-[var(--bs-text-muted)]">
                  حساب واحد يفتح لك قائمة الحلاقين والخدمات، ودوراً مباشراً محسوباً لحظة بلحظة.
                </p>
              </div>

              <p className="text-[11px] text-[var(--bs-text-faint)]">
                التسجيل مجاني — <span className="font-bold text-[var(--bs-text-muted)]">والحجز فوري</span>
              </p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

export default RegisterClient;
