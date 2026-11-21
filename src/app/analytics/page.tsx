"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CalendarCheck, Flame, Gauge, ReceiptText, TrendingUp } from "lucide-react";
import { BarList, Change, FlowReport, PaceChart, UtilisationRing, WeekdayChart } from "@/components/charts";
import { GroupedTxns, TxnRow } from "@/components/txn-row";
import { BigMoney, Card, cx, EmptyState, Loading, Money, PageHeader, SectionTitle, Segmented, Sheet } from "@/components/ui";
import {
  analyticsRanges,
  analyticsReport,
  formatAnalyticsRange,
  largestExpenses,
  periodEnd,
  rangeDays,
  spendingByAccount,
  spendingPace,
  topPayees,
  weekdaySpending,
  type AnalyticsPeriod,
  type DateRange,
} from "@/lib/analytics";
import { iconFor } from "@/lib/categories";
import { formatDay, monthKey, todayISO } from "@/lib/dates";
import { accountBalances } from "@/lib/finance";
import { useLedger } from "@/lib/hooks";
import { useMoney } from "@/lib/privacy";
import type { Txn } from "@/lib/types";
import { AnalyticsFilters } from "./filters";

/** What the drill-down sheet shows: a title, the matching transactions, and optionally the same slice of the comparison period. */
type Selection = { title: string; range: DateRange; txns: Txn[]; prior?: { range: DateRange; txns: Txn[] } };

const COMPARE_LABEL: Record<AnalyticsPeriod, string> = {
  "this-month": "Last month",
  "last-month": "Month before",
  "3-months": "Previous 3 months",
  "6-months": "Previous 6 months",
  "12-months": "Previous 12 months",
  custom: "Previous period",
};

function TransactionDetails({ selection }: { selection: Selection }) {
  const ledger = useLedger();
  const [view, setView] = useState<"selected" | "previous">("selected");
  const showPrior = !!selection.prior && view === "previous";
  const { range, txns } = showPrior ? selection.prior! : selection;
  return (
    <div className="space-y-3">
      {selection.prior && (
        <Segmented
          value={view}
          onChange={setView}
          options={[{ value: "selected", label: "This period" }, { value: "previous", label: "Previous" }]}
        />
      )}
      <p className="text-sm text-ink-3">{formatAnalyticsRange(range)} · {txns.length} {txns.length === 1 ? "transaction" : "transactions"}</p>
      {txns.length
        ? <GroupedTxns key={view} txns={txns} ledger={ledger} />
        : <EmptyState title="No matching transactions" />}
    </div>
  );
}

function Stat({ icon: Icon, label, children, hint }: { icon: typeof Gauge; label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <Card className="min-w-0 p-3.5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-ink-3">
        <Icon className="size-3.5 text-brand" aria-hidden="true" />
        {label}
      </p>
      <div className="mt-1.5 truncate text-lg leading-tight font-semibold">{children}</div>
      {hint && <div className="mt-0.5 truncate text-xs text-ink-3">{hint}</div>}
    </Card>
  );
}

function FlowFigure({ label, amount, before, tone, goodWhen }: { label: string; amount: number; before: number; tone: "income" | "expense"; goodWhen: "up" | "down" }) {
  return (
    <div className="min-w-0 rounded-2xl bg-pale/60 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-xs text-ink-3">
        <span className="size-2 rounded-full" style={{ background: `var(--color-${tone})` }} aria-hidden="true" />
        {label}
      </p>
      <Money minor={amount} className="mt-0.5 block truncate text-base font-semibold" />
      <Change amount={amount} before={before} goodWhen={goodWhen} />
    </div>
  );
}

