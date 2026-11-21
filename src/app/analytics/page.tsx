"use client";

import { useMemo, useState, type ComponentProps } from "react";
import { CategoryChart, FlowReport, UtilisationRing } from "@/components/charts";
import { GroupedTxns } from "@/components/txn-row";
import { Card, EmptyState, Loading, Money, PageHeader, SectionTitle, Segmented, Sheet } from "@/components/ui";
import { analyticsRanges, analyticsReport, formatAnalyticsRange, type AnalyticsPeriod, type DateRange } from "@/lib/analytics";
import { monthKey, todayISO } from "@/lib/dates";
import { accountBalances } from "@/lib/finance";
import { useLedger, type Ledger } from "@/lib/hooks";
import { useMoney } from "@/lib/privacy";
import { AnalyticsFilters } from "./filters";

type Selection = { category: string } | { range: DateRange };
type Report = ReturnType<typeof analyticsReport>;

function Summary({ rows }: { rows: { label: string; amount: number; before: number; tone?: ComponentProps<typeof Money>["tone"] }[] }) {
  return (
    <Card className="min-w-0 px-4 py-2.5">
      <table className="w-full table-fixed text-sm">
        <thead className="text-xs text-ink-3">
          <tr>
            <th scope="col" className="w-1/4"><span className="sr-only">Metric</span></th>
            <th scope="col" className="w-[40%] text-right font-normal">Amount</th>
            <th scope="col" className="text-right font-normal">Change</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map(({ label, amount, before, tone }) => (
            <tr key={label}>
              <th scope="row" className="py-2.5 text-left font-medium text-ink-2">{label}</th>
              <td className="wrap-anywhere pl-2 text-right font-semibold">
                <Money minor={amount} tone={tone} />
              </td>
              <td className="wrap-anywhere pl-2 text-right text-xs text-ink-3">
                {amount === before ? <span aria-label="No change">—</span> : <Money minor={amount - before} sign />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
          options={[{ value: "selected", label: "Selected" }, { value: "previous", label: "Previous" }]}
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
        <div className="space-y-4 px-4 pb-4">
          <div className="space-y-2">
            <AnalyticsFilters
              period={period}
              custom={{ from, to }}
              today={today}
              accounts={ledger.accounts}
              accountId={accountId}
              onPeriod={(next, range) => { setPeriod(next); if (range) setCustom(range); }}
              onAccount={setAccountId}
            />
            <p className="px-1 text-xs text-ink-3">
              <span className="font-medium text-ink-2">{formatAnalyticsRange(current, today)}</span>{" · vs "}
              {formatAnalyticsRange(previous, today)}
            </p>
          </div>

          <Summary rows={[
            { label: "Income", amount: totals.income, before: priorTotals.income, tone: "income" },
            { label: "Spent", amount: totals.expense, before: priorTotals.expense },
            { label: "Net", amount: totals.income - totals.expense, before: priorTotals.income - priorTotals.expense, tone: "auto" },
          ]} />

          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            <FlowReport data={report.buckets} hasActivity={report.activity.length > 0} onSelect={(range) => setSelection({ range })} />

            <Card className="min-w-0">
              <SectionTitle>Spending by category</SectionTitle>
              {report.categories.length
                ? <CategoryChart data={report.categories} onSelect={(category) => setSelection({ category })} />
                : <EmptyState title="No spending" />}
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
          <p className="px-1 text-xs text-ink-3">Split expenses include the full purchase amount.</p>

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
