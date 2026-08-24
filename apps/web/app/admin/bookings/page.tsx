"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { getOwnerToken } from "@/lib/auth";
import { formatTime12, formatDateTime, BOOKING_STATUS_AR } from "@/lib/time";
import { useLiveNotifications } from "@/lib/useNotifications";
import Spinner from "@/components/Spinner";
import ConfirmModal from "@/components/ConfirmModal";
import type { Booking, OwnerBarber } from "@/lib/types";

const statusColor: Record<string, string> = {
  confirmed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  cancelled: "bg-red-500/15 text-red-400 border-red-500/30",
  completed: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  no_show: "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

export default function AdminBookingsPage() {
  const token = getOwnerToken();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [barbers, setBarbers] = useState<OwnerBarber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  /* filters */
  const [filterBarber, setFilterBarber] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDate, setFilterDate] = useState("");

  // Cancel modal
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(() => {
    if (!token) return;
    const params = new URLSearchParams();
    if (filterBarber) params.set("barber_id", filterBarber);
    if (filterStatus) params.set("status", filterStatus);
    if (filterDate) params.set("date", filterDate);
    const qs = params.toString() ? `?${params.toString()}` : "";

    apiFetch<{ bookings: Booking[] }>(`/api/owner/bookings${qs}`, { token })
      .then((d) => setBookings(d.bookings))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, filterBarber, filterStatus, filterDate]);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ barbers: OwnerBarber[] }>("/api/owner/barbers", { token }).then((d) =>
      setBarbers(d.barbers)
    );
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useLiveNotifications("owner", () => load());

  function triggerCancel(b: Booking) {
    setBookingToCancel(b);
    setCancelModalOpen(true);
  }

  async function executeCancelBooking() {
    if (!token || !bookingToCancel) return;
    setCancelling(true);
    try {
      await apiFetch(`/api/owner/bookings/${bookingToCancel.id}/cancel`, { method: "POST", token });
      setCancelModalOpen(false);
      setBookingToCancel(null);
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCancelling(false);
    }
  }

  async function markNoShow(id: number) {
    if (!token) return;
    setActionLoadingId(id);
    try {
      await apiFetch(`/api/owner/bookings/${id}/no-show`, { method: "POST", token });
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function markComplete(id: number) {
    if (!token) return;
    setActionLoadingId(id);
    try {
      await apiFetch(`/api/owner/bookings/${id}/complete`, { method: "POST", token });
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Cancel Confirmation Modal ── */}
      <ConfirmModal
        isOpen={cancelModalOpen}
        title="تأكيد إلغاء الحجز من الإدارة"
        message={
          bookingToCancel
            ? `هل أنت متأكد من إلغاء حجز الزبون "${bookingToCancel.customer_name}" مع الحلاق "${bookingToCancel.barber_name}" بتاريخ ${bookingToCancel.booking_date}؟ سيتم إشعار الزبون وإتاحة الموعد لقائمة الانتظار.`
            : "هل أنت متأكد من إلغاء هذا الحجز؟"
        }
        confirmText="نعم، إلغاء الحجز"
        cancelText="تراجع"
        variant="danger"
        isLoading={cancelling}
        onConfirm={executeCancelBooking}
        onClose={() => {
          if (!cancelling) {
            setCancelModalOpen(false);
            setBookingToCancel(null);
          }
        }}
      />

      <h1 className="text-2xl font-bold text-zinc-100">إدارة ومتابعة الحجوزات</h1>

      {/* ── filters ── */}
      <div className="flex flex-wrap gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-xs text-zinc-400 font-medium">الحلاق</label>
          <select
            value={filterBarber}
            onChange={(e) => setFilterBarber(e.target.value)}
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-500"
          >
            <option value="">كل الحلاقين</option>
            {barbers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400 font-medium">الحالة</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-500"
          >
            <option value="">جميع الحالات</option>
            <option value="confirmed">مؤكد</option>
            <option value="cancelled">ملغي</option>
            <option value="completed">مكتمل</option>
            <option value="no_show">لم يحضر</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400 font-medium">التاريخ</label>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-500"
          />
        </div>
        {(filterBarber || filterStatus || filterDate) && (
          <button
            onClick={() => {
              setFilterBarber("");
              setFilterStatus("");
              setFilterDate("");
            }}
            className="self-end rounded-xl border border-zinc-700 px-3.5 py-2 text-xs font-semibold text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
          >
            مسح الفلاتر ✕
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-400 flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="text-xs text-red-300 hover:underline">
            إغلاق
          </button>
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
          <Spinner size="lg" label="جاري تحميل الحجوزات…" />
        </div>
      )}

      {/* ── bookings table ── */}
      {!loading && bookings.length === 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-zinc-400">
          لا توجد حجوزات تطابق الفلاتر المحددة.
        </div>
      )}

      <div className="space-y-3">
        {bookings.map((b) => (
          <div key={b.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-3 shadow-md transition hover:border-zinc-700">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-bold text-zinc-100 text-base">
                  {b.customer_name}{" "}
                  <span className="text-xs font-normal text-zinc-400" dir="ltr">({b.customer_phone})</span>
                </p>
                <p className="text-xs sm:text-sm text-zinc-300 mt-0.5">
                  مع الحلاق <span className="font-bold text-amber-400">{b.barber_name}</span> — {b.booking_date}
                </p>
                <p className="text-xs sm:text-sm text-zinc-400">
                  ⏰ من {formatTime12(b.start_time)} إلى {formatTime12(b.end_time)}
                </p>
                {b.created_at && (
                  <p className="text-[11px] text-zinc-500 mt-1">
                    تاريخ الإنشاء: {formatDateTime(b.created_at)}
                  </p>
                )}
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-bold ${
                  statusColor[b.status] ?? "bg-zinc-800 text-zinc-400"
                }`}
              >
                {BOOKING_STATUS_AR[b.status] ?? b.status}
              </span>
            </div>

            {/* services */}
            {b.services?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 bg-zinc-950/40 p-2 rounded-xl">
                {b.services.map((s, i) => (
                  <span
                    key={i}
                    className="rounded-lg bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300"
                  >
                    {s.name} ({s.price} د.أ)
                  </span>
                ))}
              </div>
            )}

            {/* actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-800/80">
              <p className="font-bold text-amber-400 text-base">{b.total_price} د.أ</p>
              <div className="flex flex-wrap gap-2">
                {b.status === "confirmed" && (
                  <>
                    <button
                      onClick={() => markComplete(b.id)}
                      disabled={actionLoadingId === b.id}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition"
                    >
                      {actionLoadingId === b.id ? <Spinner size="sm" color="white" /> : "✓ مكتمل"}
                    </button>
                    <button
                      onClick={() => markNoShow(b.id)}
                      disabled={actionLoadingId === b.id}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3.5 py-1.5 text-xs font-semibold text-orange-400 hover:bg-orange-500/20 disabled:opacity-50 transition"
                    >
                      {actionLoadingId === b.id ? <Spinner size="sm" color="white" /> : "لم يحضر"}
                    </button>
                    <button
                      onClick={() => triggerCancel(b)}
                      disabled={actionLoadingId === b.id}
                      className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition"
                    >
                      إلغاء
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
