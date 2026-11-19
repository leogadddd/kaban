import Dexie, { type EntityTable } from "dexie";
import { useSyncExternalStore } from "react";
import type {
  Account,
  Debt,
  InstalmentEntry,
  Meta,
  OutboxEntry,
  Person,
  SplitAllocation,
  Txn,
} from "./types";

export class KabanDB extends Dexie {
  accounts!: EntityTable<Account, "id">;
  transactions!: EntityTable<Txn, "id">;
  instalments!: EntityTable<InstalmentEntry, "id">;
  people!: EntityTable<Person, "id">;
  splits!: EntityTable<SplitAllocation, "id">;
  debts!: EntityTable<Debt, "id">;
  outbox!: EntityTable<OutboxEntry, "mutationId">;
  meta!: EntityTable<Meta, "key">;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      accounts: "id, type, archived, sortOrder",
      transactions: "id, type, accountId, toAccountId, date, category, debtId, personId, state",
      instalments: "id, transactionId, accountId, statementDate",
      people: "id, name, archived",
      splits: "id, transactionId, personId",
      debts: "id, personId, transactionId, state, date",
      outbox: "mutationId, status, entity, createdAt",
      meta: "key",
    });
  }
}

const local = new KabanDB("kaban-local");
const legacy = new KabanDB("kaban");
const accounts = new Map<string, KabanDB>();
const listeners = new Set<() => void>();
let visible: KabanDB | null = null;

export function databaseFor(userId?: string) {
  if (!userId) return local;
  let ledger = accounts.get(userId);
  if (!ledger) {
    ledger = new KabanDB(`kaban-account-${userId}`);
    accounts.set(userId, ledger);
  }
  return ledger;
}

export function showDatabase(ledger: KabanDB | null) {
  if (visible === ledger) return;
  visible = ledger;
  listeners.forEach((listener) => listener());
}

export function getDatabase() {
  if (!visible) throw new Error("The ledger is switching accounts. Try again when it loads.");
  return visible;
}

export function isActiveDatabase(ledger: KabanDB | null) {
  return ledger !== null && visible === ledger;
}

export function visibleDatabase() {
  return visible;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLedgerDatabase() {
  return useSyncExternalStore(subscribe, visibleDatabase, () => null);
}

export function ledgerTables(ledger: KabanDB) {
  return [ledger.accounts, ledger.transactions, ledger.instalments, ledger.people, ledger.splits, ledger.debts] as const;
}

export function allTables(ledger: KabanDB) {
  return [...ledgerTables(ledger), ledger.outbox, ledger.meta];
}

export async function migrateLedger(ledger: KabanDB, userId?: string) {
  if (await ledger.meta.get("legacyMigrated")) return;
  // Read the owner and its data in one snapshot. Keep the source until the destination commits.
  const snapshot = await legacy.transaction("r", allTables(legacy), async () => {
    const owner = await legacy.meta.get("syncUser");
    if (owner?.value !== userId) return;
    const [accounts, transactions, instalments, people, splits, debts, outbox, meta] = await Promise.all([
      legacy.accounts.toArray(), legacy.transactions.toArray(), legacy.instalments.toArray(), legacy.people.toArray(),
      legacy.splits.toArray(), legacy.debts.toArray(), legacy.outbox.toArray(), legacy.meta.toArray(),
    ]);
    return { accounts, transactions, instalments, people, splits, debts, outbox, meta };
  });
  await ledger.transaction("rw", allTables(ledger), async () => {
    if (await ledger.meta.get("legacyMigrated")) return;
    if (snapshot) {
      await Promise.all([
        ledger.accounts.bulkAdd(snapshot.accounts),
        ledger.transactions.bulkAdd(snapshot.transactions),
        ledger.instalments.bulkAdd(snapshot.instalments),
        ledger.people.bulkAdd(snapshot.people),
        ledger.splits.bulkAdd(snapshot.splits),
        ledger.debts.bulkAdd(snapshot.debts),
        ledger.outbox.bulkAdd(snapshot.outbox),
        ledger.meta.bulkAdd(snapshot.meta.filter(({ key }) => key !== "syncUser")),
      ]);
    }
    await ledger.meta.put({ key: "legacyMigrated", value: true });
  });
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    try {
      return crypto.randomUUID();
    } catch {
      /* insecure context */
    }
  }
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Ask the browser not to evict our storage (helps on iOS home-screen apps). */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
