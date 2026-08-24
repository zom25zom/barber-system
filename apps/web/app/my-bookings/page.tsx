"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getCustomerToken } from "@/lib/auth";
import { formatTime12, BOOKING_STATUS_AR } from "@/lib/time";
import { useLiveNotifications } from "@/lib/useNotifications";
import Spinner from "@/components/Spinner";
import ConfirmModal from "@/components/ConfirmModal";
import type { Booking } from "@/lib/types";

type QueueItem = {
  booking_id: number;
  barber_id: number;
  barber_name: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  total_price: number;
  services: { name: string; price: number; duration_minutes: number }[];
  people_ahead: number;
  queue_number: number;
  estimated_wait_minutes: number;
  is_my_turn: boolean;
};

const statusColor: Record<string, string> = {
  confirmed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  cancelled: "bg-red-500/15 text-red-400 border-red-500/30",
  completed: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  no_show: "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

export default function MyBookingsPage() {
  const router = useRouter();
  const token = getCustomerToken();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [selectedBookingToCancel, setSelectedBookingToCancel] = useState<number | null>(null);
  const [tab, setTab] = useState<"queue" | "bookings">("queue");

  useEffect(() => {
    if (!token) router.replace("/login");
  }, [token, router]);

  const loadData = useCallback(() => {
    if (!token) return;
    Promise.all([
      apiFetch<{ bookings: Booking[] }>("/api/customer/bookings", { token }),
      apiFetch<{ queue: QueueItem[] }>("/api/customer/queue", { token }).catch(() => ({ queue: [] })),
    ])
      .then(([b, q]) => {
        setBookings(b.bookings);
        setQueue(q.queue);
        // If has active queue, default to queue tab
        if (q.queue && q.queue.length > 0) {
          setTab("queue");
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time updates via WebSocket + sound
  useLiveNotifications("customer", () => loadData());

  function triggerCancelModal(id: number) {
    setSelectedBookingToCancel(id);
    setConfirmModalOpen(true);
  }

  async function executeCancelBooking() {
    if (!token || !selectedBookingToCancel) return;
    setCancellingId(selectedBookingToCancel);
    try {
      await apiFetch(`/api/customer/bookings/${selectedBookingToCancel}/cancel`, {
        method: "POST",
        token,
      });
      setConfirmModalOpen(false);
      setSelectedBookingToCancel(null);
      setError(null);
      loadData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCancellingId(null);
    }
  }

  if (!token) return null;

  const activeQueueCount = queue.length;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* ── Confirm Cancel Modal ── */}
      <ConfirmModal
        isOpen={confirmModalOpen}
        title="تأكيد إلغاء الحجز"
        message="هل أنت متأكد من رغبتك في إلغاء هذا الحجز؟ لن تتمكن من التراجع عن هذا الإجراء وسيتم إتاحة الموعد لزبون آخر."
        confirmText="نعم، إلغاء الحجز"
        cancelText="تراجع"
        variant="danger"
        isLoading={cancellingId !== null}
        onConfirm={executeCancelBooking}
        onClose={() => {
          if (!cancellingId) {
            setConfirmModalOpen(false);
            setSelectedBookingToCancel(null);
          }
        }}
      />

      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-100">حجوزاتي ومتابعة الدور</h1>
        <button
          onClick={() => router.push("/book")}
          className="rounded-xl bg-amber-500 px-4 py-2 text-xs sm:text-sm font-bold text-zinc-950 hover:bg-amber-400 shadow-sm transition"
        >
          + حجز جديد
        </button>
      </div>

      {/* tabs */}
      <div className="flex gap-2 border-b border-zinc-800 pb-2">
        <button
          onClick={() => setTab("queue")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all ${
            tab === "queue"
              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <span>⏳ الدور المباشر</span>
          {activeQueueCount > 0 && (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-zinc-950">
              {activeQueueCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("bookings")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all ${
            tab === "bookings"
              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <span>📋 سجل الحجوزات</span>
          <span className="text-xs text-zinc-500">({bookings.length})</span>
        </button>
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
          <Spinner size="lg" label="جاري تحميل الدور وسجل الحجوزات…" />
        </div>
      )}

      {/* ═══════ Tab 1: Live Queue (الدور) ═══════ */}
      {tab === "queue" && !loading && (
        <div className="space-y-4">
          {queue.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center space-y-3">
              <span className="text-4xl">💈</span>
              <h3 className="text-base font-bold text-zinc-200">لا يوجد لديك حجز نشط في الدور حالياً</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                عند قيامك بحجز موعد، سيظهر هنا ترتيبك المباشر في الدور والوقت المتوقع لدخولك.
              </p>
              <button
                onClick={() => router.push("/book")}
                className="mt-2 inline-block rounded-xl bg-amber-500 px-6 py-2.5 text-xs font-bold text-zinc-950 hover:bg-amber-400 transition"
              >
                احجز موعدك الآن
              </button>
            </div>
          ) : (
            queue.map((item) => (
              <div
                key={item.booking_id}
                className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-xl space-y-4 p-5"
              >
                {/* Header: Turn banner */}
                {item.is_my_turn ? (
                  <div className="animate-pulse rounded-xl border-2 border-emerald-500 bg-emerald-500/20 p-4 text-center">
                    <span className="text-3xl inline-block mb-1">🎉</span>
                    <h2 className="text-lg sm:text-xl font-black text-emerald-300">
                      دورك الآن! تفضل بالتوجه إلى كرسي الحلاق 💈✂️
                    </h2>
                    <p className="text-xs text-emerald-200/90 mt-1">
                      الحلاق {item.barber_name} بانتظارك الآن
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                          موقعك في الطابور
                        </span>
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <span className="text-2xl sm:text-3xl font-black text-amber-400">
                            رقم {item.queue_number}
                          </span>
                          <span className="text-xs text-zinc-300">في الدور</span>
                        </div>
                      </div>

                      <div className="text-left sm:text-right bg-zinc-950/60 border border-zinc-800 px-3.5 py-2 rounded-xl">
                        <p className="text-xs text-zinc-400">الزبائن قبلك</p>
                        <p className="text-base font-bold text-zinc-100">
                          {item.people_ahead === 0
                            ? "أنت التالي مباشرة"
                            : item.people_ahead === 1
                            ? "شخص واحد فقط"
                            : `${item.people_ahead} أشخاص`}
                        </p>
                      </div>
                    </div>

                    {item.people_ahead > 0 && (
                      <div className="mt-3 pt-3 border-t border-amber-500/20 flex items-center justify-between text-xs">
                        <span className="text-zinc-300">⏳ الوقت التقريبي المتبقي للبدء:</span>
                        <span className="font-bold text-amber-400 bg-amber-500/20 px-2.5 py-1 rounded-lg">
                          حوالي {item.estimated_wait_minutes} دقيقة
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Booking details card */}
                <div className="space-y-2.5 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-zinc-400">الحلاق:</span>
                    <span className="font-bold text-zinc-100">✂ {item.barber_name}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-zinc-400">تاريخ وموعد الحجز:</span>
                    <span className="font-medium text-zinc-200">
                      {item.booking_date} ({formatTime12(item.start_time)} - {formatTime12(item.end_time)})
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-zinc-400">الخدمات المحجوزة:</span>
                    <span className="font-medium text-amber-400">
                      {item.services.map((s) => s.name).join(" + ")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs sm:text-sm pt-2 border-t border-zinc-800">
                    <span className="text-zinc-400">المجموع المطلوب (نقداً):</span>
                    <span className="text-base font-bold text-amber-400">{item.total_price} د.أ</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-zinc-500">
                    يتم تحديث الدور تلقائياً فور انتهاء الزبون السابق
                  </span>
                  <button
                    onClick={() => triggerCancelModal(item.booking_id)}
                    className="rounded-xl border border-red-500/30 px-4 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition active:scale-95"
                  >
                    إلغاء الحجز
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ═══════ Tab 2: Bookings History ═══════ */}
      {tab === "bookings" && !loading && (
        <div className="space-y-3">
          {bookings.length === 0 && <p className="text-zinc-500 text-sm">لا توجد حجوزات مسجلة.</p>}
          {bookings.map((b) => (
            <div key={b.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4 space-y-3 shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-zinc-100 text-base">{b.barber_name}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {b.booking_date} — {formatTime12(b.start_time)} إلى {formatTime12(b.end_time)}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-bold ${
                    statusColor[b.status] ?? "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {BOOKING_STATUS_AR[b.status] ?? b.status}
                </span>
              </div>

              {b.services?.length > 0 && (
                <div className="space-y-1.5 bg-zinc-950/40 rounded-xl p-2.5">
                  {b.services.map((s, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-zinc-300">{s.name} ({s.duration_minutes} دقيقة)</span>
                      <span className="text-amber-400 font-semibold">{s.price} د.أ</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <p className="font-bold text-amber-400 text-sm sm:text-base">{b.total_price} د.أ</p>
                {b.status === "confirmed" && (
                  <button
                    onClick={() => triggerCancelModal(b.id)}
                    className="rounded-xl border border-red-500/40 px-4 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition active:scale-95"
                  >
                    إلغاء الحجز
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
