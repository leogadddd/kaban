import { addDays, clampedDate, daysBetween, fromISO, toISO } from "./dates";
import { byCategory, isEarning, isSpending } from "./finance";
import type { Txn } from "./types";

export type AnalyticsPeriod = "this-month" | "last-month" | "3-months" | "6-months" | "12-months" | "custom";
export type DateRange = { from: string; to: string };

const FULL_MONTHS = { "last-month": 1, "3-months": 3, "6-months": 6, "12-months": 12 };

export function analyticsRanges(period: AnalyticsPeriod, today: string, custom: DateRange) {
  const date = fromISO(today);
  const year = date.getFullYear();
  const month = date.getMonth();
  const monthStart = (offset: number) => toISO(new Date(year, month + offset, 1));
  const monthEnd = (offset: number) => toISO(new Date(year, month + offset + 1, 0));

  if (period === "this-month") {
    return {
      current: { from: monthStart(0), to: today },
      previous: { from: monthStart(-1), to: toISO(clampedDate(year, month - 1, date.getDate())) },
    };
  }
  if (period === "custom") {
    const days = daysBetween(custom.from, custom.to) + 1;
    const start = fromISO(custom.from);
    return { current: custom, previous: { from: toISO(addDays(start, -days)), to: toISO(addDays(start, -1)) } };
  }
  const months = FULL_MONTHS[period];
  return {
    current: { from: monthStart(-months), to: monthEnd(-1) },
    previous: { from: monthStart(-2 * months), to: monthEnd(-months - 1) },
  };
}

export type AnalyticsBucket = DateRange & { label: string; income: number; expense: number };

function flowBuckets(range: DateRange): AnalyticsBucket[] {
  const days = daysBetween(range.from, range.to) + 1;
  const start = fromISO(range.from);
  const end = fromISO(range.to);
  const months = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1;
  const monthStep = Math.ceil(months / 12);
  const byDay = days <= 92;
  const dayStep = days <= 10 ? 1 : 7;
  const buckets: AnalyticsBucket[] = [];

  let from = range.from;
  while (from <= range.to) {
    const day = fromISO(from);
    const next = byDay
      ? addDays(day, dayStep)
      : new Date(day.getFullYear(), day.getMonth() + monthStep, 1);
    const bucketEnd = toISO(addDays(next, -1));
    buckets.push({
      from,
      to: bucketEnd < range.to ? bucketEnd : range.to,
      label: (byDay ? dayAxisFormat : monthAxisFormat).format(day),
      income: 0,
      expense: 0,
    });
    from = toISO(next);
  }
  return buckets;
}

function addToFlow(flow: { income: number; expense: number }, txn: Txn) {
  if (txn.type === "income") flow.income += txn.amountMinor;
  else flow.expense += txn.amountMinor;
}

export function analyticsReport(txns: Txn[], accountId: string, current: DateRange, previous: DateRange) {
  const buckets = flowBuckets(current);
  const activity: Txn[] = [];
  const priorActivity: Txn[] = [];
  const totals = { income: 0, expense: 0 };
  const priorTotals = { income: 0, expense: 0 };

  for (const txn of txns) {
    if ((accountId && txn.accountId !== accountId) || (!isSpending(txn) && !isEarning(txn))) continue;
    if (txn.date >= current.from && txn.date <= current.to) {
      activity.push(txn);
      addToFlow(totals, txn);
      const bucket = buckets.find(({ from, to }) => txn.date >= from && txn.date <= to);
      if (bucket) addToFlow(bucket, txn);
    } else if (txn.date >= previous.from && txn.date <= previous.to) {
      priorActivity.push(txn);
      addToFlow(priorTotals, txn);
    }
  }

  const priorCategories = new Map(byCategory(priorActivity).map(({ category, amount }) => [category, amount]));
  const categories = byCategory(activity).map(({ category, amount }) => {
    const before = priorCategories.get(category) ?? 0;
    priorCategories.delete(category);
    return { category, amount, before };
  });
  for (const [category, before] of priorCategories) categories.push({ category, amount: 0, before });

  return { totals, priorTotals, buckets, categories, activity, priorActivity };
}

const rangeFormat = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" });
const monthAxisFormat = new Intl.DateTimeFormat("en-PH", { month: "short", year: "2-digit" });
const dayAxisFormat = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" });

