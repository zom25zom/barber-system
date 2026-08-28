"use client";
import { useTenantLink } from "@/lib/salonTenant";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getCustomerToken, getCustomerProfile, setCustomerAuth, clearCustomerAuth } from "@/lib/auth";
import Spinner from "@/components/Spinner";
import ConfirmModal from "@/components/ConfirmModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CircleAlert, CircleCheck, Eye, EyeOff, LogOut } from "lucide-react";
import type { Customer } from "@/lib/types";

export function MyProfileClient({ salonSlug }: { salonSlug?: string }) {
  const tLink = useTenantLink();
  const router = useRouter();
  const token = getCustomerToken();

  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  // Change password state — direct reset, no current password required
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [logoutOpen, setLogoutOpen] = useState(false);

  useEffect(() => {
    if (!token) {
      router.replace(tLink.href("/login"));
      return;
    }
    // Prefer fresh data from the server; fall back to cached profile
    apiFetch<{ customer: Customer }>("/api/customer/profile", { token })
      .then((d) => {
        setUsername(d.customer.username);
        setPhone(d.customer.phone);
      })
      .catch(() => {
        const p = getCustomerProfile();
        if (p) {
          setUsername(p.username);
          setPhone(p.phone);
        }
      })
      .finally(() => setLoading(false));
  }, [token, router]);

  async function onSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(false);
    setSaving(true);
    try {
      const d = await apiFetch<{ ok: boolean; customer: Customer }>("/api/customer/profile", {
        method: "PATCH",
        token,
        body: { username: username.trim(), phone: phone.trim() },
      });
      if (token) setCustomerAuth(token, d.customer); // refresh cached profile
      setProfileSuccess(true);
    } catch (err) {
      setProfileError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);
    if (newPassword !== confirmNewPassword) {
      setPasswordError("كلمة المرور الجديدة وتأكيدها غير متطابقين");
      return;
    }
    setSavingPassword(true);
    try {
      await apiFetch("/api/customer/change-password", {
        method: "POST",
        token,
        body: { newPassword },
      });
      // Token was rotated server-side → this device is logged out; go re-login
      clearCustomerAuth();
      router.push(tLink.href("/login"));
    } catch (err) {
      setPasswordError((err as Error).message);
    } finally {
      setSavingPassword(false);
    }
  }

  if (!token || loading) {
    return (
      <div className="bs-skin flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="bs-skin mx-auto max-w-lg pb-4">
      {/* ── Profile header: the avatar letter is the focal point ── */}
      <header className="flex items-center gap-5">
        <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl border border-[var(--bs-primary)]/40 bg-[var(--bs-primary-soft)] text-3xl font-black text-[var(--bs-primary)] shadow-lg">
          {username.trim().charAt(0) || "👤"}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-[0.25em] text-[var(--bs-primary)]">حسابي</p>
          <h1 className="mt-1 truncate text-2xl font-black text-[var(--bs-text)] sm:text-3xl">{username}</h1>
          <p className="mt-1 text-sm text-[var(--bs-text-faint)]" dir="ltr">
            {phone}
          </p>
        </div>
      </header>

      <div className="bs-hairline mt-8" />

      {/* ── Edit profile ── */}
      <section className="pt-8">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-black text-[var(--bs-text)]">بياناتي</h2>
          <p className="text-xs text-[var(--bs-text-faint)]">عدّل اسمك ورقم هاتفك</p>
        </div>

        <form onSubmit={onSaveProfile} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="profile-name">الاسم</Label>
            <Input id="profile-name" type="text" required value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-phone">رقم الهاتف</Label>
            <Input
              id="profile-phone"
              type="tel"
              required
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="text-left"
            />
          </div>

          {profileError && (
            <div className="flex items-center gap-2 rounded-xl border border-[var(--bs-error)]/40 bg-[var(--bs-error-soft)] p-3 text-xs text-[var(--bs-error)] sm:text-sm">
              <CircleAlert className="h-4 w-4 shrink-0" />
              <span>{profileError}</span>
            </div>
          )}
          {profileSuccess && (
            <div className="flex items-center gap-2 rounded-xl border border-[var(--bs-success)]/40 bg-[var(--bs-success-soft)] p-3 text-xs text-[var(--bs-success)] sm:text-sm">
              <CircleCheck className="h-4 w-4 shrink-0" />
              <span>تم حفظ بياناتك بنجاح</span>
            </div>
          )}

          <Button type="submit" disabled={saving} className="w-full py-3">
            {saving ? (
              <>
                <Spinner size="sm" color="zinc" />
                <span>جاري الحفظ…</span>
              </>
            ) : (
              "حفظ التعديلات"
            )}
          </Button>
        </form>
      </section>

      <div className="bs-hairline mt-8" />

      {/* ── Reset password (no current password required) ── */}
      <section className="pt-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-[var(--bs-text)]">كلمة المرور</h2>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-[var(--bs-text-faint)]">
              إعادة تعيين مباشرة — سيتم تسجيل خروجك من جميع الأجهزة
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setShowPasswordForm((v) => !v);
              setPasswordError(null);
              setPasswordSuccess(false);
            }}
            className="shrink-0"
          >
            {showPasswordForm ? "إلغاء" : "تغيير"}
          </Button>
        </div>

        {passwordSuccess && !showPasswordForm && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--bs-success)]/40 bg-[var(--bs-success-soft)] p-3 text-xs text-[var(--bs-success)] sm:text-sm">
            <CircleCheck className="h-4 w-4 shrink-0" />
            <span>تم إعادة تعيين كلمة المرور — سجّل دخولك بكلمة المرور الجديدة</span>
          </div>
        )}

        {showPasswordForm && (
          <form onSubmit={onChangePassword} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">كلمة المرور الجديدة</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  required
                  minLength={6}
                  dir="ltr"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-11 text-left"
                  placeholder="6 خانات على الأقل"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showNewPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  className="absolute left-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--bs-text-muted)] transition hover:bg-[var(--bs-surface-raised)] hover:text-[var(--bs-text)]"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">تأكيد كلمة المرور الجديدة</Label>
              <Input
                id="confirm-password"
                type={showNewPassword ? "text" : "password"}
                required
                minLength={6}
                dir="ltr"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="text-left"
              />
            </div>

            {passwordError && showPasswordForm && (
              <div className="flex items-center gap-2 rounded-xl border border-[var(--bs-error)]/40 bg-[var(--bs-error-soft)] p-3 text-xs text-[var(--bs-error)] sm:text-sm">
                <CircleAlert className="h-4 w-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <Button type="submit" disabled={savingPassword} className="w-full py-3">
              {savingPassword ? (
                <>
                  <Spinner size="sm" color="zinc" />
                  <span>جاري التغيير…</span>
                </>
              ) : (
                "تأكيد تغيير كلمة المرور"
              )}
            </Button>
          </form>
        )}
      </section>

      {/* ── Logout — quiet danger row ── */}
      <button
        type="button"
        onClick={() => setLogoutOpen(true)}
        className="mt-10 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--bs-error)]/40 py-4 text-sm font-bold text-[var(--bs-error)] transition hover:bg-[var(--bs-error-soft)] active:scale-[0.98]"
      >
        <LogOut className="h-4 w-4" /> تسجيل الخروج من الحساب
      </button>

      <ConfirmModal
        isOpen={logoutOpen}
        title="تأكيد تسجيل الخروج"
        message="هل أنت متأكد من رغبتك في تسجيل الخروج من حسابك؟"
        confirmText="نعم، تسجيل الخروج"
        cancelText="إلغاء"
        variant="warning"
        icon="🚪"
        onConfirm={() => {
          clearCustomerAuth();
          tLink.push("/");
        }}
        onClose={() => setLogoutOpen(false)}
      />
    </div>
  );
}

export default MyProfileClient;
