"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { getOwnerToken } from "@/lib/auth";
import Spinner from "@/components/Spinner";
import ConfirmModal from "@/components/ConfirmModal";
import { useToast } from "@/components/Toaster";
import type { Service } from "@/lib/types";

function ServicesContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const token = getOwnerToken();
  const toast = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [barberName, setBarberName] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formName, setFormName] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formDuration, setFormDuration] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    if (!token || !id) return;
    apiFetch<{ services: Service[] }>(`/api/owner/barbers/${id}/services`, { token })
      .then((d) => setServices(d.services))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
    apiFetch<{ barbers: { id: number; name: string }[] }>("/api/owner/barbers", { token }).then(
      (d) => {
        const b = d.barbers.find((b) => b.id === Number(id));
        if (b) setBarberName(b.name);
      }
    );
  }, [token, id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!id) {
    return (
      <div className="space-y-4">
        <p className="text-[var(--bs-error)]">لم يتم تحديد الحلاق.</p>
        <Link href="/admin/barbers" className="text-[var(--bs-primary)] underline">
          العودة للحلاقين
        </Link>
      </div>
    );
  }

  function openAdd() {
    setEditId(null);
    setFormName("");
    setFormPrice("");
    setFormDuration("");
    setShowForm(true);
    setError(null);
  }

  function openEdit(s: Service) {
    setEditId(s.id);
    setFormName(s.name);
    setFormPrice(String(s.price));
    setFormDuration(String(s.duration_minutes));
    setShowForm(true);
    setError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;

    const parsedPrice = parseFloat(formPrice);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      const msg = "يرجى إدخال سعر صحيح أكبر من الصفر";
      setError(msg);
      toast.error(msg);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const body = {
        name: formName.trim(),
        price: parsedPrice,
        duration_minutes: Number(formDuration),
      };
      if (editId) {
        await apiFetch(`/api/owner/services/${editId}`, { method: "PATCH", token, body });
        toast.success("تم تعديل الخدمة بنجاح ✓");
      } else {
        await apiFetch(`/api/owner/barbers/${id}/services`, { method: "POST", token, body });
        toast.success("تمت إضافة الخدمة بنجاح ✓");
      }
      setShowForm(false);
      load();
    } catch (err) {
      const msg = (err as Error).message || "حدث خطأ أثناء حفظ الخدمة، يرجى المحاولة ثانية";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  function triggerDelete(s: Service) {
    setServiceToDelete(s);
    setDeleteModalOpen(true);
  }

  async function executeDeleteService() {
    if (!token || !serviceToDelete) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/owner/services/${serviceToDelete.id}`, { method: "DELETE", token });
      setDeleteModalOpen(false);
      setServiceToDelete(null);
      toast.success("تم حذف الخدمة بنجاح ✓");
      load();
    } catch (err) {
      const msg = (err as Error).message || "حدث خطأ أثناء حذف الخدمة";
      setError(msg);
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Delete Confirmation Modal ── */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="تأكيد حذف الخدمة"
        message={
          serviceToDelete
            ? `هل أنت متأكد من رغبتك في حذف خدمة "${serviceToDelete.name}"؟ لن يتمكن الزبائن من حجز هذه الخدمة بعد الآن.`
            : "هل أنت متأكد من رغبتك في حذف هذه الخدمة؟"
        }
        confirmText="نعم، حذف الخدمة"
        cancelText="إلغاء"
        variant="danger"
        isLoading={deleting}
        onConfirm={executeDeleteService}
        onClose={() => {
          if (!deleting) {
            setDeleteModalOpen(false);
            setServiceToDelete(null);
          }
        }}
      />

      <div className="flex items-center gap-3">
        <Link
          href="/admin/barbers"
          className="rounded-xl border border-[var(--bs-border-strong)] bg-[var(--bs-surface-raised)]/60 px-3.5 py-2 text-sm text-[var(--bs-text-muted)] hover:bg-[var(--bs-surface-raised)] hover:text-white transition"
        >
          ← العودة للحلاقين
        </Link>
        <h1 className="text-2xl font-bold text-[var(--bs-text)]">
          خدمات {barberName ? `الحلاق ${barberName}` : `الحلاق #${id}`}
        </h1>
      </div>

      <button
        onClick={openAdd}
        className="rounded-xl bg-[var(--bs-primary)] px-5 py-2.5 text-sm font-bold text-[var(--bs-on-primary)] hover:bg-[var(--bs-primary-strong)] shadow-md transition active:scale-95"
      >
        + إضافة خدمة جديدة
      </button>

      {error && (
        <div className="rounded-xl border border-[var(--bs-error)]/40 bg-[var(--bs-error-soft)] p-4 text-sm text-[var(--bs-error)] flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="text-xs text-[var(--bs-error)] hover:underline">
            إغلاق
          </button>
        </div>
      )}

      {/* ── form ── */}
      {showForm && (
        <div className="rounded-2xl border border-[var(--bs-primary)]/40 bg-[var(--bs-surface)] p-6 shadow-xl animate-in fade-in">
          <h2 className="mb-4 text-lg font-bold text-[var(--bs-primary)]">
            {editId ? "تعديل بيانات الخدمة" : "إضافة خدمة جديدة"}
          </h2>
          <form onSubmit={save} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[var(--bs-text)]">اسم الخدمة</label>
              <input
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full rounded-xl border border-[var(--bs-border-strong)] bg-[var(--bs-bg)] px-4 py-2.5 text-[var(--bs-text)] outline-none focus:border-[var(--bs-primary)]"
                placeholder="مثال: قص شعر ولحية"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[var(--bs-text)]">السعر (د.أ)</label>
                <input
                  type="number"
                  required
                  min="0.000001"
                  step="any"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  className="w-full rounded-xl border border-[var(--bs-border-strong)] bg-[var(--bs-bg)] px-4 py-2.5 text-[var(--bs-text)] outline-none focus:border-[var(--bs-primary)]"
                  placeholder="مثال: 10 أو 7.5"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[var(--bs-text)]">المدة (دقيقة)</label>
                <input
                  type="number"
                  required
                  min="5"
                  max="480"
                  value={formDuration}
                  onChange={(e) => setFormDuration(e.target.value)}
                  className="w-full rounded-xl border border-[var(--bs-border-strong)] bg-[var(--bs-bg)] px-4 py-2.5 text-[var(--bs-text)] outline-none focus:border-[var(--bs-primary)]"
                  placeholder="30"
                />
              </div>
            </div>
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
                  "حفظ الخدمة"
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-xl border border-[var(--bs-border-strong)] px-6 py-2.5 text-sm text-[var(--bs-text-muted)] hover:bg-[var(--bs-surface-raised)] hover:text-white transition"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── services list ── */}
      {loading && (
        <div className="rounded-2xl border border-[var(--bs-border)] bg-[var(--bs-surface)]/50 p-12 text-center">
          <Spinner size="lg" label="جاري تحميل قائمة الخدمات…" />
        </div>
      )}

      {!loading && services.length === 0 && (
        <div className="rounded-2xl border border-[var(--bs-border)] bg-[var(--bs-surface)]/40 p-8 text-center text-[var(--bs-text-muted)]">
          لا توجد خدمات مسجلة لهذا الحلاق حالياً. اضغط على زر &quot;إضافة خدمة جديدة&quot;.
        </div>
      )}

      <div className="space-y-2.5">
        {services.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between rounded-2xl border border-[var(--bs-border)] bg-[var(--bs-surface)] p-4 shadow-md transition hover:border-[var(--bs-border-strong)]"
          >
            <div>
              <p className="font-bold text-[var(--bs-text)] text-base">{s.name}</p>
              <p className="text-xs text-[var(--bs-text-muted)] mt-0.5">⏱ المدة: {s.duration_minutes} دقيقة</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-[var(--bs-primary-soft)] border border-[var(--bs-primary)]/40 px-3.5 py-1 text-sm font-bold text-[var(--bs-primary)]">
                {s.price} د.أ
              </span>
              <button
                onClick={() => openEdit(s)}
                className="rounded-xl border border-[var(--bs-border-strong)] bg-[var(--bs-surface-raised)]/60 px-3 py-1.5 text-xs sm:text-sm text-[var(--bs-primary)] hover:bg-[var(--bs-surface-raised)] transition"
              >
                ✏️ تعديل
              </button>
              <button
                onClick={() => triggerDelete(s)}
                className="rounded-xl border border-[var(--bs-error)]/40 px-3 py-1.5 text-xs sm:text-sm text-[var(--bs-error)] hover:bg-[var(--bs-error-soft)] transition"
              >
                🗑 حذف
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BarberServicesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center">
          <Spinner size="lg" label="جاري التحميل…" />
        </div>
      }
    >
      <ServicesContent />
    </Suspense>
  );
}
