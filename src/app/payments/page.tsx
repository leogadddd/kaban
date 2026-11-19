"use client";

import { History } from "lucide-react";
import { useState } from "react";
import { GroupedTxns } from "@/components/txn-row";
import { ButtonLink, Card, EmptyState, Loading, Money, PageHeader, Segmented } from "@/components/ui";
import { useLedger } from "@/lib/hooks";

export default function PaymentsPage() {
  const ledger = useLedger();
  const [kind, setKind] = useState<"card" | "received">("card");
  const items = ledger.txns.filter((t) => t.state === "active" && (kind === "card" ? t.type === "card_payment" : t.type === "reimbursement"));
  const total = items.reduce((s, t) => s + t.amountMinor, 0);

  return (
    <>
      <PageHeader title="Payment history" back="/home" />
      <div className="space-y-4 px-4">
        <Segmented value={kind} onChange={setKind} options={[{ value: "card", label: "Card payments" }, { value: "received", label: "Received" }]} />
        <Card className="flex items-center justify-between">
          <span className="text-sm text-ink-3">{kind === "card" ? "Paid to cards" : "Received from people"}</span>
          <Money minor={total} className="text-lg font-semibold" />
        </Card>
        {!ledger.ready ? (
          <Loading />
        ) : items.length ? (
          <GroupedTxns txns={items} ledger={ledger} />
        ) : (
          <EmptyState
            icon={<History className="size-6" />}
            title="No payments yet"
            action={kind === "card" && <ButtonLink href="/add?type=card_payment">Record card payment</ButtonLink>}
          />
        )}
      </div>
    </>
  );
}
