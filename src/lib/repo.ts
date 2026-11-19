// All writes go through here. Each one commits atomically in IndexedDB together with its
// outbox entries, so the ledger and the sync queue can never disagree.
import { db, uid } from "./db";
import { dueFor, shiftStatement, statementFor } from "./billing";
import { splitEvenly } from "./money";
import { todayISO } from "./dates";
import {
  ME,
  type Account,
  type Debt,
  type InstalmentEntry,
  type Person,
  type SplitAllocation,
  type Txn,
} from "./types";

const ALL_TABLES = () => [
  db.accounts,
  db.transactions,
  db.instalments,
  db.people,
  db.splits,
  db.debts,
  db.outbox,
  db.meta,
];

async function enqueue(entity: string, entityId: string, version: number, payload: unknown, op: "put" | "delete" = "put") {
  await db.outbox.add({
    mutationId: uid(),
    entity,
    entityId,
    op,
    version,
    payload,
    status: "pending",
    attempts: 0,
    createdAt: Date.now(),
  });
}

export const ACCOUNT_COLORS = ["#176B4D", "#2D936C", "#0F3D2E", "#7FB89A", "#C9A227", "#3C6E71", "#1F2D27", "#A3C9A8"];
export const PERSON_COLORS = ["#2D936C", "#C9A227", "#3C6E71", "#C94B4B", "#7B6CD9", "#E07A3F", "#176B4D", "#4A90A4"];

// ---------- Accounts ----------

export type AccountInput = Omit<Account, "id" | "createdAt" | "updatedAt" | "version" | "archived" | "sortOrder"> & {
  archived?: boolean;
};

