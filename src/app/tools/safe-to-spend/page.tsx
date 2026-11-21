"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, CalendarDays, CreditCard, OctagonAlert, Receipt, Wallet } from "lucide-react";
import { BigMoney, Card, cx, Loading, Money, PageHeader, SectionTitle } from "@/components/ui";
import { daysLabel } from "@/components/tools-ui";
import { addDays, formatDay, fromISO, toISO } from "@/lib/dates";
import { useMoney } from "@/lib/privacy";
import { formatPaydays } from "@/lib/tools";
import { useSafeToSpend } from "@/lib/tools-hooks";

function Row({ op, label, detail, children, strong }: { op?: "−" | "+" | "=" | "÷"; label: ReactNode; detail?: ReactNode; children: ReactNode; strong?: boolean }) {
  return (
    <div className={cx("flex items-baseline gap-2 py-2", strong && "font-semibold")}>
      <span className="num w-4 shrink-0 text-center text-ink-3" aria-hidden="true">{op}</span>
      <span className="min-w-0 flex-1">
        <span className={cx("block text-sm", !strong && "text-ink-2")}>{label}</span>
        {detail && <span className="block text-xs font-normal text-ink-3">{detail}</span>}
      </span>
      <span className="shrink-0 text-sm">{children}</span>
    </div>
  );
}

