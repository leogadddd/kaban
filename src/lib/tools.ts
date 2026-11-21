// Budgeting tools: pay cycles, safe-to-spend, recurring detection, budgets and a cash-flow forecast.
// Everything here is a pure, deterministic projection of the local ledger (no stored totals, no ML).
import { cycleInfo, dueFor, shiftStatement } from "./billing";
import { addDays, clampedDate, daysBetween, daysInMonth, fromISO, toISO } from "./dates";
import { accountBalances, billedOnStatement, isCredit } from "./finance";
import type { Account, InstalmentEntry, Txn } from "./types";

/** The slice of the ledger these tools read (matches `useLedger()`). */
export interface ToolLedger {
  accounts: Account[];
  activeAccounts: Account[];
  txns: Txn[];
  instalments: InstalmentEntry[];
}

// ---------- Pay cycles ----------

export const PAYDAYS_META = "paydays";
export const PAYDAY_WEEKEND_META = "paydayWeekendEarly";
export const DEFAULT_PAYDAYS = [15, 30];

export function formatPaydays(days: number[]) {
  const suffixes: Record<number, string> = { 1: "st", 2: "nd", 3: "rd" };
  const ordinals = days.map((day) => {
    const suffix = day >= 11 && day <= 13 ? "th" : suffixes[day % 10] ?? "th";
    return `${day}${suffix}`;
  });
  return new Intl.ListFormat("en-PH").format(ordinals);
}

/** Clean a stored payday list: whole days 1–31, unique, ascending, at least one. */
export function normalisePaydays(value: unknown): number[] {
  const days = Array.isArray(value) ? value.map(Number).filter((d) => Number.isInteger(d) && d >= 1 && d <= 31) : [];
  const unique = [...new Set(days)].sort((a, b) => a - b);
  return unique.length ? unique.slice(0, 4) : DEFAULT_PAYDAYS;
}

/** Clamp to the month's length before applying the weekend rule. */
function paydaysIn(year: number, month0: number, days: number[], moveEarlier: boolean): string[] {
  return days.map((day) => {
    const date = clampedDate(year, month0, day);
    if (!moveEarlier) return toISO(date);
    const weekday = date.getDay();
    return toISO(addDays(date, weekday === 0 ? -2 : weekday === 6 ? -1 : 0));
  });
}

export interface PayCycle {
  /** Most recent payday on or before today. */
  start: string;
  /** Next payday strictly after today (new money arrives that day). */
  nextPayday: string;
  /** Days from today up to (not including) the next payday, today counted. */
  daysLeft: number;
  /** Full cycle length in days. */
  length: number;
}

export function payCycle(today: string, paydays: number[], moveEarlier = true): PayCycle {
  const d = fromISO(today);
  const candidates: string[] = [];
  // A payday on the first can already have shifted into the preceding month.
  for (let k = -1; k <= 2; k++) {
    const m = new Date(d.getFullYear(), d.getMonth() + k, 1);
    candidates.push(...paydaysIn(m.getFullYear(), m.getMonth(), paydays, moveEarlier));
  }
  candidates.sort();
  const start = [...candidates].reverse().find((c) => c <= today) ?? today;
  const nextPayday = candidates.find((c) => c > today) ?? toISO(addDays(d, 15));
  return { start, nextPayday, daysLeft: Math.max(1, daysBetween(today, nextPayday)), length: Math.max(1, daysBetween(start, nextPayday)) };
}

/** Upcoming paydays after `from`, up to and including `to`. */
export function paydaysBetween(from: string, to: string, paydays: number[], moveEarlier = true): string[] {
  const out = new Set<string>();
  const start = fromISO(from);
  // Include nominal paydays that can shift in from the next month.
  const end = addDays(fromISO(to), moveEarlier ? 2 : 0);
  for (let m = new Date(start.getFullYear(), start.getMonth(), 1); m <= end; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
    for (const date of paydaysIn(m.getFullYear(), m.getMonth(), paydays, moveEarlier)) {
      if (date > from && date <= to) out.add(date);
    }
  }
  return [...out].sort();
}

/**
 * Suggest paydays from income that repeats on the same day of the month. Days 28–31 are read as
 * "end of month" (stored as 30, which clamps to the month's length), and pay that lands a day or two
 * early (weekends, holidays) still counts toward its usual day.
 */
