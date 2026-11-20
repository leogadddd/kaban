"use client";

import { HapticLink } from "@/components/haptic-button";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Archive, ArchiveRestore, ArrowLeftRight, Pencil, Plus, SlidersHorizontal } from "lucide-react";
import { Suspense } from "react";
import { AccountCard } from "@/components/account-card";
import { CreditOverview } from "@/components/credit-overview";
import { confirmDialog } from "@/components/dialog";
import { undoToast } from "@/components/undo-toast";
import { GroupedTxns } from "@/components/txn-row";
import { useHideVoided } from "@/lib/display-prefs";
import { Button, ButtonLink, Card, EmptyState, Money, PageHeader, SectionTitle } from "@/components/ui";
import { formatDayLong } from "@/lib/dates";
import { useLedger } from "@/lib/hooks";
import { setAccountArchived } from "@/lib/repo";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AccountView />
    </Suspense>
  );
}

function AccountView() {
  const id = useSearchParams().get("id") ?? "";
  const ledger = useLedger();
  const [hideVoided] = useHideVoided();
  if (!ledger.ready) return null;
  const acc = ledger.accountById.get(id);
  if (!acc) return <EmptyState title="Account not found" action={<Link href="/accounts" className="text-brand">Back to accounts</Link>} />;
  const b = ledger.balances.get(id)!;
  const txns = ledger.txns.filter((t) => (t.accountId === id || t.toAccountId === id) && !(hideVoided && t.state === "void"));
  const credit = acc.type === "credit";

  return (
    <>
      <PageHeader
        title={acc.name}
        back="/accounts"
        action={
          <HapticLink href={`/accounts/new?edit=${acc.id}`} className="grid size-11 place-items-center rounded-full border border-line bg-surface" aria-label="Edit account">
            <Pencil className="size-4" />
          </HapticLink>
        }
      />
      <div className="space-y-5 px-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-6 lg:gap-y-5 lg:space-y-0 lg:[&>*]:col-start-1">
        {credit ? <CreditOverview ledger={ledger} accountId={acc.id} showSelector={false} /> : <AccountCard b={b} />}

        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/add?account=${acc.id}`} variant="secondary" wrapperClassName="min-w-max flex-1" className="px-2 text-sm whitespace-nowrap"><Plus className="size-4" />Add transaction</ButtonLink>
          {!credit && (
            <ButtonLink href={`/add?type=transfer&account=${acc.id}`} variant="secondary" wrapperClassName="min-w-max flex-1" className="px-2 text-sm whitespace-nowrap"><ArrowLeftRight className="size-4" />Record transfer</ButtonLink>
          )}
          <ButtonLink href={`/add?type=adjustment&account=${acc.id}`} variant="secondary" wrapperClassName="min-w-max flex-1" className="px-2 text-sm whitespace-nowrap"><SlidersHorizontal className="size-4" />Adjust balance</ButtonLink>
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

        <Button variant="ghost" wrapperClassName="w-full" onClick={async () => {
            if (
              !acc.archived &&
              !(await confirmDialog({
                title: `Archive ${acc.name}?`,
                body: "It's hidden from your accounts and pickers, but its full history stays. You can restore it from the archived list.",
                confirmLabel: "Archive account",
              }))
            )
              return;
            const accId = acc.id;
            await setAccountArchived(accId, !acc.archived);
            if (!acc.archived) undoToast(`${acc.name} archived`, () => setAccountArchived(accId, false));
          }}>
          {acc.archived ? <><ArchiveRestore className="size-4" /> Restore account</> : <><Archive className="size-4" /> Archive account</>}
        </Button>
        <p className="-mt-3 text-center text-xs text-ink-3">Archiving hides the account but keeps its full history.</p>
      </div>
    </>
  );
}