export default function SafeToSpendPage() {
  const { ledger, allowance, paydays, today, ready } = useSafeToSpend();
  const { hidden } = useMoney();
  const { cash, bills, billsTotal, cards, cardsTotal, instalmentsTotal, savings, spendable, spentToday, perDay, leftToday, cycle } = allowance;
  const over = spendable < 0 || perDay <= 0;
  const addBack = spendable < 0 ? 0 : spentToday;
  const usedShare = perDay > 0 ? Math.min(100, (spentToday / perDay) * 100) : 100;
  const isPayday = cycle.start === today;

  return (
    <>
      <PageHeader title="Safe to spend" back="/tools" />
      {!ready ? <Loading /> : (
        <div className="space-y-4 px-4 pb-4">
          <Card className="space-y-3">
            <div>
              <p className="text-sm text-ink-3">Safe to spend today</p>
              <BigMoney minor={perDay} className={cx("block text-[2.4rem] leading-tight tracking-tight", over && "text-expense")} centsClass="text-[0.55em]" />
              <p className="text-sm text-ink-2">
                Each day for the next {daysLabel(cycle.daysLeft)}, until payday on <span className="font-medium">{formatDay(cycle.nextPayday)}</span>
              </p>
            </div>
            {over ? (
              <p className="flex items-start gap-2 rounded-2xl bg-expense/10 px-3 py-2.5 text-sm text-expense">
                <OctagonAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{spendable < 0 ? <>What&apos;s due before payday is <Money minor={-spendable} className="font-semibold" /> more than the cash you have.</> : "Nothing is left to spend before payday."} Try to hold off on spending, or move money in.</span>
              </p>
            ) : (
              <div>
                <div className="mb-1.5 flex justify-between text-xs">
                  <span className="text-ink-2">Spent today <Money minor={spentToday} /></span>
                  {leftToday >= 0
                    ? <span className="font-medium text-income"><Money minor={leftToday} /> left</span>
                    : <span className="inline-flex items-center gap-1 font-medium text-expense"><AlertTriangle className="size-3.5" aria-hidden="true" />Over by <Money minor={-leftToday} /></span>}
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-pale" aria-hidden="true">
                  {!hidden && <div className="h-full rounded-full" style={{ width: `${Math.max(spentToday > 0 ? 2 : 0, usedShare)}%`, background: leftToday < 0 ? "var(--color-expense)" : "var(--color-brand)" }} />}
                </div>
                <p className="mt-2 text-xs text-ink-3">Whatever you don&apos;t spend today rolls into tomorrow&apos;s number.</p>
              </div>
            )}
            {isPayday && <p className="text-xs text-ink-3">It&apos;s payday. If your pay hasn&apos;t been recorded yet, add it so it counts.</p>}
          </Card>

          <Card>
            <SectionTitle>How it&apos;s worked out</SectionTitle>
            <div className="divide-y divide-line">
              <Row label="Cash and bank balances" detail="Cash and debit accounts, as of today"><Money minor={cash} /></Row>
              <Row op="−" label="Bills before payday" detail={bills.length ? `${bills.length} expected` : "None expected"}><Money minor={billsTotal} /></Row>
              <Row op="−" label="Credit card balances" detail="Charges count as soon as you make them"><Money minor={cardsTotal} /></Row>
              <Row op="−" label="Instalments due before payday"><Money minor={instalmentsTotal} /></Row>
              <Row op="−" label="Set aside for savings" detail="Savings goals are coming later"><Money minor={savings} /></Row>
               {addBack > 0 && <Row op="+" label="Everyday spending today" detail="Added back so today's number holds all day"><Money minor={addBack} /></Row>}
              <Row op="=" label="Spendable until payday" strong><Money minor={spendable + addBack} className={spendable < 0 ? "text-expense" : undefined} /></Row>
              <Row op="÷" label={`${daysLabel(cycle.daysLeft)} left`} detail={cycle.daysLeft === 1 ? "Just today" : `Today to ${formatDay(toISO(addDays(fromISO(cycle.nextPayday), -1)))}`}>{cycle.daysLeft}</Row>
              <Row op="=" label="Safe to spend today" strong><Money minor={perDay} className={over ? "text-expense" : "text-brand"} /></Row>
            </div>
          </Card>

          {bills.length > 0 && (
            <Card className="p-2">
              <div className="px-2 pt-2"><SectionTitle>Bills before payday</SectionTitle></div>
              <ul>
                {bills.map((b) => (
                  <li key={b.key} className="flex items-center gap-3 px-2 py-2.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-pale text-brand" aria-hidden="true"><Receipt className="size-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{b.label}</span>
                      <span className={cx("block text-xs", b.late ? "text-gold" : "text-ink-3")}>
                        {b.late ? <span className="inline-flex items-center gap-1"><AlertTriangle className="size-3" aria-hidden="true" />Expected {formatDay(b.date)}, not recorded yet</span> : `Expected ${formatDay(b.date)}`}
                        {ledger.accountById.get(b.accountId)?.type === "credit" && " · on card"}
                      </span>
                    </span>
                    <Money minor={b.amount} className="shrink-0 text-sm font-semibold" />
                  </li>
                ))}
              </ul>
              <p className="px-2 pb-2 text-xs text-ink-3">Typical amounts from your history. Each one drops off once it&apos;s recorded.</p>
            </Card>
          )}

          {cards.length > 0 && (
            <Card className="p-2">
              <div className="px-2 pt-2"><SectionTitle>Credit cards</SectionTitle></div>
              <ul>
                {cards.map((c) => (
                  <li key={c.account.id} className="px-2 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-pale text-brand" aria-hidden="true"><CreditCard className="size-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{c.account.name}</span>
                        <span className="block text-xs text-ink-3">
                          {c.dueBeforePayday > 0 && c.dueDate
                            ? <><Money minor={c.dueBeforePayday} /> due {formatDay(c.dueDate)}{c.amount > c.dueBeforePayday && <>, <Money minor={c.amount - c.dueBeforePayday} /> not due yet</>}</>
                            : "Nothing due before payday, counted now anyway"}
                        </span>
                      </span>
                      <Money minor={c.amount} className="shrink-0 text-sm font-semibold" />
                    </div>
                    {c.instalmentItems.map((i) => (
                      <div key={i.label + i.dueDate} className="mt-1.5 ml-12 flex justify-between gap-2 text-xs text-ink-3">
                        <span className="truncate">{i.label} · due {formatDay(i.dueDate)}</span>
                        <Money minor={i.amount} className="shrink-0 font-medium text-ink-2" />
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
              <p className="px-2 pb-2 text-xs text-ink-3">Later instalment payments wait for the pay cycle they&apos;re due in.</p>
            </Card>
          )}

          <Card>
            <SectionTitle action={<Link href="/settings/payday" className="inline-flex min-h-10 items-center px-1 text-sm font-medium text-brand">Payday settings</Link>}>Paydays</SectionTitle>
            <p className="flex items-center gap-2 px-1 text-sm text-ink-2">
              <CalendarDays className="size-4 shrink-0 text-brand" aria-hidden="true" />
              {formatPaydays(paydays)} of the month
            </p>
            <p className="mt-1 px-1 text-xs text-ink-3">
              This pay cycle: {formatDay(cycle.start)} to {formatDay(cycle.nextPayday)}.{paydays.some((d) => d > 28) && " In shorter months, pay falls on the last day."}
            </p>
          </Card>

          <p className="flex items-start gap-2 px-1 text-xs text-ink-3">
            <Wallet className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            Bills are recurring expenses spotted in your history. Card payments and transfers between your accounts don&apos;t change this number.
          </p>
        </div>
      )}
    </>
  );
}
