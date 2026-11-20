import type { Account, Debt, Person, SplitAllocation, Txn } from "./types";

export interface SyncedRecords {
  account: Account;
  transaction: Txn;
  person: Person;
  debt: Debt;
  split: SplitAllocation;
}
export type Entity = keyof SyncedRecords;

const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
const text = (value: unknown, max = 8192) => typeof value === "string" && [...value].length <= max;
const nonempty = (value: unknown) => typeof value === "string" && value.trim().length > 0 && text(value);
const id = (value: unknown) => typeof value === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
const color = (value: unknown) => typeof value === "string" && /^#[a-fA-F0-9]{6}$/.test(value);
const boolean = (value: unknown) => typeof value === "boolean";
const date = (value: unknown) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};
const oneOf = (...values: string[]) => (value: unknown) => typeof value === "string" && values.includes(value);
const optional = (check: (value: unknown) => boolean) => (value: unknown) => value === undefined || check(value);
const versioned = {
  id,
  version: (value: unknown) => integer(value, 1, 2_147_483_647),
  createdAt: (value: unknown) => integer(value, 0),
  updatedAt: (value: unknown) => integer(value, 0),
};
const state = oneOf("active", "void");
const positive = (value: unknown) => integer(value, 1);
const months = (value: unknown) => integer(value, 2, 60);

const fields = {
  account: {
    ...versioned,
    type: oneOf("cash", "debit", "credit"),
    name: nonempty,
    openingMinor: (value) => integer(value, -Number.MAX_SAFE_INTEGER),
    openingDate: date,
    creditLimitMinor: optional((value) => integer(value, 0)),
    closingDay: optional((value) => integer(value, 1, 31)),
    dueDaysAfterClosing: optional((value) => integer(value, 1, 60)),
    issuer: optional(text),
    bankId: optional(id),
    last4: optional((value) => typeof value === "string" && /^\d{4}$/.test(value)),
    color,
    archived: boolean,
    sortOrder: (value) => integer(value, 0),
  },
  transaction: {
    ...versioned,
    type: oneOf("expense", "income", "transfer", "card_payment", "adjustment", "reimbursement", "refund", "member_payment"),
    accountId: id,
    toAccountId: optional(id),
    amountMinor: (value) => integer(value, -Number.MAX_SAFE_INTEGER) && value !== 0,
    currency: oneOf("PHP"),
    date,
    description: text,
    category: optional(text),
    notes: optional(text),
    arrangement: optional(oneOf("regular", "deferred", "instalment")),
    instalmentCount: optional(months),
    debtId: optional(id),
    personId: optional(id),
    state,
  },
  person: { ...versioned, name: nonempty, nickname: optional(text), color, archived: boolean },
  debt: { ...versioned, personId: id, transactionId: optional(id), amountMinor: positive, description: text, date, state },
  split: { id, transactionId: id, personId: id, amountMinor: positive },
} satisfies { [E in Entity]: Record<keyof SyncedRecords[E], (value: unknown) => boolean> };

export function isEntity(value: unknown): value is Entity {
  return typeof value === "string" && Object.hasOwn(fields, value);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;
}

export function validSyncedRecord<E extends Entity>(entity: E, value: unknown): value is SyncedRecords[E] {
  if (!isRecord(value)) return false;
  const schema = fields[entity];
  if (Object.keys(value).some((key) => !Object.hasOwn(schema, key))) return false;
  if (!Object.entries(schema).every(([key, check]) => check(value[key]))) return false;
  if (entity === "transaction") {
    if (value.type !== "adjustment" && !positive(value.amountMinor)) return false;
    if (value.arrangement === "instalment" && (!months(value.instalmentCount) || value.type !== "expense")) return false;
    if (value.type === "transfer" || value.type === "card_payment") {
      if (!id(value.toAccountId) || value.toAccountId === value.accountId) return false;
    }
  }
  return true;
}
