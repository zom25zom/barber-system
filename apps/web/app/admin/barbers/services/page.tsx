"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { getOwnerToken } from "@/lib/auth";
import Spinner from "@/components/Spinner";
import ConfirmModal from "@/components/ConfirmModal";
import type { Service } from "@/lib/types";

function ServicesContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const token = getOwnerToken();
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
        <p className="text-red-400">لم يتم تحديد الحلاق.</p>
        <Link href="/admin/barbers" className="text-amber-400 underline">
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
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: formName,
        price: Number(formPrice),
        duration_minutes: Number(formDuration),
      };
      if (editId) {
        await apiFetch(`/api/owner/services/${editId}`, { method: "PATCH", token, body });
      } else {
        await apiFetch(`/api/owner/barbers/${id}/services`, { method: "POST", token, body });
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError((err as Error).message);
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
      load();
    } catch (err) {
      setError((err as Error).message);
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
          className="rounded-xl border border-zinc-700 bg-zinc-800/60 px-3.5 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition"
        >
          ← العودة للحلاقين
        </Link>
        <h1 className="text-2xl font-bold text-zinc-100">
          خدمات {barberName ? `الحلاق ${barberName}` : `الحلاق #${id}`}
        </h1>
      </div>

      <button
        onClick={openAdd}
        className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-zinc-950 hover:bg-amber-400 shadow-md transition active:scale-95"
      >
        + إضافة خدمة جديدة
      </button>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-400 flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="text-xs text-red-300 hover:underline">
            إغلاق
          </button>
        </div>
      )}

      {/* ── form ── */}
      {showForm && (
        <div className="rounded-2xl border border-amber-500/30 bg-zinc-900 p-6 shadow-xl animate-in fade-in">
          <h2 className="mb-4 text-lg font-bold text-amber-400">
            {editId ? "تعديل بيانات الخدمة" : "إضافة خدمة جديدة"}
          </h2>
          <form onSubmit={save} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-zinc-200">اسم الخدمة</label>
              <input
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-zinc-100 outline-none focus:border-amber-500"
                placeholder="مثال: قص شعر ولحية"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-zinc-200">السعر (د.أ)</label>
                <input
                  type="number"
                  required
                  min="0.1"
                  step="0.5"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-zinc-100 outline-none focus:border-amber-500"
                  placeholder="10"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-zinc-200">المدة (دقيقة)</label>
                <input
                  type="number"
                  required
                  min="5"
                  max="480"
                  value={formDuration}
                  onChange={(e) => setFormDuration(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-zinc-100 outline-none focus:border-amber-500"
                  placeholder="30"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-bold text-zinc-950 hover:bg-amber-400 disabled:opacity-50 transition"
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
                className="rounded-xl border border-zinc-700 px-6 py-2.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── services list ── */}
      {loading && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
          <Spinner size="lg" label="جاري تحميل قائمة الخدمات…" />
        </div>
      )}

      {!loading && services.length === 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-zinc-400">
          لا توجد خدمات مسجلة لهذا الحلاق حالياً. اضغط على زر &quot;إضافة خدمة جديدة&quot;.
        </div>
      )}

      <div className="space-y-2.5">
        {services.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-md transition hover:border-zinc-700"
          >
            <div>
              <p className="font-bold text-zinc-100 text-base">{s.name}</p>
              <p className="text-xs text-zinc-400 mt-0.5">⏱ المدة: {s.duration_minutes} دقيقة</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-3.5 py-1 text-sm font-bold text-amber-400">
                {s.price} د.أ
              </span>
              <button
                onClick={() => openEdit(s)}
                className="rounded-xl border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-xs sm:text-sm text-amber-400 hover:bg-zinc-800 transition"
              >
                ✏️ تعديل
              </button>
              <button
                onClick={() => triggerDelete(s)}
                className="rounded-xl border border-red-500/30 px-3 py-1.5 text-xs sm:text-sm text-red-400 hover:bg-red-500/10 transition"
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