export function formatAnalyticsRange({ from, to }: DateRange, referenceDate?: string) {
  const year = referenceDate?.slice(0, 4);
  const format = year && from.startsWith(year + "-") && to.startsWith(year + "-") ? dayAxisFormat : rangeFormat;
  return format.formatRange(fromISO(from), fromISO(to));
}

export type PacePoint = { index: number; date: string; current: number | null; previous: number | null };

/** Running spend through each day of the period, lined up against the same day of the comparison period. */
export function spendingPace(activity: Txn[], priorActivity: Txn[], current: DateRange, previous: DateRange, today: string): PacePoint[] {
  const daily = (txns: Txn[]) => {
    const map = new Map<string, number>();
    for (const txn of txns) if (txn.type === "expense") map.set(txn.date, (map.get(txn.date) ?? 0) + txn.amountMinor);
    return map;
  };
  const now = daily(activity);
  const before = daily(priorActivity);
  const length = Math.max(daysBetween(current.from, current.to), daysBetween(previous.from, previous.to)) + 1;
  const start = fromISO(current.from);
  const priorStart = fromISO(previous.from);
  const points: PacePoint[] = [];
  let runningNow = 0;
  let runningBefore = 0;
  for (let index = 0; index < length; index++) {
    const date = toISO(addDays(start, index));
    const priorDate = toISO(addDays(priorStart, index));
    const inCurrent = date <= current.to && date <= today;
    const inPrevious = priorDate <= previous.to;
    if (inCurrent) runningNow += now.get(date) ?? 0;
    if (inPrevious) runningBefore += before.get(priorDate) ?? 0;
    points.push({ index, date, current: inCurrent ? runningNow : null, previous: inPrevious ? runningBefore : null });
  }
  return points;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Average spend per weekday: total for that weekday ÷ how many of that weekday fall in the range. */
export function weekdaySpending(activity: Txn[], range: DateRange, today: string) {
  const end = range.to < today ? range.to : today;
  const counts = Array(7).fill(0);
  const totals = Array(7).fill(0);
  for (let day = fromISO(range.from); toISO(day) <= end; day = addDays(day, 1)) counts[day.getDay()]++;
  for (const txn of activity) if (txn.type === "expense") totals[fromISO(txn.date).getDay()] += txn.amountMinor;
  // Monday-first reads like a work week.
  return [1, 2, 3, 4, 5, 6, 0].map((day) => ({
    day: WEEKDAYS[day],
    name: WEEKDAY_NAMES[day],
    weekday: day,
    total: totals[day],
    average: counts[day] ? Math.round(totals[day] / counts[day]) : 0,
  }));
}

export type Ranked = { key: string; label: string; amount: number; count: number; txns: Txn[] };

function rank(txns: Txn[], keyOf: (txn: Txn) => string, labelOf: (txn: Txn) => string): Ranked[] {
  const groups = new Map<string, Ranked>();
  for (const txn of txns) {
    if (txn.type !== "expense") continue;
    const key = keyOf(txn);
    const group = groups.get(key) ?? { key, label: labelOf(txn), amount: 0, count: 0, txns: [] };
    group.amount += txn.amountMinor;
    group.count++;
    group.txns.push(txn);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.amount - a.amount);
}

/** Where the money went, grouped by description (case and spacing ignored). */
export const topPayees = (activity: Txn[]) =>
  rank(activity, (txn) => txn.description.trim().toLowerCase().replace(/\s+/g, " ") || "—", (txn) => txn.description.trim() || "No description");

export const spendingByAccount = (activity: Txn[], nameOf: (id: string) => string) =>
  rank(activity, (txn) => txn.accountId, (txn) => nameOf(txn.accountId));

export const largestExpenses = (activity: Txn[], count = 5) =>
  activity.filter((txn) => txn.type === "expense").sort((a, b) => b.amountMinor - a.amountMinor).slice(0, count);

/** Days elapsed in the range (stops at today) and the range's full length. */
export function rangeDays(range: DateRange, today: string, periodEnd = range.to) {
  const end = range.to < today ? range.to : today;
  return { elapsed: Math.max(1, daysBetween(range.from, end) + 1), total: daysBetween(range.from, periodEnd) + 1 };
}

/** Where a running period finishes: this month runs to its last day, other ranges end where they say. */
export function periodEnd(period: AnalyticsPeriod, range: DateRange) {
  if (period !== "this-month") return range.to;
  const start = fromISO(range.from);
  return toISO(new Date(start.getFullYear(), start.getMonth() + 1, 0));
}