export function detectPaydays(txns: Txn[], today: string): number[] | null {
  const since = toISO(addDays(fromISO(today), -150));
  const income = txns.filter((t) => t.state === "active" && t.type === "income" && t.date >= since && t.date <= today);
  if (income.length < 3) return null;
  // Ignore small one-off income (gifts, cashback): keep amounts at least a quarter of the largest.
  const max = Math.max(...income.map((t) => t.amountMinor));
  const slot = (iso: string) => {
    const d = fromISO(iso);
    const day = d.getDate();
    return day >= 28 || daysInMonth(d.getFullYear(), d.getMonth()) - day <= 1 ? 30 : day;
  };
  const months = new Map<number, Set<string>>();
  for (const t of income) {
    if (t.amountMinor < max / 4) continue;
    const s = slot(t.date);
    const set = months.get(s) ?? new Set<string>();
    set.add(t.date.slice(0, 7));
    months.set(s, set);
  }
  // Merge neighbouring slots, so pay that lands a day or two early counts toward the usual day.
  const slots = [...months.entries()].map(([day, set]) => ({ day, months: set.size })).sort((a, b) => b.months - a.months);
  const picked: { day: number; months: number }[] = [];
  for (const s of slots) {
    const near = picked.find((p) => Math.abs(p.day - s.day) <= 2);
    if (near) near.months += s.months;
    else picked.push({ ...s });
  }
  const regular = picked.filter((p) => p.months >= 2).sort((a, b) => b.months - a.months).slice(0, 2);
  return regular.length ? regular.map((p) => p.day).sort((a, b) => a - b) : null;
}

// ---------- Recurring detection ----------

const MONTH_WORDS = /\b(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june?|july?|aug(ust)?|sept?(ember)?|oct(ober)?|nov(ember)?|dec(ember)?)\b/g;