export default function AnalyticsPage() {
  const ledger = useLedger();
  const { hidden, fmt } = useMoney();
  const today = todayISO();
  const [period, setPeriod] = useState<AnalyticsPeriod>("this-month");
  const [custom, setCustom] = useState<DateRange>();
  const [selectedAccountId, setAccountId] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);
  const accountId = ledger.accountById.has(selectedAccountId) ? selectedAccountId : "";
  const from = custom?.from ?? `${monthKey(today)}-01`;
  const to = custom?.to ?? today;
  const { current, previous } = useMemo(() => analyticsRanges(period, today, { from, to }), [period, today, from, to]);
  const report = useMemo(() => analyticsReport(ledger.txns, accountId, current, previous), [ledger.txns, accountId, current, previous]);
  const { totals, priorTotals, activity, priorActivity } = report;

  const insights = useMemo(() => {
    const end = periodEnd(period, current);
    const days = rangeDays(current, today, end);
    const priorDays = rangeDays(previous, today);
    const expenses = activity.filter((txn) => txn.type === "expense");
    const perDay = new Map<string, number>();
    for (const txn of expenses) perDay.set(txn.date, (perDay.get(txn.date) ?? 0) + txn.amountMinor);
    const biggestDay = [...perDay.entries()].sort((a, b) => b[1] - a[1])[0];
    const pace = spendingPace(activity, priorActivity, current, previous, today);
    const lastIndex = days.elapsed - 1;
    const paceNow = pace[lastIndex]?.current ?? totals.expense;
    const paceBefore = pace[lastIndex]?.previous ?? null;
    return {
      days,
      dailyAverage: Math.round(totals.expense / days.elapsed),
      priorDailyAverage: Math.round(priorTotals.expense / priorDays.elapsed),
      end,
      projected: days.elapsed < days.total ? Math.round((totals.expense / days.elapsed) * days.total) : null,
      noSpendDays: days.elapsed - perDay.size,
      biggestDay,
      expenseCount: expenses.length,
      pace,
      paceGap: paceBefore === null ? null : paceNow - paceBefore,
      weekdays: weekdaySpending(activity, current, today),
      payees: topPayees(activity),
      accounts: spendingByAccount(activity, (id) => ledger.accountById.get(id)?.name ?? "Unknown account"),
      largest: largestExpenses(activity),
    };
  }, [period, activity, priorActivity, current, previous, today, totals.expense, priorTotals.expense, ledger.accountById]);

  const credit = useMemo(() => {
    const cards = ledger.activeAccounts.filter((account) => (
      account.type === "credit" && account.openingDate <= today && (!accountId || account.id === accountId)
    ));
    if (!cards.length) return [];
    return [...accountBalances(cards, ledger.txns.filter((txn) => txn.date <= today)).values()];
  }, [ledger.activeAccounts, ledger.txns, accountId, today]);

  const net = totals.income - totals.expense;
  const priorNet = priorTotals.income - priorTotals.expense;
  const savingsRate = totals.income > 0 ? Math.round((net / totals.income) * 100) : null;
  const spentShare = totals.income > 0 ? Math.min(100, (totals.expense / totals.income) * 100) : 0;
  const compareLabel = COMPARE_LABEL[period];
  const hasSpending = insights.expenseCount > 0;
  const expensesOf = (txns: Txn[], match: (txn: Txn) => boolean) => txns.filter((txn) => txn.type === "expense" && match(txn));
  const open = (title: string, match: (txn: Txn) => boolean) => setSelection({
    title,
    range: current,
    txns: expensesOf(activity, match),
    prior: { range: previous, txns: expensesOf(priorActivity, match) },
  });

  return (
    <>
      <PageHeader title="Analytics" />
      {!ledger.ready ? <Loading /> : (
        <div className="space-y-4 px-4 pb-4">
          <div className="space-y-2">
            <AnalyticsFilters
              period={period}
              custom={{ from, to }}
              today={today}
              accounts={ledger.accounts}
              balances={ledger.balances}
              availableFunds={ledger.totals.availableFunds}
              accountId={accountId}
              onPeriod={(next, range) => { setPeriod(next); if (range) setCustom(range); }}
              onAccount={setAccountId}
            />
            <p className="px-1 text-xs text-ink-3">
              <span className="font-medium text-ink-2">{formatAnalyticsRange(current, today)}</span>
              {" · compared with "}{formatAnalyticsRange(previous, today)}
            </p>
          </div>

          {/* Headline: what's left after spending, and how income and spending moved. */}
          <Card className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-ink-3">Net cash flow</p>
                <BigMoney minor={net} className={cx("block text-[2rem] leading-tight", net < 0 && "text-expense")} />
              </div>
              <div className="shrink-0 pt-1 text-right">
                <Change amount={net} before={priorNet} goodWhen="up" className="justify-end" />
                <p className="text-[0.7rem] text-ink-3">vs {compareLabel.toLowerCase()}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FlowFigure label="Income" amount={totals.income} before={priorTotals.income} tone="income" goodWhen="up" />
              <FlowFigure label="Spent" amount={totals.expense} before={priorTotals.expense} tone="expense" goodWhen="down" />
            </div>
            {savingsRate !== null ? (
              <div>
                <div className="mb-1.5 flex justify-between text-xs">
                  <span className="text-ink-2">Spent {Math.round(spentShare)}% of income</span>
                  <span className={cx("font-medium", savingsRate >= 0 ? "text-income" : "text-expense")}>
                    {savingsRate >= 0 ? `Saved ${savingsRate}%` : `Overspent ${Math.abs(savingsRate)}%`}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-pale" aria-hidden="true">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(2, spentShare)}%`, background: spentShare >= 100 ? "var(--color-expense)" : "var(--color-brand)" }} />
                </div>
              </div>
            ) : (
              <p className="text-xs text-ink-3">No income recorded in this period, so there&apos;s no savings rate yet.</p>
            )}
          </Card>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Stat icon={Gauge} label="Daily average" hint={<>{compareLabel}: <Money minor={insights.priorDailyAverage} /></>}>
              <Money minor={insights.dailyAverage} />
            </Stat>
            {insights.projected !== null ? (
              <Stat icon={TrendingUp} label="On track to spend" hint={`by ${formatDay(insights.end)} at this pace`}>
                <Money minor={insights.projected} />
              </Stat>
            ) : (
              <Stat icon={ReceiptText} label="Expenses" hint={`over ${insights.days.total} days`}>
                {insights.expenseCount}
              </Stat>
            )}
            <Stat
              icon={CalendarCheck}
              label="No-spend days"
              hint={`out of ${insights.days.elapsed} ${insights.days.elapsed === 1 ? "day" : "days"}`}
            >
              {insights.noSpendDays}
            </Stat>
            <Stat icon={Flame} label="Biggest day" hint={insights.biggestDay ? formatDay(insights.biggestDay[0]) : "No spending yet"}>
              {insights.biggestDay ? <Money minor={insights.biggestDay[1]} /> : "—"}
            </Stat>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            <Card className="min-w-0">
              <SectionTitle>Spending pace</SectionTitle>
              <p className="mb-3 px-1 text-sm text-ink-2">
                {!hasSpending
                  ? "No spending in this period yet."
                  : insights.paceGap === null || insights.paceGap === 0
                    ? "Running total of what you've spent, day by day."
                    : hidden
                      ? `You're ${insights.paceGap < 0 ? "behind" : "ahead of"} ${compareLabel.toLowerCase()}'s pace.`
                      : <>
                          <span className={cx("font-semibold", insights.paceGap < 0 ? "text-income" : "text-expense")}>
                            {fmt(Math.abs(insights.paceGap))} {insights.paceGap < 0 ? "less" : "more"}
                          </span>
                          {` than ${compareLabel.toLowerCase()} by this point.`}
                        </>}
              </p>
              {hasSpending && !hidden && <PaceChart data={insights.pace} previousLabel={compareLabel} />}
            </Card>

            <FlowReport
              data={report.buckets}
              hasActivity={activity.length > 0}
              onSelect={(bucket) => setSelection({ title: formatAnalyticsRange(bucket, today), range: bucket, txns: activity.filter((txn) => txn.date >= bucket.from && txn.date <= bucket.to) })}
            />

            <Card className="min-w-0">
              <SectionTitle>Where it went</SectionTitle>
              {report.categories.length ? (
                <BarList
                  total={totals.expense}
                  onSelect={(category) => open(category, (txn) => (txn.category || "Other") === category)}
                  rows={report.categories.map(({ category, amount, before }) => ({
                    key: category,
                    label: category,
                    amount,
                    before,
                    icon: iconFor("expense", category),
                  }))}
                />
              ) : <EmptyState title="No spending" />}
            </Card>

            {hasSpending && (
              <Card className="min-w-0">
                <SectionTitle>Top payees</SectionTitle>
                <BarList
                  total={totals.expense}
                  limit={5}
                  onSelect={(key) => {
                    const payee = insights.payees.find((row) => row.key === key);
                    if (payee) setSelection({ title: payee.label, range: current, txns: payee.txns });
                  }}
                  rows={insights.payees.map(({ key, label, amount, count }) => ({
                    key,
                    label,
                    amount,
                    detail: `${count} ${count === 1 ? "time" : "times"}`,
                  }))}
                />
              </Card>
            )}

            {hasSpending && (
              <Card className="min-w-0">
                <SectionTitle>Spending by weekday</SectionTitle>
                <p className="mb-3 px-1 text-sm text-ink-2">
                  {(() => {
                    const peak = [...insights.weekdays].sort((a, b) => b.average - a.average)[0];
                    return <>You spend the most on <span className="font-semibold">{peak.name}s</span>, about <Money minor={peak.average} className="font-semibold" /> on average.</>;
                  })()}
                </p>
                {hidden ? (
                  <ul className="grid grid-cols-7 gap-1 text-center text-xs text-ink-3">
                    {insights.weekdays.map(({ day }) => <li key={day}>{day}</li>)}
                  </ul>
                ) : <WeekdayChart data={insights.weekdays} />}
              </Card>
            )}

            {!accountId && insights.accounts.length > 1 && (
              <Card className="min-w-0">
                <SectionTitle>By account</SectionTitle>
                <BarList
                  total={totals.expense}
                  onSelect={(id) => open(ledger.accountById.get(id)?.name ?? "Account", (txn) => txn.accountId === id)}
                  rows={insights.accounts.map(({ key, label, amount, count }) => ({
                    key,
                    label,
                    amount,
                    before: priorActivity.reduce((sum, txn) => sum + (txn.type === "expense" && txn.accountId === key ? txn.amountMinor : 0), 0),
                    detail: `${count} ${count === 1 ? "expense" : "expenses"}`,
                  }))}
                />
              </Card>
            )}

            {insights.largest.length > 0 && (
              <Card className="min-w-0 p-2">
                <div className="px-2 pt-2"><SectionTitle>Largest expenses</SectionTitle></div>
                <ul>
                  {insights.largest.map((txn) => <li key={txn.id}><TxnRow t={txn} ledger={ledger} /></li>)}
                </ul>
              </Card>
            )}

            {credit.length > 0 && (
              <Card className="min-w-0">
                <SectionTitle>Credit utilisation</SectionTitle>
                <p className="mb-3 px-1 text-xs text-ink-3">As of today</p>
                <div className="space-y-4">
                  {credit.map(({ account, balance, utilisation, available }) => (
                    <div key={account.id} className="flex items-center gap-4">
                      {!hidden && utilisation !== undefined && <UtilisationRing value={utilisation} size={84} />}
                      <div className="min-w-0 text-sm">
                        <p className="truncate font-semibold">{account.name}</p>
                        <p className="text-ink-3">
                          <Money minor={balance} /> {account.creditLimitMinor ? <>of <Money minor={account.creditLimitMinor} /></> : "outstanding"}
                        </p>
                        {!!account.creditLimitMinor && <p className="text-ink-3"><Money minor={available ?? 0} /> available</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
          <p className="px-1 text-xs text-ink-3">Split expenses count the full purchase amount. Transfers and card payments aren&apos;t counted as spending.</p>

          <Sheet open={selection !== null} onClose={() => setSelection(null)} title={selection?.title ?? "Transactions"}>
            {selection && <TransactionDetails key={selection.title} selection={selection} />}
          </Sheet>
        </div>
      )}
    </>
  );
}
