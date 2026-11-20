"use client";

import Link from "next/link";
import { CalendarClock, CreditCard, Plus } from "lucide-react";
import { useState } from "react";
import { cycleInfo } from "@/lib/billing";
import { daysBetween, formatDay, formatDayLong, todayISO } from "@/lib/dates";
import { billedOnStatement } from "@/lib/finance";
import type { Ledger } from "@/lib/hooks";
import { BankLogo } from "./bank-logo";
import { bankFor } from "@/lib/banks";
import { BigMoney, ButtonLink, Card, Chip, EmptyState, Money, SectionTitle } from "./ui";
import { UtilisationRing } from "./charts";
import { TxnRow } from "./txn-row";
import { useHideVoided } from "@/lib/display-prefs";

export function CreditOverview({ ledger, accountId, showSelector = true }: { ledger: Ledger; accountId?: string; showSelector?: boolean }) {
  const cards = ledger.activeAccounts.filter((a) => a.type === "credit");
  const [selected, setSelected] = useState<string | undefined>(accountId);
  const acc = cards.find((c) => c.id === (accountId ?? selected)) ?? cards[0];
  const today = todayISO();
  const [hideVoided] = useHideVoided();

  const view = (() => {
    if (!acc) return null;
    const b = ledger.balances.get(acc.id)!;
    const cyc = cycleInfo(acc, today);
    const current = billedOnStatement(acc, cyc.nextClosing, ledger.txns, ledger.instalments);
    const dueStatement = billedOnStatement(acc, cyc.upcomingDueStatement, ledger.txns, ledger.instalments);
    const upcomingInst = ledger.instalments
      .filter((e) => e.accountId === acc.id && e.statementDate >= cyc.nextClosing && ledger.txns.find((t) => t.id === e.transactionId)?.state === "active")
      .sort((a, b) => a.statementDate.localeCompare(b.statementDate))
      .slice(0, 4);
    const activity = ledger.txns.filter((t) => (t.accountId === acc.id || t.toAccountId === acc.id) && !(hideVoided && t.state === "void")).slice(0, 5);
    return { b, cyc, current, dueStatement, upcomingInst, activity };
  })();

  if (!acc || !view)
    return (
      <EmptyState
        icon={<CreditCard className="size-6" />}
        title="No credit cards yet"
        body="Add a credit card to track what you owe the bank, billing cycles and instalments."
        action={
          <ButtonLink href="/accounts/new?type=credit">
            <Plus className="size-4" /> Add credit card
          </ButtonLink>
        }
      />
    );

  const { b, cyc, current, dueStatement, upcomingInst, activity } = view;
  const daysToDue = daysBetween(today, cyc.upcomingDue);

  return (
    <div className="space-y-4">
      {showSelector && cards.length > 1 && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label="Choose card">
          {cards.map((c) => (
            <Chip key={c.id} active={c.id === acc.id} onClick={() => setSelected(c.id)}>
              <CreditCard className="size-4" /> {c.name}
            </Chip>
          ))}
        </div>
      )}

      <Card className="overflow-hidden bg-night p-5 text-white dark:border-white/6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm text-white/60">
              {bankFor(acc) && <BankLogo bank={bankFor(acc)!} size={22} />}
              {acc.name}
              {acc.last4 ? ` · •••• ${acc.last4}` : ""}
            </p>
            <p className="mt-1 text-xs tracking-wide text-white/50 uppercase">Outstanding</p>
            <BigMoney minor={b.balance} className="block text-[2.4rem] leading-none" centsClass="text-2xl" />
          </div>
          <div className="rounded-full bg-surface p-1">
            <UtilisationRing value={b.utilisation ?? 0} size={92} />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-white/8 p-3">
            <p className="text-xs text-white/55">Available</p>
            <Money minor={b.available ?? 0} className="font-semibold" />
          </div>
          <div className="rounded-2xl bg-white/8 p-3">
            <p className="text-xs text-white/55">Limit</p>
            <Money minor={acc.creditLimitMinor ?? 0} className="font-semibold" />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-ink-3">
            <CalendarClock className="size-3.5" /> Next due
          </p>
          <p className="mt-1 text-lg font-semibold">{formatDay(cyc.upcomingDue)}</p>
          <p className={daysToDue <= 5 ? "text-xs font-medium text-expense" : "text-xs text-ink-3"}>
            {daysToDue === 0 ? "Due today" : `in ${daysToDue} day${daysToDue === 1 ? "" : "s"}`}
          </p>
          <p className="mt-2 text-xs text-ink-3">Statement {formatDay(cyc.upcomingDueStatement)}</p>
          <Money minor={dueStatement.total} className="text-sm font-semibold" />
        </Card>
        <Card className="p-4">
          <p className="text-xs text-ink-3">Current cycle</p>
          <Money minor={current.total} className="mt-1 block text-lg font-semibold" />
          <p className="text-xs text-ink-3">
            {formatDay(cyc.lastClosing)} – {formatDay(cyc.nextClosing)}
          </p>
          <p className="mt-2 text-xs text-ink-3">{current.items.length} billed item{current.items.length === 1 ? "" : "s"}</p>
        </Card>
      </div>

      <ButtonLink href={`/add?type=card_payment&to=${acc.id}`} wrapperClassName="grid">Record card payment</ButtonLink>

      {upcomingInst.length > 0 && (
        <section>
          <SectionTitle action={<Link href="/instalments" className="text-sm text-brand">All</Link>}>Scheduled instalments</SectionTitle>
          <Card className="divide-y divide-line p-0">
            {upcomingInst.map((e) => {
              const t = ledger.txns.find((x) => x.id === e.transactionId)!;
              return (
                <div key={e.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t.description || t.category}</p>
                    <p className="text-xs text-ink-3">
                      {e.index}/{e.count} · billed {formatDayLong(e.statementDate)}
                    </p>
                  </div>
                  <Money minor={e.amountMinor} className="font-semibold" />
                </div>
              );
            })}
          </Card>
        </section>
      )}

      <section>
        <SectionTitle action={<Link href={`/accounts/view?id=${acc.id}`} className="text-sm text-brand">Open card</Link>}>Recent charges & payments</SectionTitle>
        <Card className="p-1.5">
          {activity.length ? activity.map((t) => <TxnRow key={t.id} t={t} ledger={ledger} perspective={acc.id} />) : <p className="p-4 text-sm text-ink-3">No activity on this card yet.</p>}
        </Card>
      </section>
    </div>
  );
}
