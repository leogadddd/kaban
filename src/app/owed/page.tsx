"use client";

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
        back="/home"
        action={<button onClick={() => setAdding(true)} className="grid size-11 place-items-center rounded-full bg-brand text-white" aria-label="Add debt"><Plus className="size-5" /></button>}
      />
      <div className="space-y-4 px-4">
        <Card className="bg-brand-2 text-white">
          <p className="text-sm text-white/75">Total owed to you</p>
          <BigMoney minor={totalOutstanding} className="block text-[2.4rem] leading-tight" centsClass="text-2xl" />
          <p className="text-xs text-white/75">Repaid so far <Money minor={totalRepaid} className="font-semibold text-white" /></p>
        </Card>

        <Segmented value={filter} onChange={setFilter} options={[{ value: "open", label: "Unsettled" }, { value: "settled", label: "Settled" }]} />

        {!ledger.ready ? (
          <Loading />
        ) : byPerson.length ? (
          <Card className="divide-y divide-line p-0 lg:grid lg:grid-cols-2 lg:divide-y-0 lg:gap-px lg:overflow-hidden lg:bg-line [&>a]:bg-white">
            {byPerson.map((r) => (
              <Link key={r.person.id} href={`/owed/person?id=${r.person.id}`} className="flex items-center gap-3 px-4 py-3.5 active:bg-pale">
                <Avatar name={r.person.name} color={r.person.color} />
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between">
                    <p className="font-medium">{r.person.name}</p>
                    <Money minor={r.outstanding} className="font-semibold" />
                  </div>
                  <Progress value={r.total ? ((r.total - r.outstanding) / r.total) * 100 : 0} className="mt-1.5 h-1.5" />
                  <p className="mt-1 text-xs text-ink-3">{r.open ? `${r.open} open item${r.open === 1 ? "" : "s"}` : "All settled"} · <span className="num">{Math.round(r.total ? ((r.total - r.outstanding) / r.total) * 100 : 0)}%</span> repaid</p>
                </div>
                <ChevronRight className="size-4 text-ink-3" />
              </Link>
            ))}
          </Card>
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
