"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { getOwnerToken } from "@/lib/auth";
import Spinner from "@/components/Spinner";
import ConfirmModal from "@/components/ConfirmModal";
import ImageUploader from "@/components/ImageUploader";
import { useToast } from "@/components/Toaster";
import type { OwnerBarber } from "@/lib/types";

export default function AdminBarbersPage() {
  const token = getOwnerToken();
  const toast = useToast();
  const [barbers, setBarbers] = useState<OwnerBarber[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formName, setFormName] = useState("");
  const [formPhoto, setFormPhoto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [barberToDelete, setBarberToDelete] = useState<OwnerBarber | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    if (!token) return;
    apiFetch<{ barbers: OwnerBarber[] }>("/api/owner/barbers", { token })
      .then((d) => setBarbers(d.barbers))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  function openAdd() {
    setEditId(null);
    setFormName("");
    setFormPhoto("");
    setShowAdd(true);
    setError(null);
  }

  function openEdit(b: OwnerBarber) {
    setEditId(b.id);
    setFormName(b.name);
    setFormPhoto(b.photo_url ?? "");
    setShowAdd(true);
    setError(null);
  }

  async function saveBarber(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      if (editId) {
        await apiFetch(`/api/owner/barbers/${editId}`, {
          method: "PATCH",
          token,
          body: { name: formName, photo_url: formPhoto || null },
        });
        toast.success("تم تحديث بيانات الحلاق بنجاح ✓");
      } else {
        await apiFetch("/api/owner/barbers", {
          method: "POST",
          token,
          body: { name: formName, photo_url: formPhoto || null },
        });
        toast.success("تمت إضافة الحلاق الجديد بنجاح ✓");
      }
      setShowAdd(false);
      load();
    } catch (err) {
      const msg = (err as Error).message || "حدث خطأ أثناء حفظ بيانات الحلاق، يرجى المحاولة ثانية";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(b: OwnerBarber) {
    if (!token) return;
    try {
      await apiFetch(`/api/owner/barbers/${b.id}`, {
        method: "PATCH",
        token,
        body: { is_active: !b.is_active },
      });
      toast.success(b.is_active ? "تم تعطيل الحلاق مؤقتاً" : "تم تفعيل الحلاق بنجاح ✓");
      load();
    } catch (err) {
      const msg = (err as Error).message || "حدث خطأ أثناء تغيير حالة الحلاق";
      setError(msg);
      toast.error(msg);
    }
  }

  function triggerDelete(b: OwnerBarber) {
    setBarberToDelete(b);
    setDeleteModalOpen(true);
  }

  async function executeDeleteBarber() {
    if (!token || !barberToDelete) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/owner/barbers/${barberToDelete.id}`, { method: "DELETE", token });
      setDeleteModalOpen(false);
      setBarberToDelete(null);
      toast.success("تم حذف الحلاق بنجاح ✓");
      load();
    } catch (err) {
      const msg = (err as Error).message || "حدث خطأ أثناء حذف الحلاق";
      setError(msg);
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="bs-skin space-y-10">
      {/* ── Confirm Delete Modal ── */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="تأكيد حذف الحلاق"
        message={
          barberToDelete
            ? `هل أنت متأكد من رغبتك في حذف الحلاق "${barberToDelete.name}"؟ سيتم حذف جميع الخدمات وجداول العمل المرتبطة به نهائياً.`
            : "هل أنت متأكد من رغبتك في حذف هذا الحلاق؟"
        }
        confirmText="نعم، حذف الحلاق"
        cancelText="إلغاء"
        variant="danger"
        isLoading={deleting}
        onConfirm={executeDeleteBarber}
        onClose={() => {
          if (!deleting) {
            setDeleteModalOpen(false);
            setBarberToDelete(null);
          }
        }}
      />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-2.5 text-[11px] font-bold tracking-[0.25em] text-[var(--bs-primary)]">
            <span className="inline-block h-px w-8 bg-[var(--bs-primary)]/60" />
            الفريق
          </p>
          <h1 className="text-2xl font-black text-[var(--bs-text)] sm:text-3xl">إدارة الحلاقين</h1>
        </div>
        <button
          onClick={openAdd}
          className="rounded-xl bg-[var(--bs-primary)] px-5 py-2.5 text-sm font-bold text-[var(--bs-on-primary)] hover:bg-[var(--bs-primary-strong)] shadow-md transition active:scale-95"
        >
          + إضافة حلاق جديد
        </button>
      </header>

      {error && (
        <div className="rounded-xl border border-[var(--bs-error)]/40 bg-[var(--bs-error-soft)] p-4 text-sm text-[var(--bs-error)] flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="text-xs text-[var(--bs-error)] hover:underline">
            إغلاق
          </button>
        </div>
      )}

      {/* ── add / edit form — floating wizard panel ── */}
      {showAdd && (
        <div className="bs-panel relative overflow-hidden p-6 animate-in fade-in sm:p-8">
          <span className="bs-ghost-numeral" dir="ltr" aria-hidden="true">✂</span>
          <p className="text-[11px] font-bold tracking-[0.25em] text-[var(--bs-primary)]">
            {editId ? "تعديل بيانات" : "عضو جديد"}
          </p>
          <h2 className="mt-1 mb-5 text-xl font-black text-[var(--bs-text)]">
            {editId ? "تعديل بيانات الحلاق" : "إضافة حلاق جديد"}
          </h2>
          <form onSubmit={saveBarber} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[var(--bs-text)]">اسم الحلاق</label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="مثال: أحمد محمد"
                className="w-full rounded-xl border border-[var(--bs-border-strong)] bg-[var(--bs-bg)] px-4 py-2.5 text-[var(--bs-text)] outline-none focus:border-[var(--bs-primary)]"
              />
            </div>
            <ImageUploader
              label="صورة الحلاق"
              value={formPhoto}
              onChange={setFormPhoto}
              shape="circle"
              helperText="رفع صورة شخصية للحلاق تظهر للزبائن عند حجز الموعد."
            />
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--bs-primary)] px-6 py-2.5 text-sm font-bold text-[var(--bs-on-primary)] hover:bg-[var(--bs-primary-strong)] disabled:opacity-50 transition"
              >
                {saving ? (
                  <>
                    <Spinner size="sm" color="zinc" />
                    <span>جاري الحفظ…</span>
                  </>
                ) : (
                  "حفظ التغييرات"
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="rounded-xl border border-[var(--bs-border-strong)] px-6 py-2.5 text-sm text-[var(--bs-text-muted)] hover:bg-[var(--bs-surface-raised)] hover:text-white transition"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── barbers list ── */}
      {loading && (
        <div className="rounded-2xl border border-[var(--bs-border)] bg-[var(--bs-surface)]/50 p-12 text-center">
          <Spinner size="lg" label="جاري تحميل قائمة الحلاقين…" />
        </div>
      )}

      {!loading && barbers.length === 0 && (
        <div className="rounded-2xl bg-[var(--bs-surface)]/40 p-10 text-center text-[var(--bs-text-muted)]">
          لا يوجد حلاقين مسجلين حالياً. اضغط على زر &quot;إضافة حلاق جديد&quot; للبدء.
        </div>
      )}

      {/* ── barbers index — numbered editorial rows, hairline-separated ── */}
      {!loading && barbers.length > 0 && (
        <div className="divide-y divide-[var(--bs-border)] border-y border-[var(--bs-border)]">
          {barbers.map((b, idx) => (
            <div key={b.id} className="py-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <span className="w-7 shrink-0 text-sm font-black text-[var(--bs-text-faint)]" dir="ltr">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  {b.photo_url ? (
                    <img
                      src={b.photo_url}
                      alt={b.name}
                      className="h-14 w-14 rounded-2xl border border-[var(--bs-border-strong)] object-cover shadow-lg"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--bs-border-strong)] bg-[var(--bs-surface-raised)] text-xl shadow-lg">
                      💈
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-black text-[var(--bs-text)]">{b.name}</h3>
                    <span
                      className={`flex items-center gap-1.5 text-xs font-bold ${
                        b.is_active ? "text-[var(--bs-success)]" : "text-[var(--bs-text-faint)]"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${b.is_active ? "bg-[var(--bs-success)]" : "bg-[var(--bs-text-faint)]"}`} />
                      {b.is_active ? "نشط ويستقبل حجوزات" : "غير نشط (معطل)"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Link
                    href={`/admin/barbers/services?id=${b.id}`}
                    className="rounded-xl border border-[var(--bs-border-strong)] bg-[var(--bs-surface-raised)]/60 px-3.5 py-1.5 text-xs sm:text-sm text-[var(--bs-text-muted)] transition hover:bg-[var(--bs-surface-raised)] hover:text-[var(--bs-text)]"
                  >
                    ✂ الخدمات
                  </Link>
                  <Link
                    href={`/admin/barbers/schedule?id=${b.id}`}
                    className="rounded-xl border border-[var(--bs-border-strong)] bg-[var(--bs-surface-raised)]/60 px-3.5 py-1.5 text-xs sm:text-sm text-[var(--bs-text-muted)] transition hover:bg-[var(--bs-surface-raised)] hover:text-[var(--bs-text)]"
                  >
                    📅 الجدول
                  </Link>
                  <button
                    onClick={() => openEdit(b)}
                    className="rounded-xl border border-[var(--bs-border-strong)] bg-[var(--bs-surface-raised)]/60 px-3.5 py-1.5 text-xs sm:text-sm text-[var(--bs-primary)] transition hover:bg-[var(--bs-surface-raised)]"
                  >
                    ✏️ تعديل
                  </button>
                  <button
                    onClick={() => toggleActive(b)}
                    className={`rounded-xl border px-3.5 py-1.5 text-xs sm:text-sm transition ${
                      b.is_active
                        ? "border-[var(--bs-warning)]/40 text-[var(--bs-warning)] hover:bg-[var(--bs-warning-soft)]"
                        : "border-[var(--bs-success)]/40 text-[var(--bs-success)] hover:bg-[var(--bs-success-soft)]"
                    }`}
                  >
                    {b.is_active ? "تعطيل" : "تفعيل"}
                  </button>
                  <button
                    onClick={() => triggerDelete(b)}
                    className="rounded-xl border border-[var(--bs-error)]/40 px-3.5 py-1.5 text-xs sm:text-sm text-[var(--bs-error)] transition hover:bg-[var(--bs-error-soft)]"
                  >
                    🗑 حذف
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
