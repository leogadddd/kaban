"use client";

import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Card, EmptyState, Loading, Money, PageHeader, Progress } from "@/components/ui";
import { formatDay, todayISO } from "@/lib/dates";
import { useLedger } from "@/lib/hooks";

export default function InstalmentsPage() {
  const ledger = useLedger();
  const today = todayISO();
  const plans = ledger.txns
    .filter((t) => t.state === "active" && t.arrangement === "instalment")
    .map((t) => {
      const entries = ledger.instalments.filter((e) => e.transactionId === t.id).sort((a, b) => a.index - b.index);
      const billed = entries.filter((e) => e.statementDate <= today);
      return { t, entries, billed, remaining: entries.filter((e) => e.statementDate > today).reduce((s, e) => s + e.amountMinor, 0) };
    });
  const totalRemaining = plans.reduce((s, p) => s + p.remaining, 0);

  return (
    <>
      <PageHeader title="Instalments" back="/home" subtitle={<>Still to be billed <Money minor={totalRemaining} className="font-semibold text-ink" /></>} />
      <div className="space-y-4 px-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5 lg:space-y-0">
        {!ledger.ready ? (
          <Loading />
        ) : plans.length ? (
          plans.map(({ t, entries, billed, remaining }) => (
            <Card key={t.id} className="space-y-3">
              <Link href={`/add?edit=${t.id}`} className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{t.description}</p>
                  <p className="text-xs text-ink-3">
                    {ledger.accountById.get(t.accountId)?.name} · bought {formatDay(t.date)} · {t.instalmentCount} months
                  </p>
                </div>
                <div className="text-right">
                  <Money minor={t.amountMinor} className="font-semibold" />
                  <p className="text-xs text-ink-3">one purchase</p>
                </div>
              </Link>
              <div className="flex items-center gap-3">
                <Progress value={(billed.length / entries.length) * 100} className="flex-1" />
                <span className="num text-xs text-ink-3">{billed.length}/{entries.length} billed</span>
              </div>
              <ol className="grid grid-cols-2 gap-1.5 text-xs">
                {entries.map((e) => {
                  const done = e.statementDate <= today;
                  return (
                    <li key={e.id} className={done ? "flex justify-between rounded-xl bg-pale px-2.5 py-2 text-ink-3" : "flex justify-between rounded-xl border border-line px-2.5 py-2"}>
                      <span>
                        <b className="num">{e.index}</b> · {formatDay(e.statementDate)}
                      </span>
                      <Money minor={e.amountMinor} className="font-medium" />
                    </li>
                  );
                })}
              </ol>
              <p className="text-xs text-ink-3">
                Remaining to bill <Money minor={remaining} className="font-semibold text-ink" /> · statuses are by statement date (billed once it has closed).
              </p>
            </Card>
          ))
        ) : (
          <EmptyState icon={<CalendarClock className="size-6" />} title="No instalment plans" body="Pick “Instalment” when adding a credit-card purchase to spread its billing over months." />
        )}
      </div>
    </>
  );
}