export async function saveAccount(input: AccountInput, id?: string): Promise<string> {
  return db.transaction("rw", ALL_TABLES(), async () => {
    const now = Date.now();
    if (id) {
      const prev = await db.accounts.get(id);
      if (!prev) throw new Error("Account not found");
      const next: Account = { ...prev, ...input, archived: input.archived ?? prev.archived, updatedAt: now, version: prev.version + 1 };
      await db.accounts.put(next);
      await enqueue("account", id, next.version, next);
      return id;
    }
    const count = await db.accounts.count();
    const acc: Account = {
      ...input,
      id: uid(),
      archived: false,
      sortOrder: count,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    await db.accounts.add(acc);
    await enqueue("account", acc.id, 1, acc);
    return acc.id;
  });
}

export async function setAccountArchived(id: string, archived: boolean) {
  await db.transaction("rw", ALL_TABLES(), async () => {
    const prev = await db.accounts.get(id);
    if (!prev) return;
    const next = { ...prev, archived, updatedAt: Date.now(), version: prev.version + 1 };
    await db.accounts.put(next);
    await enqueue("account", id, next.version, next);
  });
}

// ---------- Transactions ----------

export interface SplitInput {
  personId: string;
  amountMinor: number;
}

export type TxnInput = Omit<Txn, "id" | "createdAt" | "updatedAt" | "version" | "state" | "currency"> & {
  splits?: SplitInput[];
};

function validateTxn(t: TxnInput, accounts: Map<string, Account>) {
  const src = accounts.get(t.accountId);
  if (!src) throw new Error("Choose an account");
  if (!Number.isSafeInteger(t.amountMinor) || (t.type !== "adjustment" && t.amountMinor <= 0))
    throw new Error("Enter an amount greater than zero");
  if (t.type === "adjustment" && t.amountMinor === 0) throw new Error("Adjustment cannot be zero");
  if (t.type === "transfer") {
    const dst = t.toAccountId && accounts.get(t.toAccountId);
    if (!dst) throw new Error("Choose a destination account");
    if (dst.id === src.id) throw new Error("Pick two different accounts");
    if (src.type === "credit" || dst.type === "credit") throw new Error("Use a card payment to pay a credit card");
  }
  if (t.type === "card_payment") {
    const dst = t.toAccountId && accounts.get(t.toAccountId);
    if (!dst || dst.type !== "credit") throw new Error("Choose the credit card to pay");
    if (src.type === "credit") throw new Error("Pay from a cash or debit account");
  }
  if ((t.type === "income" || t.type === "reimbursement") && src.type === "credit")
    throw new Error("Income must go to a cash or debit account");
  if (t.arrangement === "instalment") {
    if (src.type !== "credit") throw new Error("Instalments are only for credit cards");
    if (!t.instalmentCount || t.instalmentCount < 2 || t.instalmentCount > 60) throw new Error("Instalments need 2–60 months");
  }
  if (t.splits?.length) {
    const sum = t.splits.reduce((s, p) => s + p.amountMinor, 0);
    if (sum !== t.amountMinor) throw new Error("Split amounts must add up exactly to the total");
    if (t.splits.some((s) => s.amountMinor < 0)) throw new Error("Split amounts can't be negative");
  }
}

function buildSchedule(acc: Account, t: Txn): InstalmentEntry[] {
  if (t.arrangement !== "instalment" || !t.instalmentCount || t.state !== "active") return [];
  const first = statementFor(acc, t.date);
  return splitEvenly(t.amountMinor, t.instalmentCount).map((amt, i) => {
    const s = shiftStatement(acc, first, i);
    return {
      id: `${t.id}:${i + 1}`,
      transactionId: t.id,
      accountId: acc.id,
      index: i + 1,
      count: t.instalmentCount!,
      statementDate: s,
      dueDate: dueFor(acc, s),
      amountMinor: amt,
      createdAt: Date.now(),
    };
  });
}

export async function saveTransaction(input: TxnInput, id?: string): Promise<string> {
  return db.transaction("rw", ALL_TABLES(), () => writeTransaction(input, id));
}

/** The body of saveTransaction. Must run inside an open rw transaction over ALL_TABLES (no nesting needed). */
async function writeTransaction(input: TxnInput, id?: string): Promise<string> {
  {
    const accounts = new Map((await db.accounts.toArray()).map((a) => [a.id, a]));
    validateTxn(input, accounts);
    const now = Date.now();
    const { splits, ...fields } = input;
    const prev = id ? await db.transactions.get(id) : undefined;
    if (id && !prev) throw new Error("Transaction not found");

    const txn: Txn = prev
      ? { ...prev, ...fields, updatedAt: now, version: prev.version + 1 }
      : { ...fields, id: uid(), currency: "PHP", state: "active", createdAt: now, updatedAt: now, version: 1 };
    if (txn.type !== "transfer" && txn.type !== "card_payment") delete txn.toAccountId;
    if (txn.arrangement !== "instalment") delete txn.instalmentCount;
    await db.transactions.put(txn);
    await enqueue("transaction", txn.id, txn.version, txn);

    // Instalment schedule is a projection of the purchase: regenerate.
    await db.instalments.where("transactionId").equals(txn.id).delete();
    const acc = accounts.get(txn.accountId)!;
    const schedule = buildSchedule(acc, txn);
    if (schedule.length) await db.instalments.bulkAdd(schedule);

    // Splits → allocations + one debt per other participant. Keep debt ids per person so
    // repayments stay linked when a split is edited.
    if (splits !== undefined) await applySplits(txn, splits);
    return txn.id;
  }
}

async function applySplits(txn: Txn, splits: SplitInput[]) {
  const now = Date.now();
  await db.splits.where("transactionId").equals(txn.id).delete();
  const existingDebts = await db.debts.where("transactionId").equals(txn.id).toArray();
  const byPerson = new Map(existingDebts.map((d) => [d.personId, d]));
  const allocations: SplitAllocation[] = splits
    .filter((s) => s.amountMinor > 0)
    .map((s) => ({ id: uid(), transactionId: txn.id, personId: s.personId, amountMinor: s.amountMinor }));
  if (allocations.length) await db.splits.bulkAdd(allocations);
  for (const a of allocations) await enqueue("split", a.id, 1, a);

  const keep = new Set<string>();
  for (const a of allocations) {
    if (a.personId === ME) continue;
    const prev = byPerson.get(a.personId);
    const debt: Debt = prev
      ? { ...prev, amountMinor: a.amountMinor, description: txn.description, date: txn.date, state: "active", updatedAt: now, version: prev.version + 1 }
      : {
          id: uid(),
          personId: a.personId,
          transactionId: txn.id,
          amountMinor: a.amountMinor,
          description: txn.description,
          date: txn.date,
          state: "active",
          createdAt: now,
          updatedAt: now,
          version: 1,
        };
    keep.add(debt.id);
    await db.debts.put(debt);
    await enqueue("debt", debt.id, debt.version, debt);
  }
  for (const d of existingDebts) {
    if (keep.has(d.id) || d.state === "void") continue;
    const v = { ...d, state: "void" as const, updatedAt: now, version: d.version + 1 };
    await db.debts.put(v);
    await enqueue("debt", d.id, v.version, v);
  }
}

/** Void instead of delete, keeping an audit trail. Linked debts are voided too. */
export async function setTransactionVoid(id: string, voided: boolean) {
  await db.transaction("rw", ALL_TABLES(), async () => {
    const t = await db.transactions.get(id);
    if (!t) return;
    const now = Date.now();
    const next: Txn = { ...t, state: voided ? "void" : "active", updatedAt: now, version: t.version + 1 };
    await db.transactions.put(next);
    await enqueue("transaction", id, next.version, next);
    const debts = await db.debts.where("transactionId").equals(id).toArray();
    for (const d of debts) {
      const v = { ...d, state: voided ? ("void" as const) : ("active" as const), updatedAt: now, version: d.version + 1 };
      await db.debts.put(v);
      await enqueue("debt", d.id, v.version, v);
    }
    await db.instalments.where("transactionId").equals(id).delete();
    const acc = await db.accounts.get(t.accountId);
    if (acc && !voided) {
      const s = buildSchedule(acc, next);
      if (s.length) await db.instalments.bulkAdd(s);
    }
  });
}

// ---------- People & debts ----------

export async function savePerson(input: { name: string; nickname?: string; color?: string }, id?: string): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new Error("Enter a name");
  return db.transaction("rw", ALL_TABLES(), async () => {
    const now = Date.now();
    if (id) {
      const prev = await db.people.get(id);
      if (!prev) throw new Error("Person not found");
      const next = { ...prev, ...input, name, updatedAt: now, version: prev.version + 1 };
      await db.people.put(next);
      await enqueue("person", id, next.version, next);
      return id;
    }
    const count = await db.people.count();
    const p: Person = {
      id: uid(),
      name,
      nickname: input.nickname,
      color: input.color ?? PERSON_COLORS[count % PERSON_COLORS.length],
      archived: false,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    await db.people.add(p);
    await enqueue("person", p.id, 1, p);
    return p.id;
  });
}

export async function setPersonArchived(id: string, archived: boolean) {
  await db.transaction("rw", ALL_TABLES(), async () => {
    const p = await db.people.get(id);
    if (!p) return;
    const next = { ...p, archived, updatedAt: Date.now(), version: p.version + 1 };
    await db.people.put(next);
    await enqueue("person", id, next.version, next);
  });
}

export async function saveDebt(input: { personId: string; amountMinor: number; description: string; date: string }, id?: string) {
  if (!input.personId) throw new Error("Choose a person");
  if (!(input.amountMinor > 0)) throw new Error("Enter an amount greater than zero");
  return db.transaction("rw", ALL_TABLES(), async () => {
    const now = Date.now();
    const prev = id ? await db.debts.get(id) : undefined;
    const d: Debt = prev
      ? { ...prev, ...input, updatedAt: now, version: prev.version + 1 }
      : { ...input, id: uid(), state: "active", createdAt: now, updatedAt: now, version: 1 };
    await db.debts.put(d);
    await enqueue("debt", d.id, d.version, d);
    return d.id;
  });
}

export async function voidDebt(id: string) {
  await db.transaction("rw", ALL_TABLES(), async () => {
    const d = await db.debts.get(id);
    if (!d) return;
    const next = { ...d, state: "void" as const, updatedAt: Date.now(), version: d.version + 1 };
    await db.debts.put(next);
    await enqueue("debt", id, next.version, next);
  });
}

/** A repayment is a single reimbursement record: debt goes down and the receiving account goes up, atomically. */
export async function recordRepayment(input: { debtId: string; amountMinor: number; accountId: string; date?: string; notes?: string }) {
  const debt = await db.debts.get(input.debtId);
  if (!debt) throw new Error("Debt not found");
  const person = await db.people.get(debt.personId);
  return saveTransaction({
    type: "reimbursement",
    accountId: input.accountId,
    amountMinor: input.amountMinor,
    date: input.date ?? todayISO(),
    description: `Repayment from ${person?.name ?? "someone"}`,
    category: "Reimbursement",
    notes: input.notes,
    debtId: debt.id,
    personId: debt.personId,
  });
}

/** Split a lump payment across a person's open debts, oldest first. Pure: used for the preview and the write. */
export function allocatePayment(amountMinor: number, debts: { debtId: string; outstanding: number }[]) {
  let left = amountMinor;
  const parts: { debtId: string; amountMinor: number; settles: boolean }[] = [];
  for (const d of debts) {
    if (left <= 0) break;
    if (d.outstanding <= 0) continue;
    const take = Math.min(left, d.outstanding);
    parts.push({ debtId: d.debtId, amountMinor: take, settles: take === d.outstanding });
    left -= take;
  }
  return { parts, unallocated: left };
}

/**
 * Record money received from a person. One reimbursement per debt it pays down, all committed together,
 * so the receiving account and every debt update atomically.
 */
export async function recordPersonPayment(input: { personId: string; amountMinor: number; accountId: string; date?: string; debtIds?: string[] }) {
  if (!(input.amountMinor > 0)) throw new Error("Enter an amount greater than zero");
  if (!input.accountId) throw new Error("Choose where the money went");
  return db.transaction("rw", ALL_TABLES(), async () => {
    const person = await db.people.get(input.personId);
    const debts = (await db.debts.where("personId").equals(input.personId).toArray())
      .filter((d) => d.state === "active" && (!input.debtIds || input.debtIds.includes(d.id)))
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
    const repaid = new Map<string, number>();
    for (const t of await db.transactions.where("personId").equals(input.personId).toArray()) {
      if (t.type === "reimbursement" && t.state === "active" && t.debtId) repaid.set(t.debtId, (repaid.get(t.debtId) ?? 0) + t.amountMinor);
    }
    const open = debts.map((d) => ({ debtId: d.id, outstanding: d.amountMinor - (repaid.get(d.id) ?? 0) }));
    const { parts, unallocated } = allocatePayment(input.amountMinor, open);
    if (unallocated > 0) throw new Error("That's more than they owe you");
    const ids: string[] = [];
    for (const part of parts) {
      ids.push(
        await writeTransaction({
          type: "reimbursement",
          accountId: input.accountId,
          amountMinor: part.amountMinor,
          date: input.date ?? todayISO(),
          description: `Repayment from ${person?.name ?? "someone"}`,
          category: "Reimbursement",
          debtId: part.debtId,
          personId: input.personId,
        }),
      );
    }
    return ids;
  });
}

// ---------- Meta / backup ----------

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown) {
  await db.meta.put({ key, value });
}