/** Group key for a description: lower case, no digits, month names or punctuation ("Meralco Nov 2026" → "meralco"). */
export function normaliseDescription(description: string): string {
  return description
    .toLowerCase()
    .replace(MONTH_WORDS, " ")
    .replace(/[0-9]+/g, " ")
    .replace(/[^\p{L}\s&]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Display name for a recurring item: the description without the month or numbers ("Meralco Oct" → "Meralco"). */
function cleanLabel(description: string) {
  const cleaned = description.replace(new RegExp(MONTH_WORDS.source, "gi"), " ").replace(/\b\d+\b/g, " ").replace(/\s+/g, " ").replace(/[\s\-–·,]+$/, "").trim();
  return cleaned || description.trim();
}

export type Cadence = "weekly" | "semimonthly" | "monthly" | "quarterly" | "yearly";

const CADENCES: { cadence: Cadence; min: number; max: number }[] = [
  { cadence: "weekly", min: 5, max: 9 },
  { cadence: "semimonthly", min: 12, max: 18 },
  { cadence: "monthly", min: 26, max: 35 },
  { cadence: "quarterly", min: 80, max: 100 },
  { cadence: "yearly", min: 350, max: 380 },
];

export const CADENCE_LABEL: Record<Cadence, string> = {
  weekly: "Weekly",
  semimonthly: "Twice a month",
  monthly: "Monthly",
  quarterly: "Every 3 months",
  yearly: "Yearly",
};

/** Bill-like categories need only two charges a month apart to count as recurring. */
const BILL_CATEGORIES = new Set(["Bills & Utilities", "Phone & Internet", "Home", "Education"]);

export type PriceChange = { kind: "changed"; from: number; to: number } | { kind: "higher"; usual: number; to: number } | null;

export interface Recurring {
  key: string;
  label: string;
  kind: "expense" | "income";
  category?: string;
  cadence: Cadence;
  /** Median days between charges. */
  interval: number;
  /** Median amount. */
  typical: number;
  /** Lowest and highest amounts seen. */
  low: number;
  high: number;
  /** Amounts are near-identical (a subscription) rather than metered (a utility). */
  fixed: boolean;
  last: Txn;
  next: string;
  /** The next date is long gone with no new charge: probably cancelled. */
  lapsed: boolean;
  priceChange: PriceChange;
  accountId: string;
  txns: Txn[];
}

export const median = (values: number[]) => {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

export const percentile = (values: number[], p: number) => {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const i = (s.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return Math.round(s[lo] + (s[hi] - s[lo]) * (i - lo));
};

function nextDate(last: string, cadence: Cadence, interval: number, anchorDay: number): string {
  const d = fromISO(last);
  const months = cadence === "monthly" ? 1 : cadence === "quarterly" ? 3 : cadence === "yearly" ? 12 : 0;
  if (!months) return toISO(addDays(d, interval));
  // Keep the usual day of the month instead of drifting by the median gap.
  let next = clampedDate(d.getFullYear(), d.getMonth() + months, anchorDay);
  const gap = daysBetween(last, toISO(next));
  if (gap < interval * 0.6) next = clampedDate(d.getFullYear(), d.getMonth() + months + 1, anchorDay);
  else if (gap > interval * 1.4) next = clampedDate(d.getFullYear(), d.getMonth() + months - 1, anchorDay);
  return toISO(next);
}

/**
 * Charges (or income) that repeat at a steady interval, grouped by normalised description.
 * Needs three occurrences, or two a month or more apart for bill-like categories, and at least
 * three quarters of the gaps must fit one cadence.
 */
export function detectRecurring(txns: Txn[], today: string, kind: "expense" | "income" = "expense"): Recurring[] {
  const since = toISO(addDays(fromISO(today), -400));
  const groups = new Map<string, Txn[]>();
  for (const t of txns) {
    if (t.state !== "active" || t.type !== kind || t.date > today || t.date < since) continue;
    const key = normaliseDescription(t.description) || (t.category ? `#${t.category.toLowerCase()}` : "");
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }
  const out: Recurring[] = [];
  for (const [key, list] of groups) {
    // One charge per day at most (a split bill paid twice in a day is still one payment).
    const byDay = new Map<string, Txn[]>();
    for (const t of list) byDay.set(t.date, [...(byDay.get(t.date) ?? []), t]);
    const days = [...byDay.keys()].sort();
    if (days.length < 2) continue;
    const gaps = days.slice(1).map((d, i) => daysBetween(days[i], d));
    const interval = median(gaps);
    const fit = CADENCES.find((c) => interval >= c.min && interval <= c.max);
    if (!fit) continue;
    const fitting = gaps.filter((g) => g >= fit.min * 0.8 && g <= fit.max * 1.2).length;
    if (fitting / gaps.length < 0.75) continue;
    const category = list[0].category;
    const enough = days.length >= 3 || (fit.min >= 26 && (kind === "income" || BILL_CATEGORIES.has(category ?? "")));
    if (!enough) continue;
    // Too frequent for its cadence (e.g. groceries several times a week that happen to median 7 days).
    if (days.length > Math.ceil(daysBetween(days[0], today) / fit.min) + 2) continue;

    const amounts = days.map((d) => byDay.get(d)!.reduce((s, t) => s + t.amountMinor, 0));
    const typical = median(amounts);
    const low = Math.min(...amounts);
    const high = Math.max(...amounts);
    const earlier = amounts.slice(0, -1);
    const latest = amounts[amounts.length - 1];
    const usual = median(earlier);
    const stableBefore = earlier.length > 0 && Math.max(...earlier) - Math.min(...earlier) <= Math.max(100, usual * 0.02);
    const fixed = high - low <= Math.max(100, typical * 0.02);
    let priceChange: PriceChange = null;
    if (stableBefore && Math.abs(latest - usual) > Math.max(100, usual * 0.02)) priceChange = { kind: "changed", from: usual, to: latest };
    else if (!stableBefore && earlier.length >= 2 && latest > usual * 1.25) priceChange = { kind: "higher", usual, to: latest };

    // A subscription that changed price is now billed at the new price.
    const current = priceChange?.kind === "changed" ? latest : typical;
    const lastDay = days[days.length - 1];
    const last = byDay.get(lastDay)!.sort((a, b) => b.amountMinor - a.amountMinor)[0];
    const anchorDay = median(days.map((d) => fromISO(d).getDate()));
    const next = nextDate(lastDay, fit.cadence, interval, anchorDay);
    out.push({
      key,
      label: cleanLabel(last.description) || category || "Untitled",
      kind,
      category,
      cadence: fit.cadence,
      interval,
      typical: current,
      low,
      high,
      fixed: fixed || priceChange?.kind === "changed",
      last,
      next,
      lapsed: daysBetween(next, today) > Math.max(10, interval * 0.6),
      priceChange,
      accountId: last.accountId,
      txns: list.sort((a, b) => b.date.localeCompare(a.date)),
    });
  }
  return out.sort((a, b) => a.next.localeCompare(b.next));
}

/** Dates a recurring item is expected on in (from, to]. A semi-monthly salary follows the configured paydays. */
export function expectedDates(r: Recurring, from: string, to: string, paydays?: number[], moveEarlier = true): string[] {
  if (r.lapsed) return [];
  if (r.kind === "income" && paydays) {
    if (r.cadence === "semimonthly") return paydaysBetween(from, to, paydays, moveEarlier);
    if (r.cadence === "monthly" && paydays.length === 1) {
      const next = fromISO(r.next);
      const nearUpcomingIncome = paydaysBetween(toISO(addDays(next, -3)), toISO(addDays(next, 2)), paydays, false);
      if (nearUpcomingIncome.length) return paydaysBetween(from, to, paydays, moveEarlier);
    }
  }
  const out: string[] = [];
  const anchorDay = fromISO(r.next).getDate();
  let date = r.next;
  for (let guard = 0; date <= to && guard < 60; guard++) {
    if (date > from) out.push(date);
    date = nextDate(date, r.cadence, r.interval, anchorDay);
  }
  return out;
}

// ---------- Safe to spend ----------

/**
 * Money set aside for savings this pay cycle. Always 0 for now: the future savings system plugs in
 * here (e.g. a goal's per-cycle contribution) and the allowance picks it up automatically.
 */
export function reservedSavings(_ledger: ToolLedger, _cycle: PayCycle): number {
  void _ledger;
  void _cycle;
  return 0;
}

export interface BillDue {
  key: string;
  label: string;
  date: string;
  amount: number;
  /** The expected date has passed without a matching charge yet. */
  late: boolean;
  /** Charged to a credit card: still money owed before payday, but it lands on the card. */
  accountId: string;
}

export interface CardDue {
  account: Account;
  /** Card balance that isn't a future instalment: billed statements plus new, unbilled charges. */
  amount: number;
  /** Part of `amount` on a statement that is due before payday. */
  dueBeforePayday: number;
  dueDate?: string;
  /** Instalment portions due before payday (shown on their own line). */
  instalments: number;
  instalmentItems: { label: string; amount: number; dueDate: string }[];
}

export interface Allowance {
  cycle: PayCycle;
  cash: number;
  bills: BillDue[];
  billsTotal: number;
  cards: CardDue[];
  cardsTotal: number;
  instalmentsTotal: number;
  savings: number;
  /** cash − bills − card dues − instalments − savings. */
  spendable: number;
  /** Everyday spending recorded today (cash, debit and card; recurring bills excluded). */
  spentToday: number;
  /** (spendable + spentToday) ÷ days left, rounded down to the centavo; spendable ÷ days (negative) when over-committed. */
  perDay: number;
  /** perDay − spentToday. */
  leftToday: number;
}

/** Amount still owed on a closed statement: its billed total less payments made after it closed. */
export function statementRemaining(card: Account, statement: string, ledger: ToolLedger): number {
  const billed = billedOnStatement(card, statement, ledger.txns, ledger.instalments).total;
  const paid = ledger.txns.reduce((s, t) => {
    if (t.state !== "active" || t.date <= statement) return s;
    if (t.type === "card_payment" && t.toAccountId === card.id) return s + t.amountMinor;
    if (t.type === "member_payment" && t.accountId === card.id) return s + t.amountMinor;
    return s;
  }, 0);
  return Math.max(0, billed - paid);
}

/** Bills expected from a few days ago (not paid yet) through the day before payday. */
export function billsDue(recurring: Recurring[], today: string, until: string): BillDue[] {
  const out: BillDue[] = [];
  const graceStart = toISO(addDays(fromISO(today), -7));
  for (const r of recurring) {
    if (r.kind !== "expense" || r.lapsed) continue;
    for (const date of expectedDates(r, toISO(addDays(fromISO(graceStart), -1)), toISO(addDays(fromISO(until), -1)))) {
      out.push({ key: `${r.key}:${date}`, label: r.label, date, amount: r.typical, late: date < today, accountId: r.accountId });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Safe to spend today =
 *   (cash in cash/debit accounts − recurring bills expected before payday − credit-card dues
 *    − instalments due before payday − reserved savings + everyday spending already recorded today*)
 *   ÷ days left until payday (today counted, payday not).
 *   (*not added back when the bracket without it is already negative)
 *
 * Card dues are the card balance that isn't a future instalment, so a card swipe lowers the allowance
 * the moment it is recorded, not when the statement arrives. Instalment portions due before payday are
 * listed separately; later portions are left to later cycles. Recomputed from live balances, so
 * whatever isn't spent today rolls into tomorrow.
 */
export function safeToSpend(ledger: ToolLedger, today: string, paydays: number[], recurring = detectRecurring(ledger.txns, today), moveEarlier = true): Allowance {
  const cycle = payCycle(today, paydays, moveEarlier);
  const upToToday = ledger.txns.filter((t) => t.date <= today);
  const balances = accountBalances(ledger.activeAccounts, upToToday);
  let cash = 0;
  for (const b of balances.values()) if (!isCredit(b.account)) cash += b.balance;

  const bills = billsDue(recurring, today, cycle.nextPayday);
  const billsTotal = bills.reduce((s, b) => s + b.amount, 0);

  const activeTxn = new Set(ledger.txns.filter((t) => t.state === "active").map((t) => t.id));
  const txnById = new Map(ledger.txns.map((t) => [t.id, t]));
  const cards: CardDue[] = [];
  for (const b of balances.values()) {
    const card = b.account;
    if (!isCredit(card)) continue;
    const entries = ledger.instalments.filter((e) => e.accountId === card.id && activeTxn.has(e.transactionId));
    const later = entries.filter((e) => e.dueDate >= cycle.nextPayday).reduce((s, e) => s + e.amountMinor, 0);
    const soon = entries.filter((e) => e.dueDate >= today && e.dueDate < cycle.nextPayday);
    const committed = Math.max(0, b.balance - later);
    const instalments = Math.min(committed, soon.reduce((s, e) => s + e.amountMinor, 0));
    const amount = committed - instalments;
    // The statement due before payday, if any (excluding its instalment portions, listed above).
    const info = cycleInfo(card, today);
    let dueBeforePayday = 0;
    let dueDate: string | undefined;
    for (let s = info.upcomingDueStatement, k = 0; k < 3; k++, s = shiftStatement(card, s, 1)) {
      const due = dueFor(card, s);
      if (due >= cycle.nextPayday) break;
      if (due < today || s > today) continue;
      const inst = soon.filter((e) => e.statementDate === s).reduce((sum, e) => sum + e.amountMinor, 0);
      dueBeforePayday += Math.max(0, statementRemaining(card, s, ledger) - inst);
      dueDate = due;
    }
    dueBeforePayday = Math.min(amount, dueBeforePayday);
    if (amount <= 0 && instalments <= 0) continue;
    cards.push({
      account: card,
      amount,
      dueBeforePayday,
      dueDate,
      instalments,
      instalmentItems: soon.map((e) => ({
        label: `${txnById.get(e.transactionId)?.description || "Instalment"} ${e.index}/${e.count}`,
        amount: e.amountMinor,
        dueDate: e.dueDate,
      })),
    });
  }
  const cardsTotal = cards.reduce((s, c) => s + c.amount, 0);
  const instalmentsTotal = cards.reduce((s, c) => s + c.instalments, 0);
  const savings = reservedSavings(ledger, cycle);
  const spendable = cash - billsTotal - cardsTotal - instalmentsTotal - savings;
  // Today's everyday spending (cash or card) is added back, so the day's allowance stays put while
  // you spend it; tomorrow's number is recomputed from what's actually left. Recurring bills paid
  // today aren't added back: they've already dropped off the bills line.
  const recurringIds = new Set(recurring.flatMap((r) => r.txns.map((t) => t.id)));
  const spentToday = ledger.txns.reduce((s, t) => s + (t.state === "active" && t.type === "expense" && t.date === today && !recurringIds.has(t.id) ? t.amountMinor : 0), 0);
  // Once commitments outrun cash there's nothing to hold for the day: show the real shortfall.
  const base = spendable < 0 ? spendable : spendable + spentToday;
  const perDay = Math.floor(base / cycle.daysLeft);
  return { cycle, cash, bills, billsTotal, cards, cardsTotal, instalmentsTotal, savings, spendable, spentToday, perDay, leftToday: perDay - spentToday };
}

// ---------- Category budgets ----------

export const BUDGETS_META = "budgets";
export type BudgetPeriod = "month" | "cycle";
export interface Budget {
  category: string;
  limitMinor: number;
  period: BudgetPeriod;
}

export function normaliseBudgets(value: unknown): Budget[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((b): b is Budget => !!b && typeof b.category === "string" && Number.isSafeInteger(b.limitMinor) && b.limitMinor > 0)
    .map((b) => ({ category: b.category, limitMinor: b.limitMinor, period: b.period === "cycle" ? "cycle" : "month" }));
}

export type BudgetLevel = "ok" | "warn" | "over";
export interface BudgetStatus {
  budget: Budget;
  from: string;
  to: string;
  spent: number;
  remaining: number;
  percent: number;
  level: BudgetLevel;
  txns: Txn[];
}

export function budgetRange(period: BudgetPeriod, today: string, paydays: number[], moveEarlier = true) {
  if (period === "cycle") {
    const c = payCycle(today, paydays, moveEarlier);
    return { from: c.start, to: toISO(addDays(fromISO(c.nextPayday), -1)) };
  }
  const d = fromISO(today);
  return { from: toISO(new Date(d.getFullYear(), d.getMonth(), 1)), to: toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
}

export function budgetStatuses(budgets: Budget[], txns: Txn[], today: string, paydays: number[], moveEarlier = true): BudgetStatus[] {
  return budgets.map((budget) => {
    const { from, to } = budgetRange(budget.period, today, paydays, moveEarlier);
    const matching = txns.filter((t) => t.state === "active" && t.type === "expense" && (t.category || "Other") === budget.category && t.date >= from && t.date <= to);
    const spent = matching.reduce((s, t) => s + t.amountMinor, 0);
    const percent = budget.limitMinor > 0 ? (spent / budget.limitMinor) * 100 : 0;
    return {
      budget,
      from,
      to,
      spent,
      remaining: budget.limitMinor - spent,
      percent,
      level: percent >= 100 ? "over" : percent >= 80 ? "warn" : "ok",
      txns: matching,
    };
  });
}

// ---------- Cash-flow forecast ----------

export interface ForecastEvent {
  date: string;
  label: string;
  amount: number; // signed: + income, − outflow
  /** Signed amount on a bad and a good month (bills vary; income and card dues don't). */
  worst: number;
  best: number;
  kind: "income" | "bill" | "card";
}

export interface ForecastPoint {
  date: string;
  balance: number;
  /** [low, high] band: heavier and lighter than usual day-to-day spending, and bills at their highest and lowest. */
  band: [number, number];
  events: ForecastEvent[];
}

export interface Forecast {
  enoughHistory: boolean;
  historyDays: number;
  horizon: string;
  start: number;
  points: ForecastPoint[];
  events: ForecastEvent[];
  daily: { typical: number; low: number; high: number };
  lowest: ForecastPoint | null;
  /** The event that pulls the balance to its lowest point, if one lands that day. */
  lowestCause: ForecastEvent | null;
  end: ForecastPoint | null;
  /** Fallback when history is short: average daily spending so far. */
  pace: number;
}

export const MIN_FORECAST_HISTORY = 60;

export function forecast(ledger: ToolLedger, today: string, horizon: string, paydays: number[], moveEarlier = true): Forecast {
  const active = ledger.txns.filter((t) => t.state === "active" && t.date <= today);
  const first = active.reduce<string | null>((m, t) => (!m || t.date < m ? t.date : m), null);
  const historyDays = first ? daysBetween(first, today) + 1 : 0;
  const cashIds = new Set(ledger.activeAccounts.filter((a) => !isCredit(a)).map((a) => a.id));
  const balances = accountBalances(ledger.activeAccounts, active);
  let start = 0;
  for (const b of balances.values()) if (!isCredit(b.account)) start += b.balance;

  const bills = detectRecurring(ledger.txns, today, "expense");
  const income = detectRecurring(ledger.txns, today, "income");
  const recurringIds = new Set(bills.flatMap((r) => r.txns.map((t) => t.id)));

  // Day-to-day spending from cash and debit (card purchases leave cash on their due date instead).
  // Weekly totals smooth out lumpy days; the median week ÷ 7 is the typical day, the quartiles the band.
  const weeks: number[] = [];
  const weekCount = Math.min(8, Math.floor(historyDays / 7));
  for (let w = 0; w < weekCount; w++) {
    const to = toISO(addDays(fromISO(today), -7 * w - 1));
    const from = toISO(addDays(fromISO(today), -7 * w - 7));
    weeks.push(active.reduce((s, t) => (t.type === "expense" && cashIds.has(t.accountId) && !recurringIds.has(t.id) && t.date >= from && t.date <= to ? s + t.amountMinor : s), 0));
  }
  const daily = {
    typical: Math.round(median(weeks) / 7),
    low: Math.round(percentile(weeks, 0.25) / 7),
    high: Math.round(percentile(weeks, 0.75) / 7),
  };
  const spentSoFar = active.reduce((s, t) => (t.type === "expense" ? s + t.amountMinor : s), 0);
  const pace = historyDays ? Math.round(spentSoFar / historyDays) : 0;

  const events: ForecastEvent[] = [];
  for (const r of income) for (const date of expectedDates(r, today, horizon, paydays, moveEarlier)) events.push({ date, label: r.label, amount: r.typical, worst: r.typical, best: r.typical, kind: "income" });
  // Bills paid from cash/debit leave cash on their date; card-charged ones show up through the card's due date.
  const billByKey = new Map(bills.map((r) => [r.key, r]));
  for (const b of billsDue(bills, today, toISO(addDays(fromISO(horizon), 1)))) {
    if (!cashIds.has(b.accountId)) continue;
    const r = billByKey.get(b.key.slice(0, b.key.lastIndexOf(":")));
    events.push({ date: b.date < today ? toISO(addDays(fromISO(today), 1)) : b.date, label: b.label, amount: -b.amount, worst: -(r?.high ?? b.amount), best: -(r?.low ?? b.amount), kind: "bill" });
  }
  for (const card of ledger.activeAccounts.filter(isCredit)) {
    const info = cycleInfo(card, today);
    for (let s = info.upcomingDueStatement, k = 0; k < 4; k++, s = shiftStatement(card, s, 1)) {
      const due = dueFor(card, s);
      if (due > horizon) break;
      if (due < today) continue;
      const amount = statementRemaining(card, s, ledger);
      if (amount > 0) events.push({ date: due === today ? toISO(addDays(fromISO(today), 1)) : due, label: `${card.name} due`, amount: -amount, worst: -amount, best: -amount, kind: "card" });
    }
  }
  events.sort((a, b) => a.date.localeCompare(b.date));

  const points: ForecastPoint[] = [];
  let mid = start;
  let lo = start;
  let hi = start;
  const days = Math.max(0, daysBetween(today, horizon));
  for (let i = 0; i <= days; i++) {
    const date = toISO(addDays(fromISO(today), i));
    const todays = events.filter((e) => e.date === date && i > 0);
    if (i > 0) {
      mid += todays.reduce((s, e) => s + e.amount, 0) - daily.typical;
      lo += todays.reduce((s, e) => s + e.worst, 0) - daily.high;
      hi += todays.reduce((s, e) => s + e.best, 0) - daily.low;
    }
    points.push({ date, balance: mid, band: [lo, hi], events: todays });
  }
  const lowest = points.length > 1 ? points.slice(1).reduce((m, p) => (p.balance < m.balance ? p : m)) : null;
  const lowestCause = lowest
    ? [...events].reverse().find((e) => e.amount < 0 && e.date <= lowest.date && daysBetween(e.date, lowest.date) <= 2) ?? null
    : null;
  return {
    enoughHistory: historyDays >= MIN_FORECAST_HISTORY,
    historyDays,
    horizon,
    start,
    points,
    events,
    daily,
    lowest,
    lowestCause,
    end: points[points.length - 1] ?? null,
    pace,
  };
}
