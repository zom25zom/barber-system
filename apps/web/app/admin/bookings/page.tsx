"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { getOwnerToken } from "@/lib/auth";
import { formatTime12, formatDateTime, BOOKING_STATUS_AR, todayDateISO } from "@/lib/time";
import { useLiveNotifications } from "@/lib/useNotifications";
import Spinner from "@/components/Spinner";
import ConfirmModal from "@/components/ConfirmModal";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { AlertTriangle, CalendarDays, CheckCircle2, CircleCheck, Clock, Phone, Scissors, Search, User, UserRoundPlus } from "lucide-react";
import { useToast } from "@/components/Toaster";
import type { Booking, OwnerBarber, Customer, Service, Slot } from "@/lib/types";

export default function AdminBookingsPage() {
  const token = getOwnerToken();
  const toast = useToast();
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

  // Manual Booking Modal State
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  const [manualBarberId, setManualBarberId] = useState<string>("");
  const [barberServices, setBarberServices] = useState<Service[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
  const [manualDate, setManualDate] = useState<string>(todayDateISO());
  const [manualSlots, setManualSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [manualSlotsLoading, setManualSlotsLoading] = useState(false);
  const [manualIsTimeOff, setManualIsTimeOff] = useState(false);
  const [manualTimeOffReason, setManualTimeOffReason] = useState<string | null>(null);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

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

  // Search existing customers
  useEffect(() => {
    if (!token || !manualModalOpen || customerMode !== "existing") return;
    setSearchingCustomers(true);
    const q = customerSearch.trim();
    const qs = q ? `?q=${encodeURIComponent(q)}` : "";
    apiFetch<{ customers: Customer[] }>(`/api/owner/customers${qs}`, { token })
      .then((d) => setCustomerResults(d.customers))
      .catch(() => setCustomerResults([]))
      .finally(() => setSearchingCustomers(false));
  }, [token, manualModalOpen, customerMode, customerSearch]);

  // Load services when manualBarberId changes
  useEffect(() => {
    if (!token || !manualBarberId) {
      setBarberServices([]);
      setSelectedServiceIds([]);
      return;
    }
    apiFetch<{ services: Service[] }>(`/api/owner/barbers/${manualBarberId}/services`, { token })
      .then((d) => {
        setBarberServices(d.services);
        setSelectedServiceIds([]);
      })
      .catch(() => setBarberServices([]));
  }, [token, manualBarberId]);

  // Load slots when barber + services + date are selected
  useEffect(() => {
    if (!manualBarberId || !manualDate || selectedServiceIds.length === 0) {
      setManualSlots([]);
      setSelectedSlot(null);
      return;
    }

    setManualSlotsLoading(true);
    setSelectedSlot(null);
    setManualIsTimeOff(false);
    setManualTimeOffReason(null);

    const ids = selectedServiceIds.join(",");
    const now = new Date();
    const currentHH = String(now.getHours()).padStart(2, "0");
    const currentMM = String(now.getMinutes()).padStart(2, "0");
    const clientTime = `${currentHH}:${currentMM}`;

    // Session-scoped availability — the tenant is derived from the owner token
    // server-side (NOT from slug/host/DEFAULT_SALON_ID like the public endpoint).
    apiFetch<{ slots: Slot[]; is_time_off?: boolean; reason?: string | null }>(
      `/api/owner/barbers/${manualBarberId}/availability?date=${manualDate}&serviceIds=${ids}&clientTime=${clientTime}`,
      { token }
    )
      .then((d) => {
        setManualSlots(d.slots || []);
        if (d.is_time_off) {
          setManualIsTimeOff(true);
          setManualTimeOffReason(d.reason ?? null);
        }
      })
      .catch(() => setManualSlots([]))
      .finally(() => setManualSlotsLoading(false));
  }, [manualBarberId, manualDate, selectedServiceIds]);

  function openManualBooking() {
    setManualModalOpen(true);
    setCustomerMode("existing");
    setCustomerSearch("");
    setSelectedCustomer(null);
    setNewCustomerName("");
    setNewCustomerPhone("");
    setManualBarberId(barbers.length > 0 ? String(barbers[0].id) : "");
    setSelectedServiceIds([]);
    setManualDate(todayDateISO());
    setSelectedSlot(null);
    setManualError(null);
  }

  function toggleService(serviceId: number) {
    setSelectedServiceIds((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    );
  }

  async function handleCreateManualBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;

    if (customerMode === "existing" && !selectedCustomer) {
      setManualError("يرجى اختيار زبون مسجل من القائمة أو التبديل لإنشاء زبون جديد");
      return;
    }
    if (customerMode === "new") {
      if (!newCustomerName.trim()) {
        setManualError("يرجى إدخال اسم الزبون");
        return;
      }
      if (!newCustomerPhone.trim()) {
        setManualError("يرجى إدخال رقم هاتف الزبون");
        return;
      }
    }

    if (!manualBarberId) {
      setManualError("يرجى اختيار الحلاق");
      return;
    }

    if (selectedServiceIds.length === 0) {
      setManualError("يرجى اختيار خدمة واحدة على الأقل");
      return;
    }

    if (!manualDate) {
      setManualError("يرجى تحديد تاريخ الحجز");
      return;
    }

    if (!selectedSlot) {
      setManualError("يرجى اختيار فترة الموعد والوقت المناسب");
      return;
    }

    setManualSubmitting(true);
    setManualError(null);

    try {
      await apiFetch("/api/owner/bookings", {
        method: "POST",
        token,
        body: {
          customer_id: customerMode === "existing" ? selectedCustomer?.id : undefined,
          customer_name: customerMode === "new" ? newCustomerName.trim() : undefined,
          customer_phone: customerMode === "new" ? newCustomerPhone.trim() : undefined,
          barber_id: Number(manualBarberId),
          service_ids: selectedServiceIds,
          date: manualDate,
          start_time: selectedSlot.start_time,
        },
      });

      setManualModalOpen(false);
      toast.success("تمت إضافة الحجز اليدوي وتأكيده بنجاح ✓");
      load();
    } catch (err) {
      const msg = (err as Error).message || "حدث خطأ أثناء إضافة الحجز";
      setManualError(msg);
      toast.error(msg);
    } finally {
      setManualSubmitting(false);
    }
  }

  const selectedServicesList = barberServices.filter((s) => selectedServiceIds.includes(s.id));
  const manualTotalPrice = selectedServicesList.reduce((sum, s) => sum + s.price, 0);
  const manualTotalDuration = selectedServicesList.reduce((sum, s) => sum + s.duration_minutes, 0);

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
      toast.success("تم إلغاء الحجز بنجاح وإشعار الزبون ✓");
      load();
    } catch (err) {
      const msg = (err as Error).message || "حدث خطأ أثناء إلغاء الحجز";
      setError(msg);
      toast.error(msg);
    } finally {
      setCancelling(false);
    }
  }

  async function markNoShow(id: number) {
    if (!token) return;
    setActionLoadingId(id);
    try {
      await apiFetch(`/api/owner/bookings/${id}/no-show`, { method: "POST", token });
      toast.warning("تم تسجيل حالة عدم الحضور (No-Show)");
      load();
    } catch (err) {
      const msg = (err as Error).message || "حدث خطأ أثناء تعديل حالة الحجز";
      setError(msg);
      toast.error(msg);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function markComplete(id: number) {
    if (!token) return;
    setActionLoadingId(id);
    try {
      await apiFetch(`/api/owner/bookings/${id}/complete`, { method: "POST", token });
      toast.success("تم تحديد الحجز كمكتمل بنجاح ✓");
      load();
    } catch (err) {
      const msg = (err as Error).message || "حدث خطأ أثناء إكمال الحجز";
      setError(msg);
      toast.error(msg);
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <div className="bs-skin space-y-10">
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

      {/* ── Manual Booking Modal ── */}
      {manualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div
            className="fixed inset-0 bg-[var(--bs-bg)]/80 backdrop-blur-sm transition-opacity"
            onClick={() => {
              if (!manualSubmitting) setManualModalOpen(false);
            }}
          />

          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[var(--bs-border)] bg-[var(--bs-surface)] p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--bs-border)] pb-4">
              <div>
                <p className="text-[11px] font-bold tracking-[0.25em] text-[var(--bs-primary)]">من داخل الصالون</p>
                <h2 className="mt-1 text-xl font-black text-[var(--bs-text)]">إضافة حجز يدوي مباشر</h2>
                <p className="text-xs text-[var(--bs-text-muted)] mt-1">
                  تسجيل حجز مباشر من الصالون مع التحقق التلقائي من توفر الوقت والتعارضات.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManualModalOpen(false)}
                aria-label="إغلاق"
                className="rounded-xl border border-[var(--bs-border)] bg-[var(--bs-bg)] p-2 text-[var(--bs-text-muted)] transition hover:text-[var(--bs-text)]"
              >
                ✕
              </button>
            </div>

            {manualError && (
              <div className="rounded-xl border border-[var(--bs-error)]/40 bg-[var(--bs-error-soft)] p-3.5 text-xs sm:text-sm text-[var(--bs-error)] flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{manualError}</span>
              </div>
            )}

            <form onSubmit={handleCreateManualBooking} className="space-y-6">
              {/* Section 1: Customer Selection */}
              <div className="space-y-3 rounded-2xl bg-[var(--bs-bg)]/50 p-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-[var(--bs-text)]">
                    <span className="ml-2 text-[11px] font-black tracking-widest text-[var(--bs-primary)]" dir="ltr">01</span>
                    بيانات الزبون
                  </label>
                  <div className="flex rounded-xl border border-[var(--bs-border)] bg-[var(--bs-surface)] p-1 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerMode("existing");
                        setManualError(null);
                      }}
                      className={`rounded-lg px-3 py-1 font-semibold transition ${
                        customerMode === "existing"
                          ? "bg-[var(--bs-primary)] text-[var(--bs-on-primary)] font-bold"
                          : "text-[var(--bs-text-muted)] hover:text-[var(--bs-text)]"
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5"><Search className="h-3.5 w-3.5" aria-hidden="true" /> زبون مسجل</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerMode("new");
                        setSelectedCustomer(null);
                        setManualError(null);
                      }}
                      className={`rounded-lg px-3 py-1 font-semibold transition ${
                        customerMode === "new"
                          ? "bg-[var(--bs-primary)] text-[var(--bs-on-primary)] font-bold"
                          : "text-[var(--bs-text-muted)] hover:text-[var(--bs-text)]"
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5"><UserRoundPlus className="h-3.5 w-3.5" aria-hidden="true" /> زبون جديد</span>
                    </button>
                  </div>
                </div>

                {customerMode === "existing" ? (
                  <div className="space-y-2">
                    {selectedCustomer ? (
                      <div className="flex items-center justify-between rounded-xl border border-[var(--bs-success)]/40 bg-[var(--bs-success-soft)] px-4 py-2.5 text-sm">
                        <div className="flex items-center gap-2">
                          <CircleCheck className="h-5 w-5 text-[var(--bs-success)]" aria-hidden="true" />
                          <div>
                            <p className="font-bold text-[var(--bs-success)]">{selectedCustomer.username}</p>
                            <p className="text-xs text-[var(--bs-text-muted)]" dir="ltr">{selectedCustomer.phone}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedCustomer(null)}
                          className="text-xs font-semibold text-[var(--bs-text-muted)] hover:text-[var(--bs-error)]"
                        >
                          تغيير ✕
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                          placeholder="ابحث بالاسم أو رقم الهاتف…"
                          className="w-full rounded-xl border border-[var(--bs-border-strong)] bg-[var(--bs-bg)] px-4 py-2.5 text-sm text-[var(--bs-text)] placeholder:text-[var(--bs-text-faint)] outline-none focus:border-[var(--bs-primary)]"
                        />
                        <div className="max-h-36 overflow-y-auto space-y-1 rounded-xl border border-[var(--bs-border)] bg-[var(--bs-bg)]/80 p-2">
                          {searchingCustomers && (
                            <p className="text-xs text-[var(--bs-text-faint)] text-center py-2">جاري البحث…</p>
                          )}
                          {!searchingCustomers && customerResults.length === 0 && (
                            <p className="text-xs text-[var(--bs-text-faint)] text-center py-2">
                              لا يوجد زبائن مطابقين. يمكنك التبديل إلى &quot;زبون جديد&quot; بالأعلى.
                            </p>
                          )}
                          {customerResults.map((c) => (
                            <div
                              key={c.id}
                              onClick={() => setSelectedCustomer(c)}
                              className="flex items-center justify-between rounded-lg px-3 py-2 text-xs sm:text-sm hover:bg-[var(--bs-surface-raised)] cursor-pointer transition"
                            >
                              <span className="font-semibold text-[var(--bs-text)]">{c.username}</span>
                              <span className="text-[var(--bs-text-muted)] font-mono" dir="ltr">{c.phone}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-[var(--bs-text-muted)]">اسم الزبون *</label>
                      <input
                        type="text"
                        required={customerMode === "new"}
                        value={newCustomerName}
                        onChange={(e) => setNewCustomerName(e.target.value)}
                        placeholder="مثال: أحمد خالد"
                        className="w-full rounded-xl border border-[var(--bs-border-strong)] bg-[var(--bs-bg)] px-3.5 py-2 text-sm text-[var(--bs-text)] placeholder:text-[var(--bs-text-faint)] outline-none focus:border-[var(--bs-primary)]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-[var(--bs-text-muted)]">رقم الهاتف *</label>
                      <input
                        type="tel"
                        dir="ltr"
                        required={customerMode === "new"}
                        value={newCustomerPhone}
                        onChange={(e) => setNewCustomerPhone(e.target.value)}
                        placeholder="0790000000"
                        className="w-full rounded-xl border border-[var(--bs-border-strong)] bg-[var(--bs-bg)] px-3.5 py-2 text-sm text-left text-[var(--bs-text)] placeholder:text-[var(--bs-text-faint)] outline-none focus:border-[var(--bs-primary)]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2: Barber Selection */}
              <div className="space-y-3 rounded-2xl bg-[var(--bs-bg)]/50 p-4">
                <label className="block text-sm font-bold text-[var(--bs-text)]">
                  <span className="ml-2 text-[11px] font-black tracking-widest text-[var(--bs-primary)]" dir="ltr">02</span>
                  اختيار الحلاق
                </label>
                <select
                  value={manualBarberId}
                  onChange={(e) => setManualBarberId(e.target.value)}
                  className="w-full rounded-xl border border-[var(--bs-border-strong)] bg-[var(--bs-bg)] px-4 py-2.5 text-sm text-[var(--bs-text)] outline-none focus:border-[var(--bs-primary)]"
                >
                  {barbers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Section 3: Services Selection */}
              <div className="space-y-3 rounded-2xl bg-[var(--bs-bg)]/50 p-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-[var(--bs-text)]">
                    <span className="ml-2 text-[11px] font-black tracking-widest text-[var(--bs-primary)]" dir="ltr">03</span>
                    اختيار الخدمات
                  </label>
                  {selectedServiceIds.length > 0 && (
                    <span className="text-xs text-[var(--bs-primary)] font-bold">
                      {manualTotalPrice} د.أ ({manualTotalDuration} دقيقة)
                    </span>
                  )}
                </div>

                {barberServices.length === 0 ? (
                  <p className="text-xs text-[var(--bs-text-faint)] py-2">لا توجد خدمات مسجلة لهذا الحلاق.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 max-h-40 overflow-y-auto">
                    {barberServices.map((svc) => {
                      const isSelected = selectedServiceIds.includes(svc.id);
                      return (
                        <div
                          key={svc.id}
                          onClick={() => toggleService(svc.id)}
                          className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer transition ${
                            isSelected
                              ? "border-[var(--bs-primary)] bg-[var(--bs-primary-soft)] text-[var(--bs-primary)]"
                              : "border-[var(--bs-border)] bg-[var(--bs-bg)] hover:border-[var(--bs-border-strong)] text-[var(--bs-text-muted)]"
                          }`}
                        >
                          <div>
                            <p className="text-xs sm:text-sm font-bold">{svc.name}</p>
                            <p className="text-[11px] text-[var(--bs-text-muted)]">{svc.duration_minutes} دقيقة</p>
                          </div>
                          <span className="text-xs font-bold font-mono">{svc.price} د.أ</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Section 4: Date & Available Slots */}
              <div className="space-y-3 rounded-2xl bg-[var(--bs-bg)]/50 p-4">
                <label className="block text-sm font-bold text-[var(--bs-text)]">
                  <span className="ml-2 text-[11px] font-black tracking-widest text-[var(--bs-primary)]" dir="ltr">04</span>
                  التاريخ والأوقات المتاحة
                </label>
                <input
                  type="date"
                  min={todayDateISO()}
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="w-full rounded-xl border border-[var(--bs-border-strong)] bg-[var(--bs-bg)] px-4 py-2.5 text-sm text-[var(--bs-text)] outline-none focus:border-[var(--bs-primary)]"
                />

                {manualSlotsLoading && (
                  <div className="py-4 text-center">
                    <Spinner size="sm" label="جاري فحص المواعيد المتاحة والتعارضات…" />
                  </div>
                )}

                {!manualSlotsLoading && manualIsTimeOff && (
                  <div className="rounded-xl border border-[var(--bs-warning)]/40 bg-[var(--bs-warning-soft)] p-3 text-xs text-[var(--bs-warning)]">
                    <span className="inline-flex items-start gap-1.5">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>الحلاق في إجازة خاصة بهذا اليوم{manualTimeOffReason ? ` (${manualTimeOffReason})` : ""}.</span>
                    </span>
                  </div>
                )}

                {!manualSlotsLoading && !manualIsTimeOff && selectedServiceIds.length > 0 && manualSlots.length === 0 && (
                  <p className="text-xs text-[var(--bs-text-faint)] py-2 text-center">
                    لا تتوفر مواعيد في هذا اليوم حالياً — جرّب اختيار تاريخ آخر.
                  </p>
                )}

                {!manualSlotsLoading && manualSlots.length > 0 && (
                  <div>
                    <p className="text-xs text-[var(--bs-text-muted)] mb-2">اختر الفترة المناسبة:</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-36 overflow-y-auto">
                      {manualSlots.map((s, idx) => {
                        const isSel = selectedSlot?.start_time === s.start_time;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setSelectedSlot(s)}
                            className={`rounded-xl border py-2 text-xs font-bold transition ${
                              isSel
                                ? "border-[var(--bs-primary)] bg-[var(--bs-primary)] text-[var(--bs-on-primary)] shadow-md scale-105"
                                : "border-[var(--bs-border)] bg-[var(--bs-bg)] text-[var(--bs-text-muted)] hover:border-[var(--bs-border-strong)]"
                            }`}
                          >
                            {formatTime12(s.start_time)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--bs-border)]">
                <button
                  type="button"
                  disabled={manualSubmitting}
                  onClick={() => setManualModalOpen(false)}
                  className="rounded-xl border border-[var(--bs-border-strong)] bg-[var(--bs-surface-raised)]/60 px-5 py-2.5 text-sm font-medium text-[var(--bs-text-muted)] hover:bg-[var(--bs-surface-raised)] hover:text-[var(--bs-text)] transition disabled:opacity-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={manualSubmitting || !selectedSlot || selectedServiceIds.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--bs-primary)] px-7 py-2.5 text-sm font-bold text-[var(--bs-on-primary)] hover:bg-[var(--bs-primary-strong)] active:scale-95 transition shadow-lg disabled:opacity-50"
                >
                  {manualSubmitting ? (
                    <>
                      <Spinner size="sm" color="zinc" />
                      <span>جاري حفظ الحجز…</span>
                    </>
                  ) : (
                    "✓ حفظ وتأكيد الحجز"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-2.5 text-[11px] font-bold tracking-[0.25em] text-[var(--bs-primary)]">
            <span className="inline-block h-px w-8 bg-[var(--bs-primary)]/60" />
            سجل العمليات
          </p>
          <h1 className="text-2xl font-black text-[var(--bs-text)] sm:text-3xl">إدارة ومتابعة الحجوزات</h1>
        </div>
        <button
          type="button"
          onClick={openManualBooking}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--bs-primary)] px-5 py-2.5 text-sm font-bold text-[var(--bs-on-primary)] hover:bg-[var(--bs-primary-strong)] shadow-md shadow-[var(--bs-primary)]/20 active:scale-95 transition"
        >
          <Scissors className="h-4 w-4" aria-hidden="true" />
          <span>+ إضافة حجز يدوي</span>
        </button>
      </header>

      {/* ── filters — borderless quiet bar ── */}
      <div className="-mt-4 flex flex-wrap items-end gap-4 rounded-2xl bg-[var(--bs-surface)]/50 p-4">
        <div>
          <label className="mb-1 block text-xs text-[var(--bs-text-muted)] font-medium">الحلاق</label>
          <select
            value={filterBarber}
            onChange={(e) => setFilterBarber(e.target.value)}
            className="rounded-xl border border-[var(--bs-border-strong)] bg-[var(--bs-bg)] px-3 py-2 text-sm text-[var(--bs-text)] outline-none focus:border-[var(--bs-primary)]"
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
          <label className="mb-1 block text-xs text-[var(--bs-text-muted)] font-medium">الحالة</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl border border-[var(--bs-border-strong)] bg-[var(--bs-bg)] px-3 py-2 text-sm text-[var(--bs-text)] outline-none focus:border-[var(--bs-primary)]"
          >
            <option value="">جميع الحالات</option>
            <option value="confirmed">مؤكد</option>
            <option value="cancelled">ملغي</option>
            <option value="completed">مكتمل</option>
            <option value="no_show">لم يحضر</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--bs-text-muted)] font-medium">التاريخ</label>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="rounded-xl border border-[var(--bs-border-strong)] bg-[var(--bs-bg)] px-3 py-2 text-sm text-[var(--bs-text)] outline-none focus:border-[var(--bs-primary)]"
          />
        </div>
        {(filterBarber || filterStatus || filterDate) && (
          <button
            onClick={() => {
              setFilterBarber("");
              setFilterStatus("");
              setFilterDate("");
            }}
            className="self-end rounded-xl border border-[var(--bs-border-strong)] px-3.5 py-2 text-xs font-semibold text-[var(--bs-text-muted)] hover:bg-[var(--bs-surface-raised)] hover:text-[var(--bs-text)] transition"
          >
            مسح الفلاتر ✕
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-[var(--bs-error)]/40 bg-[var(--bs-error-soft)] p-4 text-sm text-[var(--bs-error)] flex items-center justify-between">
          <AlertTriangle className="h-4 w-4 shrink-0 self-center" aria-hidden="true" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-xs text-[var(--bs-error)] hover:underline">
            إغلاق
          </button>
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-[var(--bs-border)] bg-[var(--bs-surface)]/50 p-12 text-center">
          <Spinner size="lg" label="جاري تحميل الحجوزات…" />
        </div>
      )}

      {/* ── bookings table ── */}
      {!loading && bookings.length === 0 && (
        <div className="rounded-2xl bg-[var(--bs-surface)]/40 p-10 text-center text-[var(--bs-text-muted)]">
          لا توجد حجوزات تطابق الفلاتر المحددة.
        </div>
      )}

      {/* ── bookings ledger — professional detail cards ── */}
      {!loading && bookings.length > 0 && (
        <div className="space-y-4">
          {bookings.map((b) => (
            <Card key={b.id} className="overflow-hidden transition-shadow hover:shadow-xl">
              {/* ── header: customer + status + summary sentence ── */}
              <CardHeader className="gap-2 border-b border-[var(--bs-border)] bg-[var(--bs-surface-raised)]/50">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <h3 className="flex min-w-0 items-center gap-2.5 text-lg font-black text-[var(--bs-text)]">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--bs-primary)]/30 bg-[var(--bs-primary-soft)]" aria-hidden="true">
                      <User className="h-4 w-4 text-[var(--bs-primary)]" />
                    </span>
                    <span className="truncate">{b.customer_name || "زبون"}</span>
                  </h3>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
                      b.status === "confirmed"
                        ? "border-[var(--bs-primary)]/40 bg-[var(--bs-primary-soft)] text-[var(--bs-primary)]"
                        : b.status === "completed"
                          ? "border-[var(--bs-success)]/40 bg-[var(--bs-success-soft)] text-[var(--bs-success)]"
                          : b.status === "no_show"
                            ? "border-[var(--bs-warning)]/40 bg-[var(--bs-warning-soft)] text-[var(--bs-warning)]"
                            : "border-[var(--bs-border-strong)] bg-transparent text-[var(--bs-text-muted)]"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        b.status === "confirmed"
                          ? "bg-[var(--bs-primary)]"
                          : b.status === "completed"
                            ? "bg-[var(--bs-success)]"
                            : b.status === "no_show"
                              ? "bg-[var(--bs-warning)]"
                              : "bg-[var(--bs-text-faint)]"
                      }`}
                    />
                    {BOOKING_STATUS_AR[b.status] ?? b.status}
                  </span>
                </div>
                {/* narrative summary line */}
                <p className="text-sm text-[var(--bs-text-muted)]">
                  قام الزبون <span className="font-bold text-[var(--bs-text)]">{b.customer_name || "زبون"}</span> بحجز موعد مع الحلاق{" "}
                  <span className="font-bold text-[var(--bs-primary)]">{b.barber_name}</span>
                </p>
              </CardHeader>

              {/* ── details: grouped grid (stacked on mobile, 3-col on desktop) ── */}
              <CardContent className="grid gap-4 py-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* date & time */}
                <div>
                  <p className="text-[10px] font-bold tracking-[0.25em] text-[var(--bs-text-faint)]">الموعد</p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-sm font-bold text-[var(--bs-text)]">
                    <CalendarDays className="h-4 w-4 text-[var(--bs-text-faint)]" aria-hidden="true" />
                    {b.booking_date}
                  </p>
                  <p className="mt-0.5 text-sm text-[var(--bs-text-muted)]">
                    <Clock className="mr-1 inline h-3.5 w-3.5 align-[-2px] text-[var(--bs-text-faint)]" aria-hidden="true" />
                    {formatTime12(b.start_time)} — {formatTime12(b.end_time)}
                  </p>
                </div>

                {/* services */}
                <div>
                  <p className="text-[10px] font-bold tracking-[0.25em] text-[var(--bs-text-faint)]">الخدمات</p>
                  {b.services?.length > 0 ? (
                    <ul className="mt-1.5 space-y-1">
                      {b.services.map((s, i) => (
                        <li key={i} className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="inline-flex items-center gap-1 text-[var(--bs-text)]">
                            <Scissors className="h-3 w-3 text-[var(--bs-text-faint)]" aria-hidden="true" />
                            {s.name}
                          </span>
                          <span className="shrink-0 tabular-nums text-[var(--bs-text-muted)]">{s.price} د.أ</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1.5 text-sm text-[var(--bs-text-muted)]">—</p>
                  )}
                </div>

                {/* phone + creation timestamp */}
                <div>
                  <p className="text-[10px] font-bold tracking-[0.25em] text-[var(--bs-text-faint)]">التواصل والسجل</p>
                  {b.customer_phone && (
                    <a
                      href={`tel:${b.customer_phone}`}
                      className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-[var(--bs-success)]/30 bg-[var(--bs-success-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--bs-success)] transition hover:brightness-110 active:scale-95"
                      title="اتصال هاتفي مباشر بالعميل"
                      dir="ltr"
                    >
                      <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{b.customer_phone}</span>
                    </a>
                  )}
                  {b.created_at && (
                    <p className="mt-1.5 text-[11px] text-[var(--bs-text-faint)]">
                      أُنشئ الحجز: {formatDateTime(b.created_at)}
                    </p>
                  )}
                </div>
              </CardContent>

              {/* ── footer: total + actions row ── */}
              <CardFooter className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-[var(--bs-border)] bg-[var(--bs-surface-raised)]/30 py-3.5">
                <p className="text-base font-black tabular-nums text-[var(--bs-text)]">
                  الإجمالي: <span className="text-lg text-[var(--bs-primary)]">{b.total_price} د.أ</span>
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {b.customer_phone && (
                    <a
                      href={`tel:${b.customer_phone}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--bs-success)]/40 bg-[var(--bs-success-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--bs-success)] transition hover:brightness-110 active:scale-95"
                      title="اتصال هاتفي مباشر بالعميل"
                    >
                      <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>اتصال</span>
                    </a>
                  )}
                  {b.status === "confirmed" && (
                    <>
                      <button
                        onClick={() => markComplete(b.id)}
                        disabled={actionLoadingId === b.id}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--bs-success)]/40 bg-[var(--bs-success-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--bs-success)] transition hover:brightness-110 active:scale-95 disabled:opacity-50"
                      >
                        {actionLoadingId === b.id ? <Spinner size="sm" color="zinc" /> : "✓ مكتمل"}
                      </button>
                      <button
                        onClick={() => markNoShow(b.id)}
                        disabled={actionLoadingId === b.id}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--bs-warning)]/40 bg-[var(--bs-warning-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--bs-warning)] transition hover:brightness-110 active:scale-95 disabled:opacity-50"
                      >
                        {actionLoadingId === b.id ? <Spinner size="sm" color="zinc" /> : "لم يحضر"}
                      </button>
                      <button
                        onClick={() => triggerCancel(b)}
                        disabled={actionLoadingId === b.id}
                        className="rounded-xl border border-[var(--bs-error)]/40 bg-[var(--bs-error-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--bs-error)] transition hover:brightness-110 active:scale-95 disabled:opacity-50"
                      >
                        إلغاء
                      </button>
                    </>
                  )}
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
