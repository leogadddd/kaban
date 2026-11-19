"use client";

import { useMemo, useState } from "react";
import { CategoryBars, FlowChart, UtilisationRing } from "@/components/charts";
import { Card, Chip, EmptyState, Loading, Money, PageHeader, SectionTitle } from "@/components/ui";
import { formatMonth } from "@/lib/dates";
import { byCategory, lastNMonths, monthlyFlow } from "@/lib/finance";
import { useLedger } from "@/lib/hooks";

export default function AnalyticsPage() {
  const ledger = useLedger();
  const months = useMemo(() => lastNMonths(6), []);
  const [month, setMonth] = useState(months[months.length - 1]);
  const flow = useMemo(() => monthlyFlow(ledger.txns, months), [ledger.txns, months]);
  const cats = useMemo(() => byCategory(ledger.txns, month), [ledger.txns, month]);
  const thisMonth = flow.find((f) => f.month === month)!;
  const cards = ledger.activeAccounts.filter((a) => a.type === "credit");

  return (
    <>
      <PageHeader title="Analytics" />
      {!ledger.ready ? (
        <Loading />
      ) : (
        <div className="space-y-5 px-4">
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label="Month">
            {[...months].reverse().map((m) => (
              <Chip key={m} active={m === month} onClick={() => setMonth(m)}>{formatMonth(m)}</Chip>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 lg:gap-4">
            <Card className="p-3"><p className="text-[0.7rem] text-ink-3">Income</p><Money minor={thisMonth.income} compact className="font-semibold text-income" /></Card>
            <Card className="p-3"><p className="text-[0.7rem] text-ink-3">Spent</p><Money minor={thisMonth.expense} compact className="font-semibold" /></Card>
            <Card className="p-3"><p className="text-[0.7rem] text-ink-3">Net</p><Money minor={thisMonth.income - thisMonth.expense} compact tone="auto" className="font-semibold" /></Card>
          </div>

          <div className="space-y-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5 lg:space-y-0">
          <Card>
            <SectionTitle>Income vs expenses · 6 months</SectionTitle>
            <FlowChart data={flow} />
          </Card>

          <Card>
            <SectionTitle>Spending by category · {formatMonth(month)}</SectionTitle>
            {cats.length ? <CategoryBars data={cats} /> : <EmptyState title="No spending this month" />}
          </Card>

          {cards.length > 0 && (
            <Card>
              <SectionTitle>Credit utilisation</SectionTitle>
              <div className="space-y-4">
                {cards.map((c) => {
                  const b = ledger.balances.get(c.id)!;
                  return (
                    <div key={c.id} className="flex items-center gap-4">
                      <UtilisationRing value={b.utilisation ?? 0} size={84} />
                      <div className="text-sm">
                        <p className="font-semibold">{c.name}</p>
                        <p className="text-ink-3"><Money minor={b.balance} /> of <Money minor={c.creditLimitMinor ?? 0} /></p>
                        <p className="text-ink-3"><Money minor={b.available ?? 0} /> available</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
          </div>
          <p className="px-1 pb-2 text-xs text-ink-3">Spending counts expenses only. Card payments, transfers, reimbursements and instalment schedules are excluded to avoid double counting.</p>
        </div>
      )}
    </>
  );
}
