export const WEEKDAYS_AR = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

/** Format time to 12-hour Arabic format ("13:30" -> "01:30 م", 14 -> "02:00 م", Date -> "07:30 ص") */
export function formatTime12(
  t: string | number | Date | null | undefined,
  options?: { fullPeriod?: boolean },
): string {
  if (t === null || t === undefined || t === "") return "";

  let h = 0;
  let m = 0;

  if (t instanceof Date) {
    h = t.getHours();
    m = t.getMinutes();
  } else if (typeof t === "number") {
    h = Math.floor(t);
    m = 0;
  } else if (typeof t === "string") {
    const trimmed = t.trim();
    if (trimmed.includes("T") || (trimmed.includes("-") && trimmed.includes(":"))) {
      const d = new Date(trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T") + (trimmed.endsWith("Z") ? "" : "Z"));
      if (!Number.isNaN(d.getTime())) {
        h = d.getHours();
        m = d.getMinutes();
      } else {
        return t;
      }
    } else if (trimmed.includes(":")) {
      const parts = trimmed.split(":");
      h = Number(parts[0]);
      m = Number(parts[1]);
    } else {
      h = Number(trimmed);
      m = 0;
    }
  }

  if (Number.isNaN(h) || Number.isNaN(m)) return String(t);

  const fullPeriod = options?.fullPeriod ?? false;
  const period = fullPeriod
    ? h < 12
      ? "صباحاً"
      : "مساءً"
    : h < 12
      ? "ص"
      : "م";

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

/** SQLite UTC datetime ("YYYY-MM-DD HH:MM:SS") or ISO / Date -> readable local Arabic string */
export function formatDateTime(dt: string | Date | null | undefined): string {
  if (!dt) return "";
  const d =
    dt instanceof Date
      ? dt
      : new Date(dt.includes("T") ? dt : dt.replace(" ", "T") + (dt.endsWith("Z") ? "" : "Z"));
  if (Number.isNaN(d.getTime())) return typeof dt === "string" ? dt : "";
  const date = toISODate(d);
  const time = formatTime12(d);
  return `${date} — ${time}`;
}
