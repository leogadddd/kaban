import Dexie, { type EntityTable } from "dexie";
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

  constructor() {
    super("kaban");
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

export const db = new KabanDB();

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
