"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { liveQuery } from "dexie";
import { useEffect, useState, useSyncExternalStore } from "react";
import { db } from "./db";
import { accountBalances, debtStatuses, totals } from "./finance";
import type { Account, Debt, InstalmentEntry, Person, SplitAllocation, Txn } from "./types";

export interface Ledger {
  ready: boolean;
  accounts: Account[];
  activeAccounts: Account[];
  txns: Txn[];
  instalments: InstalmentEntry[];
  people: Person[];
  splits: SplitAllocation[];
  debts: Debt[];
  balances: ReturnType<typeof accountBalances>;
  totals: ReturnType<typeof totals>;
  debtStatus: ReturnType<typeof debtStatuses>;
  accountById: Map<string, Account>;
  personById: Map<string, Person>;
}

async function loadLedger() {
  const [accounts, txns, instalments, people, splits, debts] = await Promise.all([
    db.accounts.orderBy("sortOrder").toArray(),
    db.transactions.toArray(),
    db.instalments.toArray(),
    db.people.orderBy("name").toArray(),
    db.splits.toArray(),
    db.debts.toArray(),
  ]);
  txns.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  return buildLedger({ accounts, txns, instalments, people, splits, debts });
}

function buildLedger(data?: { accounts: Account[]; txns: Txn[]; instalments: InstalmentEntry[]; people: Person[]; splits: SplitAllocation[]; debts: Debt[] }): Ledger {
  const accounts = data?.accounts ?? [];
  const txns = data?.txns ?? [];
  const balances = accountBalances(accounts, txns);
  return {
    ready: !!data,
    accounts,
    activeAccounts: accounts.filter((a) => !a.archived),
    txns,
    instalments: data?.instalments ?? [],
    people: data?.people ?? [],
    splits: data?.splits ?? [],
    debts: data?.debts ?? [],
    balances,
    totals: totals(balances),
    debtStatus: debtStatuses(data?.debts ?? [], txns),
    accountById: new Map(accounts.map((a) => [a.id, a])),
    personById: new Map((data?.people ?? []).map((p) => [p.id, p])),
  };
}

// One app-wide live subscription. Pages read the latest projection synchronously, so a navigation
// renders real numbers on its first frame (no skeleton flash, and view transitions snapshot real content).
const EMPTY = buildLedger();
let current: Ledger = EMPTY;
const listeners = new Set<() => void>();
let started = false;

function subscribeLedger(cb: () => void) {
  listeners.add(cb);
  if (!started) {
    started = true;
    liveQuery(loadLedger).subscribe({
      next: (v) => {
        current = v;
        listeners.forEach((l) => l());
      },
      error: (e) => console.error("ledger query failed", e),
    });
  }
  return () => listeners.delete(cb);
}

/** Live projection of the whole local ledger; re-renders on every IndexedDB change. */
export function useLedger(): Ledger {
  return useSyncExternalStore(subscribeLedger, () => current, () => EMPTY);
}

export function useMeta<T>(key: string): T | undefined | null {
  // null = loading, undefined = not set
  const v = useLiveQuery(async () => ({ v: (await db.meta.get(key))?.value as T | undefined }), [key]);
  return v ? v.v : null;
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

export function usePendingCount(): number {
  return useLiveQuery(() => db.outbox.where("status").anyOf("pending", "failed", "conflict").count()) ?? 0;
}

/** True when the viewport matches `query` (false during prerender). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)");
