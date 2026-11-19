// Dates are stored as local calendar days "YYYY-MM-DD" to avoid timezone drift.

export function todayISO(): string {
  return toISO(new Date());
}

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

/** Date for a given day-of-month, clamped to the month's length (e.g. day 31 in Feb). */
export function clampedDate(year: number, month0: number, day: number): Date {
  return new Date(year, month0, Math.min(day, daysInMonth(year, month0)));
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

const dayFmt = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" });
const dayYearFmt = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" });
const monthFmt = new Intl.DateTimeFormat("en-PH", { month: "short", year: "numeric" });
const monthShort = new Intl.DateTimeFormat("en-PH", { month: "short" });

export function formatDay(iso: string): string {
  const d = fromISO(iso);
  return d.getFullYear() === new Date().getFullYear() ? dayFmt.format(d) : dayYearFmt.format(d);
}

export function formatDayLong(iso: string): string {
  return dayYearFmt.format(fromISO(iso));
}

export function formatMonth(key: string): string {
  return monthFmt.format(fromISO(key + "-01"));
}

export function formatMonthShort(key: string): string {
  return monthShort.format(fromISO(key + "-01"));
}

export function relativeDayLabel(iso: string): string {
  const t = todayISO();
  if (iso === t) return "Today";
  if (iso === toISO(addDays(new Date(), -1))) return "Yesterday";
  return formatDayLong(iso);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((fromISO(toIso).getTime() - fromISO(fromIso).getTime()) / 86_400_000);
}
