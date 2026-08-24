export const WEEKDAYS_AR = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

/** "13:30" -> "01:30 م" */
export function formatTime12(t: string): string {
  const [hRaw, mRaw] = t.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (Number.isNaN(h) || Number.isNaN(m)) return t;
  const period = h < 12 ? "ص" : "م";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
}

/** Local date -> "YYYY-MM-DD" */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type DayOption = { iso: string; weekday: string; label: string };

/** Today + the next 6 days, with Arabic weekday names. */
export function next7Days(): DayOption[] {
  const days: DayOption[] = [];
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    days.push({
      iso: toISODate(d),
      weekday: WEEKDAYS_AR[d.getDay()],
      label: i === 0 ? "اليوم" : i === 1 ? "غداً" : WEEKDAYS_AR[d.getDay()],
    });
  }
  return days;
}

/** "10:30" + 45 -> "11:15" */
export function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + mins;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export const BOOKING_STATUS_AR: Record<string, string> = {
  confirmed: "مؤكد",
  cancelled: "ملغي",
  completed: "مكتمل",
  no_show: "لم يحضر",
};

export const WAITLIST_STATUS_AR: Record<string, string> = {
  waiting: "بانتظار",
  notified: "متاح الآن — احجز!",
  fulfilled: "تم الحجز",
  cancelled: "ملغي",
};

/** SQLite UTC datetime ("YYYY-MM-DD HH:MM:SS") -> readable local Arabic-ish string */
export function formatDateTime(dt: string): string {
  if (!dt) return "";
  const normalized = dt.includes("T") ? dt : dt.replace(" ", "T") + "Z";
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return dt;
  const date = toISODate(d);
  const time = formatTime12(
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  );
  return `${date} — ${time}`;
}
