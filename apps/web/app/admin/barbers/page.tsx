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
    <div className="space-y-6">
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

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--bs-text)]">إدارة الحلاقين</h1>
        <button
          onClick={openAdd}
          className="rounded-xl bg-[var(--bs-primary)] px-5 py-2.5 text-sm font-bold text-[var(--bs-on-primary)] hover:bg-[var(--bs-primary-strong)] shadow-md transition active:scale-95"
        >
          + إضافة حلاق جديد
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-[var(--bs-error)]/40 bg-[var(--bs-error-soft)] p-4 text-sm text-[var(--bs-error)] flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="text-xs text-[var(--bs-error)] hover:underline">
            إغلاق
          </button>
        </div>
      )}

      {/* ── add / edit form ── */}
      {showAdd && (
        <div className="rounded-2xl border border-[var(--bs-primary)]/40 bg-[var(--bs-surface)] p-6 shadow-xl animate-in fade-in">
          <h2 className="mb-4 text-lg font-bold text-[var(--bs-primary)]">
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
        <div className="rounded-2xl border border-[var(--bs-border)] bg-[var(--bs-surface)]/40 p-8 text-center text-[var(--bs-text-muted)]">
          لا يوجد حلاقين مسجلين حالياً. اضغط على زر &quot;إضافة حلاق جديد&quot; للبدء.
        </div>
      )}

      <div className="space-y-3">
        {barbers.map((b) => (
          <div key={b.id} className="rounded-2xl border border-[var(--bs-border)] bg-[var(--bs-surface)] p-4 shadow-md transition hover:border-[var(--bs-border-strong)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {b.photo_url ? (
                  <img
                    src={b.photo_url}
                    alt={b.name}
                    className="h-14 w-14 rounded-full border-2 border-[var(--bs-primary)]/40 object-cover shadow-sm"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[var(--bs-primary)]/40 bg-[var(--bs-surface-raised)] text-2xl shadow-inner">
                    💈
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-bold text-[var(--bs-text)]">{b.name}</h3>
                  <span
                    className={`text-xs font-bold ${b.is_active ? "text-[var(--bs-success)]" : "text-[var(--bs-text-faint)]"}`}
                  >
                    {b.is_active ? "● نشط ويستقبل حجوزات" : "○ غير نشط (معطل)"}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/admin/barbers/services?id=${b.id}`}
                  className="rounded-xl border border-[var(--bs-border-strong)] bg-[var(--bs-surface-raised)]/60 px-3.5 py-1.5 text-xs sm:text-sm text-[var(--bs-text-muted)] hover:bg-[var(--bs-surface-raised)] hover:text-white transition"
                >
                  ✂ الخدمات
                </Link>
                <Link
                  href={`/admin/barbers/schedule?id=${b.id}`}
                  className="rounded-xl border border-[var(--bs-border-strong)] bg-[var(--bs-surface-raised)]/60 px-3.5 py-1.5 text-xs sm:text-sm text-[var(--bs-text-muted)] hover:bg-[var(--bs-surface-raised)] hover:text-white transition"
                >
                  📅 الجدول
                </Link>
                <button
                  onClick={() => openEdit(b)}
                  className="rounded-xl border border-[var(--bs-border-strong)] bg-[var(--bs-surface-raised)]/60 px-3.5 py-1.5 text-xs sm:text-sm text-[var(--bs-primary)] hover:bg-[var(--bs-surface-raised)] transition"
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
                  className="rounded-xl border border-[var(--bs-error)]/40 px-3.5 py-1.5 text-xs sm:text-sm text-[var(--bs-error)] hover:bg-[var(--bs-error-soft)] transition"
                >
                  🗑 حذف
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