export async function exportBackup() {
  const [accounts, transactions, instalments, people, splits, debts] = await Promise.all([
    db.accounts.toArray(),
    db.transactions.toArray(),
    db.instalments.toArray(),
    db.people.toArray(),
    db.splits.toArray(),
    db.debts.toArray(),
  ]);
  return { app: "kaban", format: 1, exportedAt: new Date().toISOString(), accounts, transactions, instalments, people, splits, debts };
}

/** Merge a backup: records are upserted by stable id, newest version wins; nothing is silently dropped. */
export async function importBackup(data: Awaited<ReturnType<typeof exportBackup>>) {
  if (data?.app !== "kaban") throw new Error("This file isn't a Kaban backup");
  let added = 0;
  let updated = 0;
  await db.transaction("rw", ALL_TABLES(), async () => {
    const pairs = [
      [db.accounts, data.accounts],
      [db.transactions, data.transactions],
      [db.people, data.people],
      [db.debts, data.debts],
    ] as const;
    for (const [table, rows] of pairs) {
      for (const row of rows ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const t = table as any;
        const prev = await t.get(row.id);
        if (!prev) {
          await t.put(row);
          added++;
        } else if ((row.version ?? 0) > (prev.version ?? 0)) {
          await t.put(row);
          updated++;
        }
      }
    }
    for (const s of data.splits ?? []) await db.splits.put(s);
    for (const e of data.instalments ?? []) await db.instalments.put(e);
  });
  return { added, updated };
}

export async function wipeAll() {
  await db.transaction("rw", ALL_TABLES(), async () => {
    await Promise.all(ALL_TABLES().map((t) => t.clear()));
  });
}
