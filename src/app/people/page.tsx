"use client";

import Link from "next/link";
import { ChevronRight, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { Avatar, Button, Card, EmptyState, Field, inputCls, Loading, Money, PageHeader, Sheet } from "@/components/ui";
import { useLedger } from "@/lib/hooks";
import { savePerson } from "@/lib/repo";

export default function PeoplePage() {
  const ledger = useLedger();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string>();

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try {
      await savePerson({ name, nickname: nickname.trim() || undefined });
      setName("");
      setNickname("");
      setOpen(false);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const people = ledger.people.filter((p) => !p.archived);
  return (
    <>
      <PageHeader
        title="People"
        back="/home"
        subtitle="People you split bills with or lend to. They don't need an account."
        action={<button onClick={() => setOpen(true)} className="grid size-11 place-items-center rounded-full bg-brand text-on-brand" aria-label="Add person"><UserPlus className="size-5" /></button>}
      />
      <div className="space-y-4 px-4">
        {ledger.ready && people.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-3">
              <p className="text-xs text-ink-3">Owed to you</p>
              <Money minor={ledger.debtStatus.reduce((s, d) => s + Math.max(0, d.outstanding), 0)} className="text-lg font-semibold" />
            </Card>
            <Card className="p-3">
              <p className="text-xs text-ink-3">Paid back so far</p>
              <Money minor={ledger.debtStatus.reduce((s, d) => s + d.repaid, 0)} className="text-lg font-semibold text-income" />
            </Card>
          </div>
        )}
        {!ledger.ready ? (
          <Loading />
        ) : people.length ? (
          <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface shadow-soft">
            {people.map((p) => {
              const ds = ledger.debtStatus.filter((d) => d.debt.personId === p.id);
              const owes = ds.reduce((s, d) => s + Math.max(0, d.outstanding), 0);
              const shared = ds.reduce((s, d) => s + d.debt.amountMinor, 0);
              const paid = ds.reduce((s, d) => s + d.repaid, 0);
              return (
                <li key={p.id}>
                  <Link href={`/owed/person?id=${p.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-pale focus-visible:bg-pale active:bg-pale">
                    <Avatar name={p.name} color={p.color} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="truncate text-xs text-ink-3">
                        {shared === 0 ? (
                          p.nickname || "No shared expenses yet"
                        ) : paid > 0 ? (
                          <>
                            Paid back <Money minor={paid} className="text-income" />
                          </>
                        ) : (
                          <>
                            Shared <Money minor={shared} />
                          </>
                        )}
                      </p>
                    </div>
                    {owes > 0 ? (
                      <div className="shrink-0 text-right">
                        <Money minor={owes} className="font-semibold" />
                        <p className="text-[0.68rem] text-ink-3">owes you</p>
                      </div>
                    ) : shared > 0 && (
                      <span className="shrink-0 text-xs font-medium text-income">Settled</span>
                    )}
                    <ChevronRight className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={<Users className="size-6" />} title="No people yet" body="Add the friends or relatives you split bills with or lend money to." action={<Button onClick={() => setOpen(true)}>Add person</Button>} />
        )}
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Add person">
        <form onSubmit={add} className="space-y-3">
          <Field label="Name" error={error}>{(id) => <input id={id} className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Mama" />}</Field>
          <Field label="Nickname (optional)">{(id) => <input id={id} className={inputCls} value={nickname} onChange={(e) => setNickname(e.target.value)} />}</Field>
          <Button type="submit" className="w-full">Add</Button>
        </form>
      </Sheet>
    </>
  );
}
