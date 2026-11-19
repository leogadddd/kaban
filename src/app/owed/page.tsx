"use client";

import { SectionTabs } from "@/components/section-tabs";

import { HapticButton } from "@/components/haptic-button";
import Link from "next/link";
import { ChevronRight, HandCoins, Plus } from "lucide-react";
import { useState } from "react";
import { DebtSheet } from "@/components/debt-sheets";
import { Avatar, BigMoney, Button, Card, EmptyState, Loading, PageHeader, Progress, Segmented, Money } from "@/components/ui";
import { useLedger } from "@/lib/hooks";

export default function OwedPage() {
  const ledger = useLedger();
  const [filter, setFilter] = useState<"open" | "settled">("open");
  const [adding, setAdding] = useState(false);

  const byPerson = ledger.people
    .map((p) => {
      const ds = ledger.debtStatus.filter((d) => d.debt.personId === p.id);
      const total = ds.reduce((s, d) => s + d.debt.amountMinor, 0);
      const outstanding = ds.reduce((s, d) => s + Math.max(0, d.outstanding), 0);
      return { person: p, total, outstanding, count: ds.length, open: ds.filter((d) => !d.settled).length };
    })
    .filter((r) => r.count > 0 && (filter === "open" ? r.outstanding > 0 : r.outstanding === 0))
    .sort((a, b) => b.outstanding - a.outstanding);
  const totalOutstanding = ledger.debtStatus.reduce((s, d) => s + Math.max(0, d.outstanding), 0);
  const totalRepaid = ledger.debtStatus.reduce((s, d) => s + d.repaid, 0);

  return (
    <>
      <PageHeader
        title="Who Owes Me"

        action={<HapticButton onClick={() => setAdding(true)} className="grid size-11 place-items-center rounded-full bg-brand text-on-brand" aria-label="Add debt"><Plus className="size-5" /></HapticButton>}
      />
      <SectionTabs group="accounts" />
      <div className="space-y-4 px-4">
        <Card className="bg-brand-2 text-on-brand">
          <p className="text-sm text-on-brand/75">Total owed to you</p>
          <BigMoney minor={totalOutstanding} className="block text-[2.4rem] leading-tight" centsClass="text-2xl" />
          <p className="text-xs text-on-brand/75">Repaid so far <Money minor={totalRepaid} className="font-semibold text-on-brand" /></p>
        </Card>

        <Segmented value={filter} onChange={setFilter} options={[{ value: "open", label: "Unsettled" }, { value: "settled", label: "Settled" }]} />

        {!ledger.ready ? (
          <Loading />
        ) : byPerson.length ? (
          <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface shadow-soft">
            {byPerson.map((r) => (
              <li key={r.person.id}>
                <Link href={`/owed/person?id=${r.person.id}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-pale focus-visible:bg-pale active:bg-pale">
                  <Avatar name={r.person.name} color={r.person.color} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate font-medium">{r.person.name}</p>
                      <Money minor={r.outstanding} className="shrink-0 font-semibold" />
                    </div>
                    <Progress value={r.total ? ((r.total - r.outstanding) / r.total) * 100 : 0} className="mt-1.5 h-1.5" />
                    <p className="mt-1 text-xs text-ink-3">{r.open ? `${r.open} open item${r.open === 1 ? "" : "s"}` : "All settled"} · <span className="num">{Math.round(r.total ? ((r.total - r.outstanding) / r.total) * 100 : 0)}%</span> repaid</p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<HandCoins className="size-6" />}
            title={filter === "open" ? "Nobody owes you right now" : "No settled debts yet"}
            body="Split a purchase when adding it, or record a standalone debt."
            action={filter === "open" && <Button onClick={() => setAdding(true)}>Record a debt</Button>}
          />
        )}
      </div>
      <DebtSheet open={adding} onClose={() => setAdding(false)} ledger={ledger} />
    </>
  );
}
