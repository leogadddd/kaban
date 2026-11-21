"use client";

import { useMemo, useState, type ComponentProps } from "react";
import { CategoryBars, FlowChart, UtilisationRing } from "@/components/charts";
import { DateField } from "@/components/date-field";
import { GroupedTxns } from "@/components/txn-row";
import { Card, EmptyState, inputCls, Loading, Money, PageHeader, SectionTitle, Segmented, Sheet } from "@/components/ui";
import { analyticsRanges, analyticsReport, formatAnalyticsRange, type AnalyticsPeriod, type DateRange } from "@/lib/analytics";
import { monthKey, todayISO } from "@/lib/dates";
import { accountBalances } from "@/lib/finance";
import { useLedger, type Ledger } from "@/lib/hooks";
import { useMoney } from "@/lib/privacy";

const PERIODS: { value: AnalyticsPeriod; label: string }[] = [
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "3-months", label: "Last 3 full months" },
  { value: "6-months", label: "Last 6 full months" },
  { value: "12-months", label: "Last 12 full months" },
  { value: "custom", label: "Custom dates" },
];

type Selection = { category: string } | { range: DateRange };
type Report = ReturnType<typeof analyticsReport>;

function SummaryCard({ label, amount, before, tone }: {
  label: string;
  amount: number;
  before: number;
  tone?: ComponentProps<typeof Money>["tone"];
}) {
  return (
    <Card className="min-w-0 p-3 lg:p-4">
      <p className="text-xs text-ink-3">{label}</p>
      <p className="mt-0.5 wrap-anywhere text-base font-semibold sm:text-lg lg:text-2xl"><Money minor={amount} tone={tone} /></p>
      <p className="mt-1 wrap-anywhere text-xs text-ink-3">
        <Money minor={amount - before} sign /> <span className="block">change</span>
      </p>
    </Card>
  );
}

function TransactionDetails({ selection, report, ledger, current, previous }: {
  selection: Selection;
  report: Report;
  ledger: Ledger;
  current: DateRange;
  previous: DateRange;
}) {
  const [view, setView] = useState<"selected" | "previous">("selected");
  const category = "category" in selection ? selection.category : null;
  const usePrevious = category !== null && view === "previous";
  const range = "range" in selection ? selection.range : usePrevious ? previous : current;
  const txns = (usePrevious ? report.priorActivity : report.activity).filter((txn) => (
    txn.date >= range.from && txn.date <= range.to &&
    (category === null || (txn.type === "expense" && (txn.category || "Other") === category))
  ));
  return (
    <div className="space-y-3">
      {category !== null && (
        <Segmented
          value={view}
          onChange={setView}
          options={[{ value: "selected", label: "Selected period" }, { value: "previous", label: "Previous period" }]}
        />
      )}
      <p className="text-sm text-ink-3">{formatAnalyticsRange(range)}</p>
      {txns.length
        ? <GroupedTxns key={view} txns={txns} ledger={ledger} />
        : <EmptyState title="No matching transactions" />}
    </div>
  );
}

export default function AnalyticsPage() {
  const ledger = useLedger();
  const { hidden } = useMoney();
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
  const { totals, priorTotals } = report;
  const credit = useMemo(() => {
    const cards = ledger.activeAccounts.filter((account) => (
      account.type === "credit" && account.openingDate <= today && (!accountId || account.id === accountId)
    ));
    if (!cards.length) return [];
    return [...accountBalances(cards, ledger.txns.filter((txn) => txn.date <= today)).values()];
  }, [ledger.activeAccounts, ledger.txns, accountId, today]);

  return (
    <>
      <PageHeader title="Analytics" />
      {!ledger.ready ? <Loading /> : (
        <div className="space-y-5 px-4 pb-4">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 lg:max-w-xl lg:gap-3">
              <select className={`${inputCls} truncate px-3`} aria-label="Date range" value={period} onChange={(e) => setPeriod(e.target.value as AnalyticsPeriod)}>
                {PERIODS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
              </select>
              <select className={`${inputCls} truncate px-3`} aria-label="Account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">All accounts</option>
                {ledger.accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}{account.archived ? " (archived)" : ""}</option>
                ))}
              </select>
            </div>
            {period === "custom" && (
              <div className="grid grid-cols-2 gap-2 lg:max-w-xl lg:gap-3">
                <div className="min-w-0 space-y-1">
                  <label htmlFor="analytics-from" className="px-1 text-xs text-ink-3">From</label>
                  <DateField id="analytics-from" title="From date" compact value={from} max={to} onChange={(date) => setCustom({ from: date, to })} />
                </div>
                <div className="min-w-0 space-y-1">
                  <label htmlFor="analytics-to" className="px-1 text-xs text-ink-3">To</label>
                  <DateField id="analytics-to" title="To date" compact value={to} min={from} max={today} onChange={(date) => setCustom({ from, to: date })} />
                </div>
              </div>
            )}
            <p className="text-sm text-ink-3">
              <span className="font-medium text-ink">{formatAnalyticsRange(current)}</span>{" · vs "}
              {formatAnalyticsRange(previous)}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 lg:gap-4">
            <SummaryCard label="Income" amount={totals.income} before={priorTotals.income} tone="income" />
            <SummaryCard label="Spent" amount={totals.expense} before={priorTotals.expense} />
            <SummaryCard label="Net" amount={totals.income - totals.expense} before={priorTotals.income - priorTotals.expense} tone="auto" />
          </div>

          <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
            <Card className="min-w-0">
              <SectionTitle>Income vs. spending</SectionTitle>
              {report.activity.length
                ? <FlowChart data={report.buckets} onSelect={(range) => setSelection({ range })} />
                : <EmptyState title="No income or spending in this period" />}
            </Card>

            <Card className="min-w-0">
              <SectionTitle>Spending by category</SectionTitle>
              {report.categories.length
                ? <CategoryBars data={report.categories} onSelect={(category) => setSelection({ category })} />
                : <EmptyState title="No spending in either period" />}
            </Card>

            {credit.length > 0 && (
              <Card>
                <SectionTitle>Credit utilisation</SectionTitle>
                <p className="mb-3 text-xs text-ink-3">As of today</p>
                <div className="space-y-4">
                  {credit.map(({ account, balance, utilisation, available }) => (
                    <div key={account.id} className="flex items-center gap-4">
                      {!hidden && utilisation !== undefined && <UtilisationRing value={utilisation} size={84} />}
                      <div className="text-sm">
                        <p className="font-semibold">{account.name}</p>
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
          <p className="px-1 text-xs text-ink-3">Spending uses the full amount of each recorded expense, including split purchases. Transfers, card payments, refunds, reimbursements and instalment schedules are excluded.</p>

          <Sheet
            open={selection !== null}
            onClose={() => setSelection(null)}
            title={selection && "category" in selection ? selection.category : "Transactions"}
          >
            {selection && <TransactionDetails selection={selection} report={report} ledger={ledger} current={current} previous={previous} />}
          </Sheet>
        </div>
      )}
    </>
  );
}
