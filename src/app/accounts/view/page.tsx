"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Archive, ArchiveRestore, ArrowLeftRight, Pencil, Plus, SlidersHorizontal } from "lucide-react";
import { Suspense } from "react";
import { AccountCard } from "@/components/account-card";
import { CreditOverview } from "@/components/credit-overview";
import { GroupedTxns } from "@/components/txn-row";
import { Button, Card, EmptyState, Loading, Money, PageHeader, SectionTitle } from "@/components/ui";
import { formatDayLong } from "@/lib/dates";
import { useLedger } from "@/lib/hooks";
import { setAccountArchived } from "@/lib/repo";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <AccountView />
    </Suspense>
  );
}

function AccountView() {
  const id = useSearchParams().get("id") ?? "";
  const ledger = useLedger();
  if (!ledger.ready) return <Loading />;
  const acc = ledger.accountById.get(id);
  if (!acc) return <EmptyState title="Account not found" action={<Link href="/accounts" className="text-brand">Back to accounts</Link>} />;
  const b = ledger.balances.get(id)!;
  const txns = ledger.txns.filter((t) => t.accountId === id || t.toAccountId === id);
  const credit = acc.type === "credit";

  return (
    <>
      <PageHeader
        title={acc.name}
        back="/accounts"
        action={
          <Link href={`/accounts/new?edit=${acc.id}`} className="grid size-11 place-items-center rounded-full border border-line bg-white" aria-label="Edit account">
            <Pencil className="size-4" />
          </Link>
        }
      />
      <div className="space-y-5 px-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-6 lg:gap-y-5 lg:space-y-0 lg:[&>*]:col-start-1">
        {credit ? <CreditOverview ledger={ledger} accountId={acc.id} showSelector={false} /> : <AccountCard b={b} />}

        <div className="grid grid-cols-3 gap-2">
          <Link href={`/add?account=${acc.id}`}>
            <Button variant="secondary" className="w-full px-2 text-sm"><Plus className="size-4" />Add</Button>
          </Link>
          {!credit && (
            <Link href={`/add?type=transfer&account=${acc.id}`}>
              <Button variant="secondary" className="w-full px-2 text-sm"><ArrowLeftRight className="size-4" />Transfer</Button>
            </Link>
          )}
          <Link href={`/add?type=adjustment&account=${acc.id}`}>
            <Button variant="secondary" className="w-full px-2 text-sm"><SlidersHorizontal className="size-4" />Adjust</Button>
          </Link>
        </div>

        <Card>
          <SectionTitle>Account details</SectionTitle>
          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            <dt className="text-ink-3">{credit ? "Opening debt" : "Opening balance"}</dt>
            <dd className="text-right"><Money minor={acc.openingMinor} /></dd>
            <dt className="text-ink-3">As of</dt>
            <dd className="text-right">{formatDayLong(acc.openingDate)}</dd>
            {credit && (
              <>
                <dt className="text-ink-3">Credit limit</dt>
                <dd className="text-right"><Money minor={acc.creditLimitMinor ?? 0} /></dd>
                <dt className="text-ink-3">Statement closes</dt>
                <dd className="text-right">Day {acc.closingDay}</dd>
                <dt className="text-ink-3">Payment due</dt>
                <dd className="text-right">{acc.dueDaysAfterClosing} days after closing</dd>
              </>
            )}
            {acc.issuer && (<><dt className="text-ink-3">Issuer</dt><dd className="text-right">{acc.issuer}</dd></>)}
            {acc.last4 && (<><dt className="text-ink-3">Number</dt><dd className="num text-right">•••• {acc.last4}</dd></>)}
          </dl>
        </Card>

        <section className="lg:col-start-2! lg:row-span-6 lg:row-start-1">
          <SectionTitle>All transactions</SectionTitle>
          {txns.length ? <GroupedTxns txns={txns} ledger={ledger} perspective={acc.id} /> : <Card className="text-sm text-ink-3">No transactions yet.</Card>}
        </section>

        <Button variant="ghost" className="w-full" onClick={() => setAccountArchived(acc.id, !acc.archived)}>
          {acc.archived ? <><ArchiveRestore className="size-4" /> Restore account</> : <><Archive className="size-4" /> Archive account</>}
        </Button>
        <p className="-mt-3 text-center text-xs text-ink-3">Archiving hides the account but keeps its full history.</p>
      </div>
    </>
  );
}
