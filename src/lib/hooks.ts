"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { liveQuery } from "dexie";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useLedgerDatabase, type KabanDB } from "./db";
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
  /** Transactions that have split allocations (a row check that stays O(1) on long lists). */
  splitTxnIds: Set<string>;
  debts: Debt[];
  balances: ReturnType<typeof accountBalances>;
  totals: ReturnType<typeof totals>;
  debtStatus: ReturnType<typeof debtStatuses>;
  accountById: Map<string, Account>;
  personById: Map<string, Person>;
}

async function loadLedger(db: KabanDB) {
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
    splitTxnIds: new Set((data?.splits ?? []).map((s) => s.transactionId)),
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
const ledgerStores = new WeakMap<KabanDB, ReturnType<typeof createLedgerStore>>();

function createLedgerStore(db: KabanDB) {
  let current = EMPTY;
  const listeners = new Set<() => void>();
  let subscription: ReturnType<ReturnType<typeof liveQuery>["subscribe"]> | undefined;
  return {
    read: () => current,
    subscribe(listener: () => void) {
      listeners.add(listener);
      subscription ??= liveQuery(() => loadLedger(db)).subscribe({
        next(value) {
          current = value;
          listeners.forEach((notify) => notify());
        },
        error: (error) => console.error("ledger query failed", error),
      });
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          subscription?.unsubscribe();
          subscription = undefined;
          current = EMPTY;
        }
      };
    },
  };
}
const unavailable = { read: () => EMPTY, subscribe: () => () => {} };

/** Live projection of the active ledger. */
export function useLedger(): Ledger {
  const db = useLedgerDatabase();
  let store = db ? ledgerStores.get(db) : undefined;
  if (db && !store) {
    store = createLedgerStore(db);
    ledgerStores.set(db, store);
  }
  const active = store ?? unavailable;
  return useSyncExternalStore(active.subscribe, active.read, unavailable.read);
}

export function useMeta<T>(key: string): T | undefined | null {
  const db = useLedgerDatabase();
  const value = useLiveQuery(async () => db && ({ db, key, value: (await db.meta.get(key))?.value as T | undefined }), [db, key]);
  return value && value.db === db && value.key === key ? value.value : null;
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
  const db = useLedgerDatabase();
  const result = useLiveQuery(async () => db && ({ db, count: await db.outbox.where("status").anyOf("pending", "failed", "conflict").count() }), [db]);
  return result && result.db === db ? result.count : 0;
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
