"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { withSlug, getSalonSlugParam, useTenantLink } from "@/lib/salonTenant";
import { getCustomerToken } from "@/lib/auth";
import { formatTime12, next7Days } from "@/lib/time";
import Spinner from "@/components/Spinner";
import ConfirmModal from "@/components/ConfirmModal";
import type { Barber, Service, Slot, Booking } from "@/lib/types";

const steps = ["الحلاق", "الخدمات", "الموعد", "التأكيد"];

function BookContent() {
  const tLink = useTenantLink();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = getCustomerToken();

  const preselectedBarberId = searchParams.get("barberId") ? Number(searchParams.get("barberId")) : null;
  const preselectedServiceId = searchParams.get("serviceId") ? Number(searchParams.get("serviceId")) : null;

  /* ── state ── */
  const [step, setStep] = useState(0);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [totalDuration, setTotalDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [cancellingActive, setCancellingActive] = useState(false);
  const [isTimeOff, setIsTimeOff] = useState(false);
  const [timeOffReason, setTimeOffReason] = useState<string | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  /* ── redirect if not logged in ── */
  useEffect(() => {
    if (!token) router.replace(tLink.href("/login"));
  }, [token, router]);

  /* ── check existing active booking ── */
  useEffect(() => {
    if (!token) return;
    apiFetch<{ bookings: Booking[] }>("/api/customer/bookings", { token })
      .then((d) => {
        const active = d.bookings.find((b) => b.status === "confirmed");
        if (active) setActiveBooking(active);
      })
      .catch(() => {});
  }, [token]);

  /* ── load barbers ── */
  useEffect(() => {
    apiFetch<{ barbers: Barber[] }>(withSlug("/api/barbers"))
      .then((d) => {
        setBarbers(d.barbers);
        // If preselected barber in URL
        if (preselectedBarberId) {
          const found = d.barbers.find((b) => b.id === preselectedBarberId);
          if (found) {
            setSelectedBarber(found);
            if (preselectedServiceId) {
              const svc = found.services.find((s) => s.id === preselectedServiceId);
              if (svc) {
                setSelectedServices([svc]);
                setStep(2); // Go straight to date/time selection
                return;
              }
            }
            setStep(1); // Go to service selection
          }
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [preselectedBarberId, preselectedServiceId]);

  /* ── load slots when date changes ── */
  useEffect(() => {
    if (!selectedBarber || !selectedDate || selectedServices.length === 0) return;
    setSlotsLoading(true);
    setSelectedSlot(null);
    setIsTimeOff(false);
    setTimeOffReason(null);
    const ids = selectedServices.map((s) => s.id).join(",");
    const now = new Date();
    const currentHH = String(now.getHours()).padStart(2, "0");
    const currentMM = String(now.getMinutes()).padStart(2, "0");
    const clientTime = `${currentHH}:${currentMM}`;

    apiFetch<{ slots: Slot[]; total_duration: number; is_time_off?: boolean; reason?: string | null }>(
      withSlug(`/api/barbers/${selectedBarber.id}/availability?date=${selectedDate}&serviceIds=${ids}&clientTime=${clientTime}`)
    )
      .then((d) => {
        setSlots(d.slots);
        setTotalDuration(d.total_duration);
        if (d.is_time_off) {
          setIsTimeOff(true);
          setTimeOffReason(d.reason ?? null);
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setSlotsLoading(false));
  }, [selectedBarber, selectedDate, selectedServices]);

  /* ── helpers ── */
  const totalPrice = selectedServices.reduce((s, svc) => s + svc.price, 0);
  const totalMins = selectedServices.reduce((s, svc) => s + svc.duration_minutes, 0);

  function toggleService(svc: Service) {
    setSelectedServices((prev) =>
      prev.find((s) => s.id === svc.id) ? prev.filter((s) => s.id !== svc.id) : [...prev, svc]
    );
    setSelectedSlot(null);
    setSlots([]);
  }

  async function executeCancelActiveBooking() {
    if (!activeBooking || !token) return;
    setCancellingActive(true);
    try {
      await apiFetch(`/api/customer/bookings/${activeBooking.id}/cancel`, { method: "POST", token });
      setActiveBooking(null);
      setCancelModalOpen(false);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCancellingActive(false);
    }
  }

  async function handleConfirm() {
    if (!selectedBarber || !selectedSlot || selectedServices.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/api/customer/bookings", {
        method: "POST",
        token,
        body: {
          barber_id: selectedBarber.id,
          service_ids: selectedServices.map((s) => s.id),
          date: selectedDate,
          start_time: selectedSlot.start_time,
        },
      });
      tLink.push("/my-bookings");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) return null;

  // If customer already has an active confirmed booking, show informative blocking screen
  if (activeBooking) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <ConfirmModal
          isOpen={cancelModalOpen}
          title="تأكيد إلغاء الموعد الحالي"
          message="هل أنت متأكد من رغبتك في إلغاء موعدك الحالي لتتمكن من اختيار موعد جديد؟ لن تتمكن من استرجاع هذا الموعد إذا تم حجزه من قبل شخص آخر."
          confirmText="نعم، إلغاء الحجز القديم"
          cancelText="تراجع"
          variant="danger"
          isLoading={cancellingActive}
          onConfirm={executeCancelActiveBooking}
          onClose={() => {
            if (!cancellingActive) setCancelModalOpen(false);
          }}
        />

        <div className="rounded-2xl border border-amber-500/40 bg-zinc-900/95 p-6 shadow-xl text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/15 border-2 border-amber-500/40 text-3xl">
            💈
          </div>
          <h2 className="text-xl font-bold text-amber-400">لديك حجز نشط بالفعل</h2>
          <p className="text-xs sm:text-sm text-zinc-300 max-w-md mx-auto leading-relaxed">
            يُسمح لكل زبون بحجز واحد نشط فقط في نفس الوقت لتنظيم الدور. لا يمكنك إجراء حجز جديد حتى انتهاء موعدك الحالي أو إلغائه.
          </p>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 text-right space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-400">الحلاق:</span>
              <span className="font-bold text-zinc-100">{activeBooking.barber_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">تاريخ وموعد الحجز:</span>
              <span className="font-medium text-amber-400">
                {activeBooking.booking_date} ({formatTime12(activeBooking.start_time)} - {formatTime12(activeBooking.end_time)})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">المجموع:</span>
              <span className="font-bold text-zinc-100">{activeBooking.total_price} د.أ</span>
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-xs text-red-400">
              ⚠️ {error}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => tLink.push("/my-bookings")}
              className="flex-1 rounded-xl bg-amber-500 py-3 text-xs sm:text-sm font-bold text-zinc-950 hover:bg-amber-400 transition-colors shadow-md"
            >
              ⏳ متابعة دورك وتفاصيل الحجز
            </button>
            <button
              onClick={() => setCancelModalOpen(true)}
              className="rounded-xl border border-red-500/40 px-5 py-3 text-xs sm:text-sm font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
            >
              إلغاء هذا الحجز
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* ── stepper ── */}
      <div className="flex items-center justify-between rounded-xl bg-zinc-900/70 border border-zinc-800 p-3 text-xs sm:text-sm">
        {steps.map((label, i) => (
          <div key={label} className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => {
                if (i < step) setStep(i);
              }}
              className={`flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                i === step
                  ? "bg-amber-500 text-zinc-950 shadow-sm shadow-amber-500/50"
                  : i < step
                    ? "bg-amber-500/20 text-amber-400 cursor-pointer"
                    : "bg-zinc-800 text-zinc-500"
              }`}
            >
              {i + 1}
            </button>
            <span className={i === step ? "text-amber-400 font-bold" : "text-zinc-500 hidden sm:inline"}>
              {label}
            </span>
            {i < steps.length - 1 && <span className="text-zinc-700 text-xs">←</span>}
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-400 flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="text-xs text-red-300 hover:underline">
            إغلاق
          </button>
        </div>
      )}

      {/* ═══════ Step 0: Select Barber ═══════ */}
      {step === 0 && (
        <section className="space-y-4">
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-100">اختر الحلاق</h1>
          {loading && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
              <Spinner size="md" label="جاري تحميل قائمة الحلاقين…" />
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {barbers.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  setSelectedBarber(b);
                  setSelectedServices([]);
                  setSelectedSlot(null);
                  setSlots([]);
                  setStep(1);
                }}
                className={`flex items-center gap-4 rounded-xl border p-4 text-start transition-all ${
                  selectedBarber?.id === b.id
                    ? "border-amber-500 bg-amber-500/15"
                    : "border-zinc-800 bg-zinc-900 hover:border-amber-500/50 active:bg-zinc-800"
                }`}
              >
                {b.photo_url ? (
                  <img
                    src={b.photo_url}
                    alt={b.name}
                    className="h-14 w-14 rounded-full border-2 border-amber-500/40 object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-amber-500/40 bg-zinc-800 text-2xl">
                    💈
                  </div>
                )}
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-amber-400">{b.name}</h3>
                  <p className="text-xs sm:text-sm text-zinc-400">
                    {b.services.length} خدمات متاحة
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ═══════ Step 1: Select Services ═══════ */}
      {step === 1 && selectedBarber && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-100">اختر الخدمات ({selectedBarber.name})</h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400">يمكنك اختيار أكثر من خدمة في نفس الموعد</p>

          {selectedBarber.services.length === 0 ? (
            <p className="text-zinc-500">لا توجد خدمات لهذا الحلاق.</p>
          ) : (
            <div className="space-y-2">
              {selectedBarber.services.map((svc) => {
                const checked = !!selectedServices.find((s) => s.id === svc.id);
                return (
                  <label
                    key={svc.id}
                    className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all ${
                      checked
                        ? "border-amber-500 bg-amber-500/15"
                        : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleService(svc)}
                        className="h-5 w-5 accent-amber-500"
                      />
                      <div>
                        <p className="font-semibold text-zinc-100">{svc.name}</p>
                        <p className="text-xs text-zinc-500">{svc.duration_minutes} دقيقة</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-amber-500/10 px-3 py-1 text-sm font-bold text-amber-400">
                      {svc.price} د.أ
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {selectedServices.length > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <div>
                <p className="text-xs text-zinc-400">السعر الإجمالي</p>
                <p className="text-xl font-bold text-amber-400">{totalPrice} د.أ</p>
              </div>
              <div className="text-left">
                <p className="text-xs text-zinc-400">المدة الكلية</p>
                <p className="font-bold text-zinc-100">{totalMins} دقيقة</p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep(0)}
              className="rounded-xl border border-zinc-700 px-5 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              السابق
            </button>
            <button
              onClick={() => {
                if (selectedServices.length > 0) {
                  setSelectedDate("");
                  setSelectedSlot(null);
                  setSlots([]);
                  setStep(2);
                }
              }}
              disabled={selectedServices.length === 0}
              className="flex-1 rounded-xl bg-amber-500 py-3 font-bold text-zinc-950 transition-colors hover:bg-amber-400 disabled:opacity-40"
            >
              التالي — اختيار الموعد
            </button>
          </div>
        </section>
      )}

      {/* ═══════ Step 2: Select Date & Time ═══════ */}
      {step === 2 && selectedBarber && (
        <section className="space-y-4">
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-100">اختر اليوم والوقت</h1>

          {/* date pills */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {next7Days().map((d) => (
              <button
                key={d.iso}
                onClick={() => setSelectedDate(d.iso)}
                className={`shrink-0 rounded-xl border px-4 py-2.5 text-center transition-all ${
                  selectedDate === d.iso
                    ? "border-amber-500 bg-amber-500/20 text-amber-400 shadow-md"
                    : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700"
                }`}
              >
                <p className="text-sm font-bold">{d.label}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{d.iso}</p>
              </button>
            ))}
          </div>

          {/* time slots */}
          {selectedDate && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 space-y-3">
              <p className="text-xs text-zinc-400 font-medium">الأوقات المتاحة للحجز:</p>
              {slotsLoading && (
                <div className="p-6 text-center">
                  <Spinner size="md" label="جاري فحص وتحديث المواعيد المتاحة…" />
                </div>
              )}
              {!slotsLoading && slots.length === 0 && (
                <div className="py-3 text-center">
                  {isTimeOff ? (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-1">
                      <p className="text-amber-400 font-bold text-sm">🏖️ الحلاق في إجازة هذا اليوم</p>
                      {timeOffReason && (
                        <p className="text-xs text-zinc-400">السبب: {timeOffReason}</p>
                      )}
                      <p className="text-xs text-zinc-500 pt-1">يرجى اختيار يوم آخر.</p>
                    </div>
                  ) : (
                    <p className="text-zinc-500 text-sm py-2">لا توجد مواعيد متاحة في هذا اليوم (قد يكون الحلاق في إجازة أو محجوز بالكامل).</p>
                  )}
                </div>
              )}
              {!slotsLoading && slots.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((slot) => (
                    <button
                      key={slot.start_time}
                      onClick={() => setSelectedSlot(slot)}
                      className={`rounded-xl border py-2.5 px-2 text-center text-xs sm:text-sm font-semibold transition-all ${
                        selectedSlot?.start_time === slot.start_time
                          ? "border-amber-500 bg-amber-500 text-zinc-950 shadow-md"
                          : "border-zinc-800 bg-zinc-950 text-zinc-200 hover:border-amber-500/50"
                      }`}
                    >
                      {formatTime12(slot.start_time)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep(1)}
              className="rounded-xl border border-zinc-700 px-5 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              السابق
            </button>
            <button
              onClick={() => selectedSlot && setStep(3)}
              disabled={!selectedSlot}
              className="flex-1 rounded-xl bg-amber-500 py-3 font-bold text-zinc-950 transition-colors hover:bg-amber-400 disabled:opacity-40"
            >
              التالي — تأكيد الحجز
            </button>
          </div>
        </section>
      )}

      {/* ═══════ Step 3: Confirm ═══════ */}
      {step === 3 && selectedBarber && selectedSlot && (
        <section className="space-y-4">
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-100">تأكيد تفاصيل الحجز</h1>
          <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-lg">
            <Row label="الحلاق" value={selectedBarber.name} />
            <Row label="التاريخ" value={selectedDate} />
            <Row
              label="الوقت"
              value={`${formatTime12(selectedSlot.start_time)} إلى ${formatTime12(selectedSlot.end_time)}`}
            />
            <Row label="المدة الإجمالية" value={`${totalDuration || totalMins} دقيقة`} />
            <hr className="border-zinc-800" />
            <p className="text-xs font-bold text-zinc-400">الخدمات المختارة:</p>
            {selectedServices.map((s) => (
              <div key={s.id} className="flex justify-between text-sm">
                <span className="text-zinc-300">{s.name}</span>
                <span className="text-amber-400 font-semibold">{s.price} د.أ</span>
              </div>
            ))}
            <hr className="border-zinc-800" />
            <div className="flex justify-between text-lg font-bold">
              <span className="text-zinc-100">المجموع المطلوب</span>
              <span className="text-amber-400">{totalPrice} د.أ</span>
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-center text-xs sm:text-sm text-zinc-300">
            💡 يتم تأكيد الحجز مباشرة، والدفع نقداً عند الحضور للصالون.
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep(2)}
              disabled={submitting}
              className="rounded-xl border border-zinc-700 px-5 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
            >
              السابق
            </button>
            <button
              onClick={handleConfirm}
              disabled={submitting}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-3.5 font-bold text-zinc-950 transition-colors hover:bg-amber-400 disabled:opacity-50 shadow-md active:scale-98"
            >
              {submitting ? (
                <>
                  <Spinner size="sm" color="zinc" />
                  <span>جاري تأكيد الحجز…</span>
                </>
              ) : (
                "تأكيد الحجز الآن ✓"
              )}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-zinc-400">{label}</span>
      <span className="font-medium text-zinc-100">{value}</span>
    </div>
  );
}

export function BookClient({ salonSlug }: { salonSlug?: string }) {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center">
          <Spinner size="lg" label="جاري التحميل…" />
        </div>
      }
    >
      <BookContent />
    </Suspense>
  );
}


export default BookClient;
