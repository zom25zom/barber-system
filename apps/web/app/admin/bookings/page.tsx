"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { getOwnerToken } from "@/lib/auth";
import { formatTime12, formatDateTime, BOOKING_STATUS_AR, todayDateISO } from "@/lib/time";
import { useLiveNotifications } from "@/lib/useNotifications";
import Spinner from "@/components/Spinner";
import ConfirmModal from "@/components/ConfirmModal";
import { useToast } from "@/components/Toaster";
import type { Booking, OwnerBarber, Customer, Service, Slot } from "@/lib/types";

const statusColor: Record<string, string> = {
  confirmed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  cancelled: "bg-red-500/15 text-red-400 border-red-500/30",
  completed: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  no_show: "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

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

    apiFetch<{ slots: Slot[]; is_time_off?: boolean; reason?: string | null }>(
      `/api/barbers/${manualBarberId}/availability?date=${manualDate}&serviceIds=${ids}&clientTime=${clientTime}`
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

      {/* ── Manual Booking Modal ── */}
      {manualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div
            className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm transition-opacity"
            onClick={() => {
              if (!manualSubmitting) setManualModalOpen(false);
            }}
          />

          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-zinc-800 bg-zinc-900 p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-amber-400 flex items-center gap-2">
                  <span>✂️</span> إضافة حجز يدوي مباشر
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  تسجيل حجز مباشر من الصالون مع التحقق التلقائي من توفر الوقت والتعارضات.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManualModalOpen(false)}
                className="rounded-xl border border-zinc-800 bg-zinc-950 p-2 text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {manualError && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3.5 text-xs sm:text-sm text-red-400 flex items-center gap-2">
                <span>⚠️</span>
                <span>{manualError}</span>
              </div>
            )}

            <form onSubmit={handleCreateManualBooking} className="space-y-6">
              {/* Section 1: Customer Selection */}
              <div className="space-y-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-zinc-200">1. بيانات الزبون</label>
                  <div className="flex rounded-xl border border-zinc-800 bg-zinc-900 p-1 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerMode("existing");
                        setManualError(null);
                      }}
                      className={`rounded-lg px-3 py-1 font-semibold transition ${
                        customerMode === "existing"
                          ? "bg-amber-500 text-zinc-950 font-bold"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      🔍 زبون مسجل
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
                          ? "bg-amber-500 text-zinc-950 font-bold"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      👤 زبون جديد
                    </button>
                  </div>
                </div>

                {customerMode === "existing" ? (
                  <div className="space-y-2">
                    {selectedCustomer ? (
                      <div className="flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">✅</span>
                          <div>
                            <p className="font-bold text-emerald-400">{selectedCustomer.username}</p>
                            <p className="text-xs text-zinc-400" dir="ltr">{selectedCustomer.phone}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedCustomer(null)}
                          className="text-xs font-semibold text-zinc-400 hover:text-red-400"
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
                          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-500"
                        />
                        <div className="max-h-36 overflow-y-auto space-y-1 rounded-xl border border-zinc-800 bg-zinc-950/80 p-2">
                          {searchingCustomers && (
                            <p className="text-xs text-zinc-500 text-center py-2">جاري البحث…</p>
                          )}
                          {!searchingCustomers && customerResults.length === 0 && (
                            <p className="text-xs text-zinc-500 text-center py-2">
                              لا يوجد زبائن مطابقين. يمكنك التبديل إلى &quot;زبون جديد&quot; بالأعلى.
                            </p>
                          )}
                          {customerResults.map((c) => (
                            <div
                              key={c.id}
                              onClick={() => setSelectedCustomer(c)}
                              className="flex items-center justify-between rounded-lg px-3 py-2 text-xs sm:text-sm hover:bg-zinc-800/80 cursor-pointer transition"
                            >
                              <span className="font-semibold text-zinc-200">{c.username}</span>
                              <span className="text-zinc-400 font-mono" dir="ltr">{c.phone}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-zinc-400">اسم الزبون *</label>
                      <input
                        type="text"
                        required={customerMode === "new"}
                        value={newCustomerName}
                        onChange={(e) => setNewCustomerName(e.target.value)}
                        placeholder="مثال: أحمد خالد"
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-zinc-400">رقم الهاتف *</label>
                      <input
                        type="tel"
                        dir="ltr"
                        required={customerMode === "new"}
                        value={newCustomerPhone}
                        onChange={(e) => setNewCustomerPhone(e.target.value)}
                        placeholder="0790000000"
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-sm text-left text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2: Barber Selection */}
              <div className="space-y-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-4">
                <label className="block text-sm font-bold text-zinc-200">2. اختيار الحلاق</label>
                <select
                  value={manualBarberId}
                  onChange={(e) => setManualBarberId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-amber-500"
                >
                  {barbers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Section 3: Services Selection */}
              <div className="space-y-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-zinc-200">3. اختيار الخدمات</label>
                  {selectedServiceIds.length > 0 && (
                    <span className="text-xs text-amber-400 font-bold">
                      {manualTotalPrice} د.أ ({manualTotalDuration} دقيقة)
                    </span>
                  )}
                </div>

                {barberServices.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-2">لا توجد خدمات مسجلة لهذا الحلاق.</p>
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
                              ? "border-amber-500 bg-amber-500/10 text-amber-300"
                              : "border-zinc-800 bg-zinc-950 hover:border-zinc-700 text-zinc-300"
                          }`}
                        >
                          <div>
                            <p className="text-xs sm:text-sm font-bold">{svc.name}</p>
                            <p className="text-[11px] text-zinc-400">{svc.duration_minutes} دقيقة</p>
                          </div>
                          <span className="text-xs font-bold font-mono">{svc.price} د.أ</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Section 4: Date & Available Slots */}
              <div className="space-y-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-4">
                <label className="block text-sm font-bold text-zinc-200">4. التاريخ والأوقات المتاحة</label>
                <input
                  type="date"
                  min={todayDateISO()}
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-amber-500"
                />

                {manualSlotsLoading && (
                  <div className="py-4 text-center">
                    <Spinner size="sm" label="جاري فحص المواعيد المتاحة والتعارضات…" />
                  </div>
                )}

                {!manualSlotsLoading && manualIsTimeOff && (
                  <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-xs text-orange-400">
                    ⚠️ الحلاق في إجازة خاصة بهذا اليوم{manualTimeOffReason ? ` (${manualTimeOffReason})` : ""}.
                  </div>
                )}

                {!manualSlotsLoading && !manualIsTimeOff && selectedServiceIds.length > 0 && manualSlots.length === 0 && (
                  <p className="text-xs text-zinc-500 py-2 text-center">
                    لا توجد فترات عمل متاحة بهذا اليوم (عطلة أو محجوز بالكامل).
                  </p>
                )}

                {!manualSlotsLoading && manualSlots.length > 0 && (
                  <div>
                    <p className="text-xs text-zinc-400 mb-2">اختر الفترة المناسبة:</p>
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
                                ? "border-amber-500 bg-amber-500 text-zinc-950 shadow-md scale-105"
                                : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700"
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
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  disabled={manualSubmitting}
                  onClick={() => setManualModalOpen(false)}
                  className="rounded-xl border border-zinc-700 bg-zinc-800/60 px-5 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition disabled:opacity-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={manualSubmitting || !selectedSlot || selectedServiceIds.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-7 py-2.5 text-sm font-bold text-zinc-950 hover:bg-amber-400 active:scale-95 transition shadow-lg disabled:opacity-50"
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-100">إدارة ومتابعة الحجوزات</h1>
        <button
          type="button"
          onClick={openManualBooking}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-zinc-950 hover:bg-amber-400 shadow-md shadow-amber-500/20 active:scale-95 transition"
        >
          <span>✂️</span>
          <span>+ إضافة حجز يدوي</span>
        </button>
      </div>

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
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-zinc-100 text-base">
                    {b.customer_name}
                  </p>
                  {b.customer_phone && (
                    <a
                      href={`tel:${b.customer_phone}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition active:scale-95 shadow-sm"
                      title="اتصال مباشر بالعميل"
                      dir="ltr"
                    >
                      <span>📞</span>
                      <span>{b.customer_phone}</span>
                    </a>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-zinc-300 mt-1">
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
                {b.customer_phone && (
                  <a
                    href={`tel:${b.customer_phone}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition"
                    title="اتصال هاتفي مباشر بالعميل"
                  >
                    <span>📞</span>
                    <span>اتصال</span>
                  </a>
                )}
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
