import { addDays, clampedDate, fromISO, toISO } from "./dates";
import type { Account } from "./types";

const DEFAULT_CLOSING = 1;
const DEFAULT_DUE_DAYS = 21;

function closing(a: Pick<Account, "closingDay">) {
  return a.closingDay ?? DEFAULT_CLOSING;
}

export function dueDays(a: Pick<Account, "dueDaysAfterClosing">) {
  return a.dueDaysAfterClosing ?? DEFAULT_DUE_DAYS;
}

/** The statement closing date a purchase made on `dateIso` lands on (regular billing). */
export function statementFor(a: Pick<Account, "closingDay">, dateIso: string): string {
  const d = fromISO(dateIso);
  const thisMonth = clampedDate(d.getFullYear(), d.getMonth(), closing(a));
  if (d <= thisMonth) return toISO(thisMonth);
  return toISO(clampedDate(d.getFullYear(), d.getMonth() + 1, closing(a)));
}

/** Shift a statement date by k cycles, keeping the configured closing day. */
export function shiftStatement(a: Pick<Account, "closingDay">, statementIso: string, k: number): string {
  const d = fromISO(statementIso);
  return toISO(clampedDate(d.getFullYear(), d.getMonth() + k, closing(a)));
}

export function dueFor(a: Pick<Account, "dueDaysAfterClosing">, statementIso: string): string {
  return toISO(addDays(fromISO(statementIso), dueDays(a)));
}

export interface CycleInfo {
  /** Most recent closing date on or before today. */
  lastClosing: string;
  /** Next closing date on or after today (the currently open statement). */
  nextClosing: string;
  /** Upcoming payment due date (from the last statement if not yet passed). */
  upcomingDue: string;
  /** The statement the upcoming due date belongs to. */
  upcomingDueStatement: string;
}

export function cycleInfo(a: Pick<Account, "closingDay" | "dueDaysAfterClosing">, todayIso: string): CycleInfo {
  const next = statementFor(a, todayIso);
  const last = next === todayIso ? todayIso : shiftStatement(a, next, -1);
  const lastDue = dueFor(a, last);
  const useLast = lastDue >= todayIso;
  return {
    lastClosing: last,
    nextClosing: next,
    upcomingDue: useLast ? lastDue : dueFor(a, next),
    upcomingDueStatement: useLast ? last : next,
  };
}
