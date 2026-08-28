"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getCustomerToken } from "@/lib/auth";
import { useTenantLink } from "@/lib/salonTenant";
import { formatTime12, BOOKING_STATUS_AR } from "@/lib/time";
import { useLiveNotifications } from "@/lib/useNotifications";
import Spinner from "@/components/Spinner";
import ConfirmModal from "@/components/ConfirmModal";
import BookingCountdown from "@/components/BookingCountdown";
import { Button } from "@/components/ui/button";
import { CircleAlert, Hourglass, ClipboardList } from "lucide-react";
import type { Booking, QueueItem } from "@/lib/types";

/* status → colored dot + text (quiet, editorial — no pill boxes) */
const statusDot: Record<string, string> = {
  confirmed: "bg-[var(--bs-primary)]",
  cancelled: "bg-[var(--bs-error)]",
  completed: "bg-[var(--bs-success)]",
  no_show: "bg-[var(--bs-warning)]",
};
const statusText: Record<string, string> = {
  confirmed: "text-[var(--bs-primary)]",
  cancelled: "text-[var(--bs-error)]",
  completed: "text-[var(--bs-success)]",
  no_show: "text-[var(--bs-warning)]",
};

export function MyBookingsClient({ salonSlug }: { salonSlug?: string }) {
  const tLink = useTenantLink();
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
    if (!token) router.replace(tLink.href("/login"));
  }, [token, router]);

  const loadData = useCallback(() => {
    if (!token) return;
    const now = new Date();
    const currentHH = String(now.getHours()).padStart(2, "0");
    const currentMM = String(now.getMinutes()).padStart(2, "0");
    const clientTime = `${currentHH}:${currentMM}`;

    Promise.all([
      apiFetch<{ bookings: Booking[] }>("/api/customer/bookings", { token }),
      apiFetch<{ queue: QueueItem[] }>(`/api/customer/queue?clientTime=${clientTime}`, { token }).catch(() => ({ queue: [] })),
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
    <div className="bs-skin mx-auto max-w-2xl pb-4">
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

      {/* ── page header ── */}
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-2.5 text-[11px] font-bold tracking-[0.25em] text-[var(--bs-primary)]">
            <span className="inline-block h-px w-8 bg-[var(--bs-primary)]/60" />
            حسابك
          </p>
          <h1 className="text-2xl font-black text-[var(--bs-text)] sm:text-3xl">حجوزاتي ومتابعة الدور</h1>
        </div>
        <Button size="sm" onClick={() => tLink.push("/book")} className="shrink-0">
          + حجز جديد
        </Button>
      </header>

      {/* ── underline tabs (operations-board style, no pill boxes) ── */}
      <div className="mt-7 flex gap-6 border-b border-[var(--bs-border)]">
        <button
          onClick={() => setTab("queue")}
          className={`-mb-px flex items-center gap-2 border-b-2 pb-3 text-sm font-bold transition-colors ${
            tab === "queue"
              ? "border-[var(--bs-primary)] text-[var(--bs-primary)]"
              : "border-transparent text-[var(--bs-text-muted)] hover:text-[var(--bs-text)]"
          }`}
        >
          <Hourglass className="h-4 w-4" /> الدور المباشر
          {activeQueueCount > 0 && (
            <span className="rounded-full bg-[var(--bs-primary)] px-2 py-0.5 text-[10px] font-black text-[var(--bs-on-primary)]">
              {activeQueueCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("bookings")}
          className={`-mb-px flex items-center gap-2 border-b-2 pb-3 text-sm font-bold transition-colors ${
            tab === "bookings"
              ? "border-[var(--bs-primary)] text-[var(--bs-primary)]"
              : "border-transparent text-[var(--bs-text-muted)] hover:text-[var(--bs-text)]"
          }`}
        >
          <ClipboardList className="h-4 w-4" /> سجل الحجوزات
          <span className="text-xs font-normal text-[var(--bs-text-faint)]">({bookings.length})</span>
        </button>
      </div>

      {error && (
        <div className="mt-5 flex items-center justify-between rounded-xl border border-[var(--bs-error)]/40 bg-[var(--bs-error-soft)] p-4 text-sm text-[var(--bs-error)]">
          <span className="flex items-center gap-2">
            <CircleAlert className="h-4 w-4 shrink-0" /> {error}
          </span>
          <button onClick={() => setError(null)} className="text-xs underline opacity-80 hover:opacity-100">
            إغلاق
          </button>
        </div>
      )}

      {loading && (
        <div className="py-16 text-center">
          <Spinner size="lg" label="جاري تحميل الدور وسجل الحجوزات…" />
        </div>
      )}

      {/* ═══════ Tab 1: Live Queue (الدور) ═══════ */}
      {tab === "queue" && !loading && (
        <div className="mt-6 space-y-5">
          {queue.length === 0 ? (
            <div className="py-14 text-center">
              <span className="text-5xl">💈</span>
              <h3 className="mt-5 text-lg font-bold text-[var(--bs-text)]">لا يوجد لديك حجز نشط في الدور حالياً</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--bs-text-muted)]">
                عند قيامك بحجز موعد، سيظهر هنا ترتيبك المباشر في الدور والوقت المتوقع لدخولك.
              </p>
              <Button onClick={() => tLink.push("/book")} className="mt-6">
                احجز موعدك الآن
              </Button>
            </div>
          ) : (
            queue.map((item) => (
              /* the one dominant focal card on this page */
              <article
                key={item.booking_id}
                className="bs-panel relative overflow-hidden"
              >
                {/* top accent band */}
                <div
                  className="h-1 w-full"
                  style={{
                    background: item.is_my_turn
                      ? "linear-gradient(to left, transparent, var(--bs-success), transparent)"
                      : "linear-gradient(to left, transparent, var(--bs-primary), transparent)",
                  }}
                />

                <div className="p-5 sm:p-7">
                  {/* turn banner / queue position */}
                  {item.is_my_turn ? (
                    <div className="animate-pulse rounded-2xl border-2 border-[var(--bs-success)] bg-[var(--bs-success-soft)] p-5 text-center">
                      <span className="mb-1 inline-block text-3xl">🎉</span>
                      <h2 className="text-lg font-black text-[var(--bs-success)] sm:text-xl">
                        دورك الآن! تفضل بالتوجه إلى كرسي الحلاق 💈✂️
                      </h2>
                      <p className="mt-1 text-xs text-[var(--bs-success)]/80">
                        الحلاق {item.barber_name} بانتظارك الآن
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <span className="text-[11px] font-bold tracking-[0.2em] text-[var(--bs-primary)]">
                          موقعك في الطابور
                        </span>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="text-5xl font-black leading-none text-[var(--bs-primary)]">
                            {item.queue_number}
                          </span>
                          <span className="text-sm text-[var(--bs-text-muted)]">في الدور</span>
                        </div>
                      </div>

                      <div className="text-left">
                        <p className="text-[11px] text-[var(--bs-text-faint)]">الزبائن قبلك</p>
                        <p className="text-lg font-bold text-[var(--bs-text)]">
                          {item.people_ahead === 0
                            ? "أنت التالي مباشرة"
                            : item.people_ahead === 1
                            ? "شخص واحد فقط"
                            : `${item.people_ahead} أشخاص`}
                        </p>
                      </div>
                    </div>
                  )}

                  {item.people_ahead > 0 && !item.is_my_turn && (
                    <div className="mt-4 flex items-center justify-between border-t border-[var(--bs-border)] pt-3 text-xs">
                      <span className="text-[var(--bs-text-muted)]">⏳ الوقت التقريبي المتبقي للبدء:</span>
                      <span className="rounded-lg bg-[var(--bs-primary-soft)] px-2.5 py-1 font-bold text-[var(--bs-primary)]">
                        حوالي {item.estimated_wait_minutes} دقيقة
                      </span>
                    </div>
                  )}

                  {/* Live Countdown Timer (calculation logic untouched) */}
                  <div className="mt-5">
                    <BookingCountdown
                      bookingDate={item.booking_date}
                      startTime={item.start_time}
                      effectiveStartTime={item.effective_start_time}
                      delayMinutes={item.delay_minutes}
                      targetDatetimeIso={item.target_datetime_iso}
                      isMyTurn={item.is_my_turn}
                    />
                  </div>

                  {/* booking details — quiet definition rows */}
                  <div className="mt-5 divide-y divide-[var(--bs-border)] border-t border-[var(--bs-border)]">
                    <div className="flex items-center justify-between py-3 text-sm">
                      <span className="text-[var(--bs-text-muted)]">الحلاق:</span>
                      <span className="font-bold text-[var(--bs-text)]">{item.barber_name}</span>
                    </div>
                    <div className="flex items-center justify-between py-3 text-sm">
                      <span className="text-[var(--bs-text-muted)]">تاريخ وموعد الحجز:</span>
                      <span className="font-medium text-[var(--bs-text)]">
                        {item.booking_date} ({formatTime12(item.start_time)} - {formatTime12(item.end_time)})
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-3 text-sm">
                      <span className="text-[var(--bs-text-muted)]">الخدمات المحجوزة:</span>
                      <span className="font-medium text-[var(--bs-primary)]">
                        {item.services.map((s) => s.name).join(" + ")}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between py-3">
                      <span className="text-sm text-[var(--bs-text-muted)]">المجموع المطلوب (نقداً):</span>
                      <span className="text-xl font-black text-[var(--bs-primary)]">{item.total_price} د.أ</span>
                    </div>
                  </div>

                  {/* actions */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-[var(--bs-text-faint)]">
                      يتم تحديث الدور تلقائياً فور انتهاء الزبون السابق
                    </span>
                    <Button
                      onClick={() => triggerCancelModal(item.booking_id)}
                      variant="outline"
                      size="sm"
                      className="shrink-0 border-[var(--bs-error)]/40 text-[var(--bs-error)] hover:bg-[var(--bs-error-soft)]"
                    >
                      إلغاء الحجز
                    </Button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      )}

      {/* ═══════ Tab 2: Bookings History — quiet ledger rows ═══════ */}
      {tab === "bookings" && !loading && (
        <div className="mt-6">
          {bookings.length === 0 && (
            <p className="py-10 text-center text-sm text-[var(--bs-text-faint)]">لا توجد حجوزات مسجلة.</p>
          )}
          {bookings.length > 0 && (
            <div className="divide-y divide-[var(--bs-border)] border-y border-[var(--bs-border)]">
              {bookings.map((b) => (
                <div key={b.id} className="group py-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-bold text-[var(--bs-text)]">{b.barber_name}</p>
                      <p className="mt-1 text-xs text-[var(--bs-text-muted)]" dir="rtl">
                        {b.booking_date} — {formatTime12(b.start_time)} إلى {formatTime12(b.end_time)}
                      </p>
                    </div>
                    <span className={`flex shrink-0 items-center gap-1.5 text-xs font-bold ${statusText[b.status] ?? "text-[var(--bs-text-muted)]"}`}>
                      <span className={`h-2 w-2 rounded-full ${statusDot[b.status] ?? "bg-[var(--bs-border-strong)]"}`} />
                      {BOOKING_STATUS_AR[b.status] ?? b.status}
                    </span>
                  </div>

                  {b.services?.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {b.services.map((s, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-[var(--bs-text-faint)]">{s.name} ({s.duration_minutes} دقيقة)</span>
                          <span className="font-semibold text-[var(--bs-primary)]">{s.price} د.أ</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-base font-black text-[var(--bs-primary)]">{b.total_price} د.أ</p>
                    {b.status === "confirmed" && (
                      <button
                        onClick={() => triggerCancelModal(b.id)}
                        className="text-xs font-bold text-[var(--bs-error)] underline-offset-4 transition hover:underline"
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
      )}
    </div>
  );
}

export default MyBookingsClient;
