"use client";

import Link from "next/link";
import { Archive, ChevronRight, CreditCard, Landmark, Plus, Wallet } from "lucide-react";
import { useState } from "react";
import { Card, Chip, Loading, Money, PageHeader, Progress } from "@/components/ui";
import { BankLogo } from "@/components/bank-logo";
import { bankFor } from "@/lib/banks";
import { useLedger } from "@/lib/hooks";
import type { AccountType } from "@/lib/types";

const GROUPS: { type: AccountType; label: string; icon: typeof Wallet }[] = [
  { type: "cash", label: "Cash", icon: Wallet },
  { type: "debit", label: "Debit & bank", icon: Landmark },
  { type: "credit", label: "Credit cards", icon: CreditCard },
];

export default function AccountsPage() {
  const ledger = useLedger();
  const [showArchived, setShowArchived] = useState(false);
  const list = showArchived ? ledger.accounts : ledger.activeAccounts;
  const archivedCount = ledger.accounts.filter((a) => a.archived).length;

  return (
    <>
      <PageHeader
        title="Accounts"
        action={
          <Link href="/accounts/new" className="grid size-11 place-items-center rounded-full bg-brand text-white shadow-soft" aria-label="Add account">
            <Plus className="size-5" />
          </Link>
        }
      />
      {!ledger.ready ? (
        <Loading />
      ) : (
        <div className="space-y-5 px-4">
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-pale">
              <p className="text-xs text-ink-3">Available funds</p>
              <Money minor={ledger.totals.availableFunds} className="text-xl font-semibold" />
            </Card>
            <Card className="bg-ink text-white">
              <p className="text-xs text-white/60">Credit outstanding</p>
              <Money minor={ledger.totals.creditOutstanding} className="text-xl font-semibold" />
            </Card>
          </div>

          {GROUPS.map(({ type, label, icon: Icon }) => {
            const items = list.filter((a) => a.type === type);
            if (!items.length) return null;
            return (
              <section key={type}>
                <h2 className="mb-2 flex items-center gap-1.5 px-1 text-sm font-semibold text-ink-2">
                  <Icon className="size-4" /> {label}
                </h2>
                <Card className="divide-y divide-line p-0">
                  {items.map((a) => {
                    const b = ledger.balances.get(a.id)!;
                    const bank = a.type === "cash" ? undefined : bankFor(a);
                    return (
                      <Link key={a.id} href={`/accounts/view?id=${a.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-pale">
                        {bank ? <BankLogo bank={bank} size={36} /> : <span className="size-9 shrink-0 rounded-xl" style={{ background: a.color }} aria-hidden="true" />}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            {a.name} {a.archived && <span className="ml-1 rounded-full bg-pale px-2 py-0.5 text-[0.65rem] text-ink-3">Archived</span>}
                          </p>
                          {a.type === "credit" ? (
                            <div className="mt-1 flex items-center gap-2">
                              <Progress value={b.utilisation ?? 0} className="h-1.5 flex-1" />
                              <span className="num text-xs text-ink-3">{(b.utilisation ?? 0).toFixed(0)}%</span>
                            </div>
                          ) : (
                            <p className="text-xs text-ink-3">{a.issuer || label}{a.last4 ? ` · •••• ${a.last4}` : ""}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <Money minor={b.balance} className="font-semibold" />
                          {a.type === "credit" && <p className="text-[0.68rem] text-ink-3">owed</p>}
                        </div>
                        <ChevronRight className="size-4 text-ink-3" />
                      </Link>
                    );
                  })}
                </Card>
              </section>
            );
          })}

          {!list.length && (
            <Card className="text-center">
              <p className="font-medium">No accounts yet</p>
              <Link href="/accounts/new" className="mt-2 inline-block text-brand">Add one</Link>
            </Card>
          )}

          {archivedCount > 0 && (
            <Chip active={showArchived} onClick={() => setShowArchived((v) => !v)}>
              <Archive className="size-4" /> {showArchived ? "Hide" : "Show"} archived ({archivedCount})
            </Chip>
          )}
        </div>
      )}
    </>
  );
}
