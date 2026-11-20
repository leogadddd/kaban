// Pure projections derived from the local ledger. Balances are never stored.
import { shiftStatement, statementFor } from "./billing";
import { monthKey } from "./dates";
import type { Account, Debt, InstalmentEntry, Txn } from "./types";

export function isCredit(a: Pick<Account, "type">) {
  return a.type === "credit";
}

/**
 * Signed effect of one transaction on one account.
 * cash/debit → effect on balance. credit → effect on outstanding debt.
 */
export function effectOn(t: Txn, account: Account): number {
  if (t.state !== "active") return 0;
  const credit = isCredit(account);
  const isSrc = t.accountId === account.id;
  const isDst = t.toAccountId === account.id;
  switch (t.type) {
    case "expense":
      return isSrc ? (credit ? t.amountMinor : -t.amountMinor) : 0;
    case "income":
      return isSrc && !credit ? t.amountMinor : 0;
    case "reimbursement":
      return isSrc && !credit ? t.amountMinor : 0;
    case "refund":
      return isSrc ? (credit ? -t.amountMinor : t.amountMinor) : 0;
    case "transfer":
      if (isSrc) return -t.amountMinor;
      if (isDst) return t.amountMinor;
      return 0;
    case "card_payment":
      // Settles liability: source cash/debit goes down, card outstanding goes down. Not an expense.
      if (isSrc) return -t.amountMinor;
      if (isDst) return -t.amountMinor;
      return 0;
    case "adjustment":
      return isSrc ? t.amountMinor : 0;
    case "member_payment":
      // Someone else's money settled part of this card: outstanding goes down. Not spending or income.
      return isSrc && credit ? -t.amountMinor : 0;
  }
}

export interface AccountBalance {
  account: Account;
  /** cash/debit: balance. credit: outstanding debt. */
  balance: number;
  available?: number;
  utilisation?: number;
}

export function accountBalances(accounts: Account[], txns: Txn[]): Map<string, AccountBalance> {
  const map = new Map<string, AccountBalance>();
  for (const a of accounts) map.set(a.id, { account: a, balance: a.openingMinor });
  for (const t of txns) {
    if (t.state !== "active") continue;
    for (const id of [t.accountId, t.toAccountId]) {
      if (!id) continue;
      const b = map.get(id);
      if (b) b.balance += effectOn(t, b.account);
    }
  }
  for (const b of map.values()) {
    if (isCredit(b.account)) {
      const limit = b.account.creditLimitMinor ?? 0;
      b.available = limit - b.balance;
      b.utilisation = limit > 0 ? (b.balance / limit) * 100 : undefined;
    }
  }
  return map;
}

export interface Totals {
  availableFunds: number;
  creditOutstanding: number;
  creditLimit: number;
  netPosition: number;
}

export function totals(balances: Map<string, AccountBalance>, includeArchived = false): Totals {
  let availableFunds = 0;
  let creditOutstanding = 0;
  let creditLimit = 0;
  for (const b of balances.values()) {
    if (b.account.archived && !includeArchived) continue;
    if (isCredit(b.account)) {
      creditOutstanding += b.balance;
      creditLimit += b.account.creditLimitMinor ?? 0;
    } else availableFunds += b.balance;
  }
  return { availableFunds, creditOutstanding, creditLimit, netPosition: availableFunds - creditOutstanding };
}

/** Real spending excludes card payments, transfers, reimbursements and instalment schedules. */
export function isSpending(t: Txn) {
  return t.state === "active" && t.type === "expense";
}

export function isEarning(t: Txn) {
  return t.state === "active" && t.type === "income";
}

export interface MonthFlow {
  month: string;
  income: number;
  expense: number;
}

export function monthlyFlow(txns: Txn[], months: string[]): MonthFlow[] {
  const rows = new Map(months.map((m) => [m, { month: m, income: 0, expense: 0 }]));
  for (const t of txns) {
    const r = rows.get(monthKey(t.date));
    if (!r) continue;
    if (isSpending(t)) r.expense += t.amountMinor;
    if (isEarning(t)) r.income += t.amountMinor;
  }
  return [...rows.values()];
}

export function lastNMonths(n: number, from = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export function byCategory(txns: Txn[], month?: string): { category: string; amount: number }[] {
  const m = new Map<string, number>();
  for (const t of txns) {
    if (!isSpending(t)) continue;
    if (month && monthKey(t.date) !== month) continue;
    const c = t.category || "Other";
    m.set(c, (m.get(c) ?? 0) + t.amountMinor);
  }
  return [...m.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

/** Daily cumulative spend for the current month (home trend chart). */
export function dailySpend(txns: Txn[], days: number, today: Date = new Date()) {
  const out: { day: string; amount: number }[] = [];
  const map = new Map<string, number>();
  for (const t of txns) if (isSpending(t)) map.set(t.date, (map.get(t.date) ?? 0) + t.amountMinor);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    out.push({ day: iso, amount: map.get(iso) ?? 0 });
  }
  return out;
}

export interface DebtStatus {
  debt: Debt;
  repaid: number;
  outstanding: number;
  repayments: Txn[];
  settled: boolean;
}

export function debtStatuses(debts: Debt[], txns: Txn[]): DebtStatus[] {
  const reps = new Map<string, Txn[]>();
  for (const t of txns) {
    if (t.type !== "reimbursement" || t.state !== "active" || !t.debtId) continue;
    const list = reps.get(t.debtId) ?? [];
    list.push(t);
    reps.set(t.debtId, list);
  }
  return debts
    .filter((d) => d.state === "active")
    .map((debt) => {
      const repayments = (reps.get(debt.id) ?? []).sort((a, b) => b.date.localeCompare(a.date));
      const repaid = repayments.reduce((s, r) => s + r.amountMinor, 0);
      const outstanding = debt.amountMinor - repaid;
      return { debt, repaid, outstanding, repayments, settled: outstanding <= 0 };
    });
}

/**
 * The statement each billable portion lands on. Regular purchases bill in full on their statement,
 * deferred ones one cycle later, instalments according to their schedule. The full liability is
 * recognised at purchase time regardless (FR-025).
 */
export function billedOnStatement(
  account: Account,
  statementIso: string,
  txns: Txn[],
  instalments: InstalmentEntry[],
): { items: { txn: Txn; amount: number; label?: string }[]; total: number } {
  const items: { txn: Txn; amount: number; label?: string }[] = [];
  const byId = new Map(txns.map((t) => [t.id, t]));
  for (const t of txns) {
    if (t.state !== "active" || t.accountId !== account.id) continue;
    if (t.type !== "expense" && t.type !== "refund" && !(t.type === "adjustment")) continue;
    if (t.arrangement === "instalment") continue;
    let s = statementFor(account, t.date);
    if (t.arrangement === "deferred") s = shiftStatement(account, s, 1);
    if (s !== statementIso) continue;
    const sign = t.type === "refund" ? -1 : 1;
    items.push({ txn: t, amount: sign * t.amountMinor, label: t.arrangement === "deferred" ? "Deferred" : undefined });
  }
  for (const e of instalments) {
    if (e.accountId !== account.id || e.statementDate !== statementIso) continue;
    const t = byId.get(e.transactionId);
    if (!t || t.state !== "active") continue;
    items.push({ txn: t, amount: e.amountMinor, label: `Instalment ${e.index}/${e.count}` });
  }
  return { items, total: items.reduce((s, i) => s + i.amount, 0) };
}
