"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Archive, Check, HandCoins, Plus, Split, Trash2 } from "lucide-react";
import { Suspense, useState } from "react";
import { DebtSheet, RepaySheet } from "@/components/debt-sheets";
import { Avatar, BigMoney, Button, Card, EmptyState, Loading, Money, PageHeader, Progress, Segmented } from "@/components/ui";
import { formatDay } from "@/lib/dates";
import type { DebtStatus } from "@/lib/finance";
import { useLedger } from "@/lib/hooks";
import { setPersonArchived, voidDebt } from "@/lib/repo";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <PersonDebts />
    </Suspense>
  );
}

function PersonDebts() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const ledger = useLedger();
  const [repay, setRepay] = useState<DebtStatus | null>(null);
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState<"open" | "all">("open");

  if (!ledger.ready) return <Loading />;
  const person = ledger.personById.get(id);
  if (!person) return <EmptyState title="Person not found" action={<Link href="/owed" className="text-brand">Back</Link>} />;

  const all = ledger.debtStatus.filter((d) => d.debt.personId === id).sort((a, b) => b.debt.date.localeCompare(a.debt.date));
  const shown = tab === "open" ? all.filter((d) => !d.settled) : all;
  const outstanding = all.reduce((s, d) => s + Math.max(0, d.outstanding), 0);
  const total = all.reduce((s, d) => s + d.debt.amountMinor, 0);

  return (
    <>
      <PageHeader title={person.name} back="/owed" />
      <div className="space-y-4 px-4">
        <Card className="flex items-center gap-4">
          <Avatar name={person.name} color={person.color} size={56} />
          <div className="flex-1">
            <p className="text-sm text-ink-3">Owes you</p>
            <BigMoney minor={outstanding} className="block text-3xl" centsClass="text-xl" />
            <Progress value={total ? ((total - outstanding) / total) * 100 : 0} className="mt-2" />
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" className="min-w-0 px-3 text-sm whitespace-nowrap" onClick={() => setAdding(true)}>
            <Plus className="size-4 shrink-0" /> New debt
          </Button>
          <Link href="/add" className="min-w-0">
            <Button variant="secondary" className="w-full px-3 text-sm whitespace-nowrap">
              <Split className="size-4 shrink-0" /> Split a bill
            </Button>
          </Link>
        </div>

        <Segmented value={tab} onChange={setTab} options={[{ value: "open", label: "Unsettled" }, { value: "all", label: "History" }]} />

        {shown.length ? (
          shown.map((s) => {
            const txn = s.debt.transactionId ? ledger.txns.find((t) => t.id === s.debt.transactionId) : undefined;
            const acc = txn && ledger.accountById.get(txn.accountId);
            return (
              <Card key={s.debt.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{s.debt.description}</p>
                    <p className="text-xs text-ink-3">
                      {formatDay(s.debt.date)}
                      {txn ? <> · split from <Link href={`/add?edit=${txn.id}`} className="text-brand underline">{acc?.name ?? "purchase"}</Link></> : " · standalone"}
                    </p>
                  </div>
                  <div className="text-right">
                    <Money minor={s.outstanding} className="font-semibold" />
                    <p className="num text-xs text-ink-3">of {<Money minor={s.debt.amountMinor} />}</p>
                  </div>
                </div>
                <Progress value={(s.repaid / s.debt.amountMinor) * 100} className="h-1.5" />
                {s.repayments.length > 0 && (
                  <ul className="space-y-1 rounded-2xl bg-pale p-3 text-xs">
                    {s.repayments.map((r) => (
                      <li key={r.id} className="flex justify-between">
                        <Link href={`/add?edit=${r.id}`} className="text-ink-2">{formatDay(r.date)} → {ledger.accountById.get(r.accountId)?.name}</Link>
                        <Money minor={r.amountMinor} className="font-medium text-income" sign />
                      </li>
                    ))}
                  </ul>
                )}
                {s.settled ? (
                  <p className="flex items-center gap-1.5 text-sm font-medium text-income"><Check className="size-4" /> Settled</p>
                ) : (
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={() => setRepay(s)}><HandCoins className="size-4" /> Record repayment</Button>
                    {!txn && s.repaid === 0 && (
                      <Button variant="danger" className="px-4" aria-label="Remove debt" onClick={() => confirm("Remove this debt?") && voidDebt(s.debt.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            );
          })
        ) : (
          <EmptyState icon={<Check className="size-6" />} title={tab === "open" ? `${person.name} is all settled` : "No history yet"} />
        )}

        <Button
          variant="ghost"
          className="w-full"
          onClick={async () => {
            if (outstanding > 0 && !confirm(`${person.name} still owes you. Archive anyway?`)) return;
            await setPersonArchived(person.id, true);
            router.replace("/people");
          }}
        >
          <Archive className="size-4" /> Archive person
        </Button>
      </div>
      <RepaySheet status={repay} onClose={() => setRepay(null)} ledger={ledger} />
      <DebtSheet open={adding} onClose={() => setAdding(false)} ledger={ledger} personId={person.id} />
    </>
  );
}
