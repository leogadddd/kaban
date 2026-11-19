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
        subtitle="Family & friends you split with — they don't need an account."
        action={<button onClick={() => setOpen(true)} className="grid size-11 place-items-center rounded-full bg-brand text-white" aria-label="Add person"><UserPlus className="size-5" /></button>}
      />
      <div className="px-4">
        {!ledger.ready ? (
          <Loading />
        ) : people.length ? (
          <Card className="divide-y divide-line p-0 lg:grid lg:grid-cols-2 lg:divide-y-0 lg:gap-px lg:overflow-hidden lg:bg-line [&>a]:bg-white">
            {people.map((p) => {
              const owes = ledger.debtStatus.filter((d) => d.debt.personId === p.id).reduce((s, d) => s + Math.max(0, d.outstanding), 0);
              return (
                <Link key={p.id} href={`/owed/person?id=${p.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-pale">
                  <Avatar name={p.name} color={p.color} />
                  <div className="flex-1">
                    <p className="font-medium">{p.name}</p>
                    {p.nickname && <p className="text-xs text-ink-3">{p.nickname}</p>}
                  </div>
                  {owes > 0 ? <Money minor={owes} className="font-semibold" /> : <span className="text-xs text-ink-3">Settled</span>}
                  <ChevronRight className="size-4 text-ink-3" />
                </Link>
              );
            })}
          </Card>
        ) : (
          <EmptyState icon={<Users className="size-6" />} title="No people yet" body="Add the family members who share the card." action={<Button onClick={() => setOpen(true)}>Add person</Button>} />
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
