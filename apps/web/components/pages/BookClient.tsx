"use client";

import { useEffect, useRef, useState, Suspense, Fragment } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { withSlug, getSalonSlugParam, useTenantLink } from "@/lib/salonTenant";
import { getCustomerToken } from "@/lib/auth";
import { formatTime12, next7Days } from "@/lib/time";
import Spinner from "@/components/Spinner";
import ConfirmModal from "@/components/ConfirmModal";
import { Button } from "@/components/ui/button";
import { Armchair, CircleAlert, Info } from "lucide-react";
import type { Barber, Service, Slot, Booking } from "@/lib/types";

const steps = ["الحلاق", "الخدمات", "الموعد", "التأكيد"];
const pad2 = (n: number) => String(n).padStart(2, "0");

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

  // Horizontal strip (date pills) — desktop wheel pans it directly for a fast,
  // fluid feel. Touch keeps native momentum scrolling (untouched on mobile).
  const dateStripRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = dateStripRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // Only hijack vertical wheel intent when the strip can actually scroll
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      if (el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      // Direct scrollLeft update — no smooth() easing delay, per-event momentum
      el.scrollLeft += e.deltaY + e.deltaX;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
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
      <div className="bs-skin mx-auto max-w-xl pt-4">
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

        <div className="bs-panel relative overflow-hidden p-8 text-center sm:p-10">
          <div
            className="absolute inset-x-0 top-0 h-1"
            style={{ background: "linear-gradient(to left, transparent, var(--bs-primary), transparent)" }}
          />
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[var(--bs-primary)]/40 bg-[var(--bs-primary-soft)] text-3xl">
            💈
          </div>
          <h2 className="mt-5 text-2xl font-black text-[var(--bs-text)]">لديك حجز نشط بالفعل</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--bs-text-muted)]">
            يُسمح لكل زبون بحجز واحد نشط فقط في نفس الوقت لتنظيم الدور. لا يمكنك إجراء حجز جديد حتى انتهاء موعدك الحالي أو إلغائه.
          </p>

          <div className="mt-6 divide-y divide-[var(--bs-border)] rounded-2xl border border-[var(--bs-border)] bg-[var(--bs-bg)]/60 p-5 text-right">
            <div className="flex justify-between py-1.5 text-sm">
              <span className="text-[var(--bs-text-muted)]">الحلاق:</span>
              <span className="font-bold text-[var(--bs-text)]">{activeBooking.barber_name}</span>
            </div>
            <div className="flex justify-between py-1.5 text-sm">
              <span className="text-[var(--bs-text-muted)]">تاريخ وموعد الحجز:</span>
              <span className="font-medium text-[var(--bs-primary)]">
                {activeBooking.booking_date} ({formatTime12(activeBooking.start_time)} - {formatTime12(activeBooking.end_time)})
              </span>
            </div>
            <div className="flex justify-between py-1.5 text-sm">
              <span className="text-[var(--bs-text-muted)]">المجموع:</span>
              <span className="font-bold text-[var(--bs-text)]">{activeBooking.total_price} د.أ</span>
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-xl border border-[var(--bs-error)]/40 bg-[var(--bs-error-soft)] px-4 py-2.5 text-xs text-[var(--bs-error)]">
              ⚠️ {error}
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button onClick={() => tLink.push("/my-bookings")} className="flex-1">
              متابعة دورك وتفاصيل الحجز
            </Button>
            <Button
              onClick={() => setCancelModalOpen(true)}
              variant="outline"
              className="border-[var(--bs-error)]/40 text-[var(--bs-error)] hover:bg-[var(--bs-error-soft)]"
            >
              إلغاء هذا الحجز
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bs-skin mx-auto max-w-2xl pb-6 pt-2">
      {/* ── wizard progress rail — numbered nodes, connectors, focused labels ── */}
      <div className="mb-8 flex items-start gap-1.5 sm:gap-2">
        {steps.map((label, i) => (
          <Fragment key={label}>
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => {
                  if (i < step) setStep(i);
                }}
                aria-current={i === step ? "step" : undefined}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black transition-all sm:h-10 sm:w-10 ${
                  i === step
                    ? "scale-110 border-2 border-[var(--bs-primary)] bg-[var(--bs-primary)] text-[var(--bs-on-primary)] shadow-lg shadow-[var(--bs-primary)]/25"
                    : i < step
                      ? "cursor-pointer border border-[var(--bs-primary)]/50 bg-[var(--bs-primary-soft)] text-[var(--bs-primary)] hover:bg-[var(--bs-primary)] hover:text-[var(--bs-on-primary)]"
                      : "border border-[var(--bs-border)] bg-[var(--bs-surface)] text-[var(--bs-text-faint)]"
                }`}
              >
                {i + 1}
              </button>
              <span
                className={`whitespace-nowrap text-[10px] font-bold sm:text-xs ${
                  i === step ? "text-[var(--bs-primary)]" : "text-[var(--bs-text-faint)]"
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={`mb-6 h-px flex-1 ${i < step ? "bg-[var(--bs-primary)]/60" : "bg-[var(--bs-border)]"}`}
              />
            )}
          </Fragment>
        ))}
      </div>

      {error && (
        <div className="mb-5 flex items-center justify-between rounded-xl border border-[var(--bs-error)]/40 bg-[var(--bs-error-soft)] p-4 text-sm text-[var(--bs-error)]">
          <span className="flex items-center gap-2">
            <CircleAlert className="h-4 w-4 shrink-0" /> {error}
          </span>
          <button onClick={() => setError(null)} className="text-xs underline opacity-80 hover:opacity-100">
            إغلاق
          </button>
        </div>
      )}

      {/* ═══════ Step 0: Select Barber ═══════ */}
      {step === 0 && (
        <section className="bs-panel relative overflow-hidden p-6 sm:p-8">
          <span className="bs-ghost-numeral" dir="ltr" aria-hidden="true">01</span>
          <p className="text-[11px] font-bold tracking-[0.25em] text-[var(--bs-primary)]">الخطوة الأولى</p>
          <h1 className="mt-1 text-2xl font-black text-[var(--bs-text)] sm:text-3xl">اختر الحلاق</h1>
          <p className="mt-2 text-sm text-[var(--bs-text-muted)]">كل الحلاقين معتمدون من إدارة الصالون</p>

          {loading && (
            <div className="mt-8 py-6">
              <Spinner size="md" label="جاري تحميل قائمة الحلاقين…" />
            </div>
          )}

          {!loading && (
            <div className="mt-6 divide-y divide-[var(--bs-border)] border-t border-[var(--bs-border)]">
              {barbers.map((b, idx) => (
                <button
                  key={b.id}
                  onClick={() => {
                    setSelectedBarber(b);
                    setSelectedServices([]);
                    setSelectedSlot(null);
                    setSlots([]);
                    setStep(1);
                  }}
                  className={`group flex w-full items-center gap-4 py-4 text-start transition-colors ${
                    selectedBarber?.id === b.id ? "text-[var(--bs-primary)]" : "hover:bg-[var(--bs-primary-soft)]/40"
                  }`}
                >
                  <span className="w-6 shrink-0 text-xs font-bold text-[var(--bs-text-faint)]" dir="ltr">
                    {pad2(idx + 1)}
                  </span>
                  {b.photo_url ? (
                    <img
                      src={b.photo_url}
                      alt={b.name}
                      className="h-14 w-14 shrink-0 rounded-full border-2 border-[var(--bs-primary)]/40 object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-[var(--bs-primary)]/40 bg-[var(--bs-surface-raised)] text-xl">
                      💈
                    </div>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-lg font-bold text-[var(--bs-text)] transition-colors group-hover:text-[var(--bs-primary)]">
                      {b.name}
                    </span>
                    <span className="text-xs text-[var(--bs-text-faint)]">{b.services.length} خدمات متاحة</span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="shrink-0 text-[var(--bs-text-faint)] transition-all group-hover:-translate-x-1 group-hover:text-[var(--bs-primary)]"
                  >
                    ←
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ═══════ Step 1: Select Services ═══════ */}
      {step === 1 && selectedBarber && (
        <section className="bs-panel relative overflow-hidden p-6 sm:p-8">
          <span className="bs-ghost-numeral" dir="ltr" aria-hidden="true">02</span>
          <p className="text-[11px] font-bold tracking-[0.25em] text-[var(--bs-primary)]">الخطوة الثانية</p>
          <h1 className="mt-1 text-2xl font-black text-[var(--bs-text)] sm:text-3xl">اختر الخدمات</h1>
          <p className="mt-2 text-sm text-[var(--bs-text-muted)]">
            مع <span className="font-bold text-[var(--bs-text)]">{selectedBarber.name}</span> — يمكنك اختيار أكثر من خدمة في نفس الموعد
          </p>

          {selectedBarber.services.length === 0 ? (
            <p className="mt-6 text-[var(--bs-text-faint)]">لا توجد خدمات لهذا الحلاق.</p>
          ) : (
            <div className="mt-6 divide-y divide-[var(--bs-border)] border-t border-[var(--bs-border)]">
              {selectedBarber.services.map((svc) => {
                const checked = !!selectedServices.find((s) => s.id === svc.id);
                return (
                  <label
                    key={svc.id}
                    className={`flex cursor-pointer items-center justify-between gap-3 py-4 transition-all ${
                      checked ? "text-[var(--bs-primary)]" : ""
                    }`}
                  >
                    <span className="flex items-center gap-3.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleService(svc)}
                        className="h-5 w-5 accent-[var(--bs-primary)]"
                      />
                      <span>
                        <span className={`block font-bold ${checked ? "text-[var(--bs-primary)]" : "text-[var(--bs-text)]"}`}>
                          {svc.name}
                        </span>
                        <span className="text-xs text-[var(--bs-text-faint)]">{svc.duration_minutes} دقيقة</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-base font-black text-[var(--bs-text)]">
                      {svc.price} <span className="text-[11px] font-bold text-[var(--bs-text-faint)]">د.أ</span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {selectedServices.length > 0 && (
            <div className="mt-6 flex items-center justify-between rounded-2xl border border-[var(--bs-primary)]/30 bg-[var(--bs-primary-soft)]/50 px-5 py-4">
              <div>
                <p className="text-[11px] font-bold text-[var(--bs-text-muted)]">السعر الإجمالي</p>
                <p className="text-2xl font-black text-[var(--bs-primary)]">
                  {totalPrice} <span className="text-xs font-bold">د.أ</span>
                </p>
              </div>
              <div className="text-left">
                <p className="text-[11px] font-bold text-[var(--bs-text-muted)]">المدة الكلية</p>
                <p className="text-lg font-bold text-[var(--bs-text)]">{totalMins} دقيقة</p>
              </div>
            </div>
          )}

          <WizardNav
            onBack={() => setStep(0)}
            backLabel="تغيير الحلاق"
            onNext={() => {
              if (selectedServices.length > 0) {
                setSelectedDate("");
                setSelectedSlot(null);
                setSlots([]);
                setStep(2);
              }
            }}
            nextLabel="التالي — اختيار الموعد"
            nextDisabled={selectedServices.length === 0}
          />
        </section>
      )}

      {/* ═══════ Step 2: Select Date & Time ═══════ */}
      {step === 2 && selectedBarber && (
        <section className="bs-panel relative overflow-hidden p-6 sm:p-8">
          <span className="bs-ghost-numeral" dir="ltr" aria-hidden="true">03</span>
          <p className="text-[11px] font-bold tracking-[0.25em] text-[var(--bs-primary)]">الخطوة الثالثة</p>
          <h1 className="mt-1 text-2xl font-black text-[var(--bs-text)] sm:text-3xl">اختر اليوم والوقت</h1>
          <p className="mt-2 text-sm text-[var(--bs-text-muted)]">الأوقات محدثة لحظياً حسب جدول {selectedBarber.name}</p>

          {/* date pills */}
          {/* date pills — fast & fluid horizontal strip (bs-hscroll) */}
          <div ref={dateStripRef} className="bs-hscroll mt-6 gap-2 pb-2">
            {next7Days().map((d) => (
              <button
                key={d.iso}
                onClick={() => setSelectedDate(d.iso)}
                className={`shrink-0 rounded-xl border px-4 py-2.5 text-center transition-colors duration-100 ${
                  selectedDate === d.iso
                    ? "border-[var(--bs-primary)] bg-[var(--bs-primary)] text-[var(--bs-on-primary)] shadow-md shadow-[var(--bs-primary)]/25"
                    : "border-[var(--bs-border)] bg-[var(--bs-bg)] text-[var(--bs-text-muted)] hover:border-[var(--bs-primary)]/50"
                }`}
              >
                <p className="text-sm font-bold">{d.label}</p>
                <p className={`mt-0.5 text-[10px] ${selectedDate === d.iso ? "text-[var(--bs-on-primary)]/70" : "text-[var(--bs-text-faint)]"}`}>
                  {d.iso}
                </p>
              </button>
            ))}
          </div>

          {/* time slots */}
          {selectedDate && (
            <div className="mt-5 space-y-3">
              <p className="text-[11px] font-bold tracking-wide text-[var(--bs-text-muted)]">الأوقات المتاحة للحجز:</p>
              {slotsLoading && (
                <div className="py-6">
                  <Spinner size="md" label="جاري فحص وتحديث المواعيد المتاحة…" />
                </div>
              )}
              {!slotsLoading && slots.length === 0 && (
                <div className="py-3 text-center">
                  {isTimeOff ? (
                    <div className="rounded-xl border border-[var(--bs-warning)]/30 bg-[var(--bs-warning-soft)] p-4 space-y-1">
                      <p className="font-bold text-[var(--bs-warning)] text-sm">🏖️ الحلاق في إجازة هذا اليوم</p>
                      {timeOffReason && (
                        <p className="text-xs text-[var(--bs-text-muted)]">السبب: {timeOffReason}</p>
                      )}
                      <p className="pt-1 text-xs text-[var(--bs-text-faint)]">يرجى اختيار يوم آخر.</p>
                    </div>
                  ) : (
                    <p className="py-2 text-sm text-[var(--bs-text-faint)]">لا توجد مواعيد متاحة في هذا اليوم (قد يكون الحلاق في إجازة أو محجوز بالكامل).</p>
                  )}
                </div>
              )}
              {!slotsLoading && slots.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((slot) => (
                    <button
                      key={slot.start_time}
                      onClick={() => setSelectedSlot(slot)}
                      className={`rounded-xl border py-2.5 px-2 text-center text-xs font-semibold transition-all sm:text-sm ${
                        selectedSlot?.start_time === slot.start_time
                          ? "border-[var(--bs-primary)] bg-[var(--bs-primary)] text-[var(--bs-on-primary)] shadow-md shadow-[var(--bs-primary)]/30"
                          : "border-[var(--bs-border)] bg-[var(--bs-bg)] text-[var(--bs-text)] hover:border-[var(--bs-primary)]/50"
                      }`}
                    >
                      {formatTime12(slot.start_time)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <WizardNav
            onBack={() => setStep(1)}
            backLabel="تغيير الخدمات"
            onNext={() => selectedSlot && setStep(3)}
            nextLabel="التالي — تأكيد الحجز"
            nextDisabled={!selectedSlot}
          />
        </section>
      )}

      {/* ═══════ Step 3: Confirm — receipt-style ═══════ */}
      {step === 3 && selectedBarber && selectedSlot && (
        <section className="bs-panel relative overflow-hidden p-6 sm:p-8">
          <span className="bs-ghost-numeral" dir="ltr" aria-hidden="true">04</span>
          <p className="text-[11px] font-bold tracking-[0.25em] text-[var(--bs-primary)]">الخطوة الأخيرة</p>
          <h1 className="mt-1 text-2xl font-black text-[var(--bs-text)] sm:text-3xl">تأكيد تفاصيل الحجز</h1>

          {/* receipt */}
          <div className="mt-6 rounded-2xl border border-dashed border-[var(--bs-border-strong)] bg-[var(--bs-bg)]/50 p-5 sm:p-6">
            <Row label="الحلاق" value={selectedBarber.name} />
            <Row label="التاريخ" value={selectedDate} />
            <Row
              label="الوقت"
              value={`${formatTime12(selectedSlot.start_time)} إلى ${formatTime12(selectedSlot.end_time)}`}
            />
            <Row label="المدة الإجمالية" value={`${totalDuration || totalMins} دقيقة`} />

            <div className="my-4 border-t border-dashed border-[var(--bs-border-strong)]" />

            <p className="mb-2 text-[11px] font-bold tracking-wide text-[var(--bs-text-muted)]">الخدمات المختارة:</p>
            <div className="space-y-1.5">
              {selectedServices.map((s) => (
                <div key={s.id} className="flex justify-between text-sm">
                  <span className="text-[var(--bs-text-muted)]">{s.name}</span>
                  <span className="font-semibold text-[var(--bs-primary)]">{s.price} د.أ</span>
                </div>
              ))}
            </div>

            <div className="my-4 border-t border-dashed border-[var(--bs-border-strong)]" />

            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold text-[var(--bs-text)]">المجموع المطلوب</span>
              <span className="text-3xl font-black text-[var(--bs-primary)]">
                {totalPrice} <span className="text-sm font-bold">د.أ</span>
              </span>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-[var(--bs-primary-soft)]/60 p-3.5 text-center text-xs text-[var(--bs-text-muted)] sm:text-sm">
            <Info className="h-4 w-4 shrink-0 text-[var(--bs-primary)]" />
            <span>يتم تأكيد الحجز مباشرة، والدفع نقداً عند الحضور للصالون.</span>
          </div>

          <WizardNav
            onBack={() => setStep(2)}
            backLabel="تعديل الموعد"
            onNext={handleConfirm}
            nextLabel="تأكيد الحجز الآن"
            nextDisabled={submitting}
            submitting={submitting}
            submitIcon={<Armchair className="h-4 w-4" />}
          />
        </section>
      )}
    </div>
  );
}

/* wizard footer nav — visual helper only */
function WizardNav({
  onBack,
  backLabel,
  onNext,
  nextLabel,
  nextDisabled,
  submitting,
  submitIcon,
}: {
  onBack: () => void;
  backLabel: string;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
  submitting?: boolean;
  submitIcon?: React.ReactNode;
}) {
  return (
    /* Stacked full-width on mobile (long labels like "التالي — تأكيد الحجز"
       never squeeze/clip at 360px+); side-by-side from sm up. RTL: primary
       action renders on top via flex-col-reverse. */
    <div className="mt-8 flex flex-col-reverse gap-3 border-t border-[var(--bs-border)] pt-6 sm:flex-row sm:items-center">
      <Button onClick={onBack} variant="outline" className="w-full sm:w-auto">
        السابق · {backLabel}
      </Button>
      <Button onClick={onNext} disabled={nextDisabled} className="w-full min-w-0 sm:w-auto sm:flex-1">
        {submitting ? (
          <>
            <Spinner size="sm" color="zinc" />
            <span>جاري تأكيد الحجز…</span>
          </>
        ) : (
          <>
            {submitIcon}
            <span className="whitespace-nowrap">{nextLabel}</span>
          </>
        )}
      </Button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 text-sm">
      <span className="text-[var(--bs-text-muted)]">{label}</span>
      <span className="font-medium text-[var(--bs-text)]">{value}</span>
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
