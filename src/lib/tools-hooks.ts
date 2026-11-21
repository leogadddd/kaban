"use client";

import { useMemo } from "react";
import { todayISO } from "./dates";
import { useLedger, useMeta } from "./hooks";
import { BUDGETS_META, detectRecurring, normaliseBudgets, normalisePaydays, PAYDAYS_META, safeToSpend } from "./tools";

/** Configured paydays (defaults to the 15th and 30th until the user picks their own). */
export function usePaydays() {
  const stored = useMeta<number[]>(PAYDAYS_META);
  const paydays = useMemo(() => normalisePaydays(stored), [stored]);
  return { paydays, custom: Array.isArray(stored), loading: stored === null };
}

export function useBudgets() {
  const stored = useMeta<unknown>(BUDGETS_META);
  return useMemo(() => normaliseBudgets(stored), [stored]);
}

/** Today's allowance from the live ledger. */
export function useSafeToSpend() {
  const ledger = useLedger();
  const { paydays, custom, loading } = usePaydays();
  const today = todayISO();
  const recurring = useMemo(() => detectRecurring(ledger.txns, today), [ledger.txns, today]);
  const allowance = useMemo(() => safeToSpend(ledger, today, paydays, recurring), [ledger, today, paydays, recurring]);
  return { ledger, allowance, paydays, custom, recurring, today, ready: ledger.ready && !loading };
}
