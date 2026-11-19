"use client";

import { confirmDialog } from "@/components/dialog";
import { undoToast } from "@/components/undo-toast";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Archive, Check, HandCoins, Plus, Split, Trash2 } from "lucide-react";
import { Suspense, useState } from "react";
import { DebtSheet, RepaySheet, type RepayTarget } from "@/components/debt-sheets";
import { Avatar, BigMoney, Button, ButtonLink, Card, EmptyState, Loading, Money, PageHeader, Progress, Segmented } from "@/components/ui";
import { formatDay } from "@/lib/dates";
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
  const [repay, setRepay] = useState<RepayTarget>(null);
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState<"open" | "all">("open");

  if (!ledger.ready) return <Loading />;
  const person = ledger.personById.get(id);
  if (!person) return <EmptyState title="Person not found" action={<Link href="/owed" className="text-brand">Back</Link>} />;

  const all = ledger.debtStatus.filter((d) => d.debt.personId === id).sort((a, b) => b.debt.date.localeCompare(a.debt.date));
  const shown = tab === "open" ? all.filter((d) => !d.settled) : all;
  const outstanding = all.reduce((s, d) => s + Math.max(0, d.outstanding), 0);
  const total = all.reduce((s, d) => s + d.debt.amountMinor, 0);
  const repaid = all.reduce((s, d) => s + d.repaid, 0);
  const openCount = all.filter((d) => !d.settled).length;

  return (
    <>
      <PageHeader title={person.name} back="/owed" />
      <div className="space-y-4 px-4">
        <Card className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar name={person.name} color={person.color} size={56} />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink-3">{outstanding > 0 ? "Owes you" : "All settled"}</p>
              <BigMoney minor={outstanding} className="block text-3xl" centsClass="text-xl" />
            </div>
          </div>
          <Progress value={total ? (repaid / total) * 100 : 0} />
          {/* Totals: everything they've been charged, what they've paid back, what's open */}
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-bg p-2">
              <dt className="text-[0.7rem] text-ink-3">Total shared</dt>
              <dd><Money minor={total} className="text-sm font-semibold" /></dd>
            </div>
            <div className="rounded-2xl bg-bg p-2">
              <dt className="text-[0.7rem] text-ink-3">Paid back</dt>
              <dd><Money minor={repaid} className="text-sm font-semibold text-income" /></dd>
            </div>
            <div className="rounded-2xl bg-bg p-2">
              <dt className="text-[0.7rem] text-ink-3">Open items</dt>
              <dd className="num text-sm font-semibold">{openCount}</dd>
            </div>
          </dl>
          {outstanding > 0 && (
            <Button wrapperClassName="w-full" onClick={() => setRepay({ personId: person.id })}>
              <HandCoins className="size-4" /> Record payment from {person.name.split(" ")[0]}
            </Button>
          )}
        </Card>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" wrapperClassName="min-w-0" className="px-3 text-sm whitespace-nowrap" onClick={() => setAdding(true)}>
            <Plus className="size-4 shrink-0" /> New debt
          </Button>
          <ButtonLink href="/add" variant="secondary" wrapperClassName="min-w-0" className="px-3 text-sm whitespace-nowrap">
            <Split className="size-4 shrink-0" /> Split a bill
          </ButtonLink>
        </div>

        <Segmented value={tab} onChange={setTab} options={[{ value: "open", label: "Unsettled" }, { value: "all", label: "History" }]} />

        {shown.length ? (
          <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
          {shown.map((s) => {
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
                    <Button wrapperClassName="flex-1" onClick={() => setRepay({ personId: person.id, debtId: s.debt.id })}><HandCoins className="size-4" /> Record repayment</Button>
                    {!txn && s.repaid === 0 && (
                      <Button variant="danger" className="px-4" aria-label="Remove debt" onClick={async () => {
                          const debtId = s.debt.id;
                          if (!(await confirmDialog({ title: "Remove this debt?", body: s.debt.description || undefined, confirmLabel: "Remove", danger: true }))) return;
                          await voidDebt(debtId);
                          undoToast("Debt removed", () => voidDebt(debtId, false));
                        }}>
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
          </div>
        ) : (
          <EmptyState icon={<Check className="size-6" />} title={tab === "open" ? `${person.name} is all settled` : "No history yet"} />
        )}

        <Button
          variant="ghost"
          wrapperClassName="w-full"
          onClick={async () => {
            if (
              !(await confirmDialog({
                title: `Archive ${person.name}?`,
                body:
                  outstanding > 0
                    ? `${person.name} still owes you. Their debts stay on record, but they'll be hidden from your people list.`
                    : `Their debt history stays on record, but they'll be hidden from your people list.`,
                confirmLabel: outstanding > 0 ? "Archive anyway" : "Archive",
              }))
            )
              return;
            const personId = person.id;
            await setPersonArchived(personId, true);
            router.replace("/people");
            undoToast(`${person.name} archived`, () => setPersonArchived(personId, false));
          }}
        >
          <Archive className="size-4" /> Archive person
        </Button>
      </div>
      <RepaySheet target={repay} onClose={() => setRepay(null)} ledger={ledger} />
      <DebtSheet open={adding} onClose={() => setAdding(false)} ledger={ledger} personId={person.id} />
    </>
  );
}
