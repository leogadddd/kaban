export type AccountType = "cash" | "debit" | "credit";

export interface Account {
  id: string;
  type: AccountType;
  name: string;
  /** cash/debit: opening balance. credit: opening outstanding debt. Never counted as income. */
  openingMinor: number;
  openingDate: string;
  creditLimitMinor?: number;
  /** Statement closing day of month (1–31, clamped to month length). */
  closingDay?: number;
  /** Payment due date = closing date + N days. */
  dueDaysAfterClosing?: number;
  issuer?: string;
  /** Picked from the bank list (lib/banks.ts); issuer keeps the display name. */
  bankId?: string;
  last4?: string;
  color: string;
  archived: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  version: number;
}

export type TxnType =
  | "expense"
  | "income"
  | "transfer"
  | "card_payment"
  | "adjustment"
  | "reimbursement"
  | "refund";

export type Arrangement = "regular" | "deferred" | "instalment";

export interface Txn {
  id: string;
  type: TxnType;
  /** Source account. For card_payment: the cash/debit account paying. For reimbursement: receiving account. */
  accountId: string;
  /** transfer: destination account. card_payment: the credit card being paid. */
  toAccountId?: string;
  /** Always positive, except adjustment which is signed (+ raises balance / outstanding). */
  amountMinor: number;
  currency: "PHP";
  date: string;
  description: string;
  category?: string;
  notes?: string;
  arrangement?: Arrangement;
  instalmentCount?: number;
  /** reimbursement: debt being repaid. */
  debtId?: string;
  personId?: string;
  state: "active" | "void";
  createdAt: number;
  updatedAt: number;
  version: number;
}

export interface InstalmentEntry {
  id: string;
  transactionId: string;
  accountId: string;
  index: number; // 1-based
  count: number;
  /** Statement closing date the portion is billed on. */
  statementDate: string;
  dueDate: string;
  amountMinor: number;
  createdAt: number;
}

export interface Person {
  id: string;
  name: string;
  nickname?: string;
  color: string;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
  version: number;
}

/** "me" is the owner pseudo-participant in splits. */
export const ME = "me";

export interface SplitAllocation {
  id: string;
  transactionId: string;
  personId: string; // ME or Person.id
  amountMinor: number;
}

export interface Debt {
  id: string;
  personId: string;
  transactionId?: string;
  amountMinor: number;
  description: string;
  date: string;
  state: "active" | "void";
  createdAt: number;
  updatedAt: number;
  version: number;
}

/** quota: rejected because the user's cloud storage is full; retried later. */
export type OutboxStatus = "pending" | "syncing" | "failed" | "conflict" | "quota" | "done";

export interface OutboxEntry {
  mutationId: string;
  entity: string;
  entityId: string;
  op: "put" | "delete";
  version: number;
  payload: unknown;
  status: OutboxStatus;
  attempts: number;
  createdAt: number;
  lastError?: string;
}

export interface Meta {
  key: string;
  value: unknown;
}
