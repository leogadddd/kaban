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
  const byDay = days <= 62;
  const dayStep = days <= 7 ? 1 : 7;
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
