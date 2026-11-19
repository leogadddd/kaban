"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
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

/** Live projection of the whole local ledger; re-renders on every IndexedDB change. */
export function useLedger(): Ledger {
  const data = useLiveQuery(async () => {
    const [accounts, txns, instalments, people, splits, debts] = await Promise.all([
      db.accounts.orderBy("sortOrder").toArray(),
      db.transactions.toArray(),
      db.instalments.toArray(),
      db.people.orderBy("name").toArray(),
      db.splits.toArray(),
      db.debts.toArray(),
    ]);
    txns.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    return { accounts, txns, instalments, people, splits, debts };
  });

  return useMemo(() => {
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
  }, [data]);
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
