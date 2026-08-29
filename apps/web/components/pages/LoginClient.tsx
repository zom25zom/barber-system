"use client";

import { useTenantLink } from "@/lib/salonTenant";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { setCustomerAuth } from "@/lib/auth";
import { getCurrentSalonSlug, withSlug } from "@/lib/salonTenant";
import Spinner from "@/components/Spinner";
import ConfirmModal from "@/components/ConfirmModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TriangleAlert } from "lucide-react";
import type { Customer } from "@/lib/types";

export function LoginClient({ salonSlug }: { salonSlug?: string }) {
  const tLink = useTenantLink();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Set when the API reports code=NOT_REGISTERED_THIS_SALON: the phone is
  // valid somewhere else but has no account for THIS salon → show the
  // "create account here" modal instead of the generic error box.
  const [notRegisteredHere, setNotRegisteredHere] = useState(false);
  const [thisSalonName, setThisSalonName] = useState<string>("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotRegisteredHere(false);
    setLoading(true);
    try {
      const d = await apiFetch<{ token: string; customer: Customer }>(withSlug("/api/auth/customer/login"), {
        method: "POST",
        body: { phone: phone.trim(), password },
      });
      setCustomerAuth(d.token, d.customer);
      tLink.push("/book");
    } catch (err) {
      const e = err as Error & { code?: string; salon_name?: string };
      if (e.code === "NOT_REGISTERED_THIS_SALON") {
        setThisSalonName(e.salon_name || "");
        setNotRegisteredHere(true);
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bs-skin mx-auto max-w-4xl py-4">
      <div className="bs-panel grid overflow-hidden md:grid-cols-[1fr_1.15fr]">
        {/* ── form side (reads first in RTL — right column) ── */}
        <section className="p-7 sm:p-10">
          {/* compact brand header — mobile only, desktop has the brand panel */}
          <div className="mb-6 flex items-center gap-2 md:hidden">
            <span className="text-xl">💈</span>
            <span className="text-[10px] font-bold tracking-[0.3em] text-[var(--bs-primary)]" dir="ltr">
              BARBERSHOP
            </span>
          </div>

          <p className="text-[11px] font-bold tracking-[0.25em] text-[var(--bs-primary)]">أهلاً بعودتك</p>
          <h1 className="mt-2 text-3xl font-black text-[var(--bs-text)] sm:text-4xl">تسجيل الدخول</h1>
          <p className="mt-2 text-sm text-[var(--bs-text-muted)]">أدخل رقم هاتفك وكلمة المرور لمتابعة حجوزاتك</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="login-phone">رقم الهاتف</Label>
              <Input
                id="login-phone"
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
              <Label htmlFor="login-password">كلمة المرور</Label>
              <Input
                id="login-password"
                type="password"
                required
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-left"
                placeholder="كلمة المرور الخاصة بحسابك"
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
                  <span>جاري التحقق والدخول…</span>
                </>
              ) : (
                "تسجيل الدخول ←"
              )}
            </Button>
          </form>

          <div className="bs-hairline mt-8" />
          <p className="mt-5 text-sm text-[var(--bs-text-muted)]">
            ليس لديك حساب؟{" "}
            <Link href={tLink.href("/register")} className="font-bold text-[var(--bs-primary)] hover:underline">
              سجل الآن
            </Link>
          </p>

          {/* "phone not registered at THIS salon" → invite to register here.
              The salon name is this salon's own public branding (server-side,
              per-salon query) — never any other salon's data. */}
          <ConfirmModal
            isOpen={notRegisteredHere}
            title="حسابك غير مسجل لدى هذا الصالون"
            message={`أنت الآن تحاول تسجيل الدخول إلى صالون ${thisSalonName ? `«${thisSalonName}»` : "الحالي"} وحسابك غير مسجل لدى هذا الصالون. الرجاء إنشاء حساب جديد للمتابعة.`}
            confirmText="الانتقال إلى إنشاء حساب جديد"
            cancelText="إغلاق"
            variant="primary"
            icon="📝"
            onConfirm={() => {
              setNotRegisteredHere(false);
              tLink.push("/register");
            }}
            onClose={() => setNotRegisteredHere(false)}
          />
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
              <span className="text-3xl">💈</span>
              <span className="text-[10px] font-bold tracking-[0.3em] text-[var(--bs-primary)]" dir="ltr">
                BARBERSHOP &amp; GROOMING
              </span>
            </div>

            <div>
              <p className="text-5xl font-black leading-[1.15] text-[var(--bs-text)]">
                احجز.
                <br />
                اجلس.
                <br />
                <span className="text-[var(--bs-primary)]">انطلق.</span>
              </p>
              <div className="bs-hairline mt-8 max-w-[8rem]" />
              <p className="mt-5 max-w-[16rem] text-sm leading-relaxed text-[var(--bs-text-muted)]">
                موعدك محفوظ باسمك، ودورك محسوب بدقة — بدون انتظار وبدون مكالمات.
              </p>
            </div>

            <p className="text-[11px] text-[var(--bs-text-faint)]">
              زبون مسجّل؟ <span className="font-bold text-[var(--bs-text-muted)]">دخولك يفتح كل الخدمات</span>
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default LoginClient;
