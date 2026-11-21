"use client";

import Link from "next/link";
import { Archive, CreditCard, HandCoins, Landmark, Plus, UserPlus, Users, Wallet, WalletCards } from "lucide-react";
import { useState } from "react";
import { AccountCard } from "@/components/account-card";
import { BankLogo } from "@/components/bank-logo";
import { DebtSheet } from "@/components/debt-sheets";
import { FamilyBadge } from "@/components/family-ui";
import { HapticButton, HapticLink } from "@/components/haptic-button";
import { GroupTitle, Row, SwipeHub, Tile, Tiles, type HubPane } from "@/components/swipe-hub";
import { Avatar, Button, ButtonLink, Card, Chip, EmptyState, Field, inputCls, Money, Progress, Sheet } from "@/components/ui";
import { bankFor } from "@/lib/banks";
import { useShowArchived } from "@/lib/display-prefs";
import { useFamilies, useFamilyPersonAvatars } from "@/lib/family";
import { useLedger } from "@/lib/hooks";
import { savePerson } from "@/lib/repo";
import type { AccountType } from "@/lib/types";

type Ledger = ReturnType<typeof useLedger>;

/** Accounts, People and Owed to me: one swipeable screen under the Accounts tab. */
export function AccountsHub() {
  const ledger = useLedger();
  const avatars = useFamilyPersonAvatars(useFamilies(), ledger.familyPersonLinks);
  const [addingPerson, setAddingPerson] = useState(false);
  const [addingDebt, setAddingDebt] = useState(false);
  const btn = "grid size-11 place-items-center rounded-full bg-brand text-on-brand shadow-soft";

  const panes: HubPane[] = [
    {
      href: "/accounts",
      tab: "Accounts",
      title: "Accounts",
      action: <HapticLink href="/accounts/new" className={btn} aria-label="Add account"><Plus className="size-5" /></HapticLink>,
      content: <AccountsPane ledger={ledger} />,
    },
    {
      href: "/people",
      tab: "People",
      title: "People",
      action: <HapticButton onClick={() => setAddingPerson(true)} className={btn} aria-label="Add person"><UserPlus className="size-5" /></HapticButton>,
      content: <PeoplePane ledger={ledger} avatars={avatars} onAdd={() => setAddingPerson(true)} />,
    },
    {
      href: "/owed",
      tab: "Owed to me",
      title: "Who Owes Me",
      action: <HapticButton onClick={() => setAddingDebt(true)} className={btn} aria-label="Record a debt"><Plus className="size-5" /></HapticButton>,
      content: <OwedPane ledger={ledger} avatars={avatars} onAdd={() => setAddingDebt(true)} />,
    },
  ];

  return (
    <>
      <SwipeHub title="Accounts" panes={panes} ready={ledger.ready} />
      <AddPersonSheet open={addingPerson} onClose={() => setAddingPerson(false)} />
      <DebtSheet open={addingDebt} onClose={() => setAddingDebt(false)} ledger={ledger} avatars={avatars} />
    </>
  );
}

/* ---------- Accounts ---------- */

const GROUPS: { type: AccountType; label: string; icon: typeof Wallet }[] = [
  { type: "cash", label: "Cash", icon: Wallet },
  { type: "debit", label: "Debit & bank", icon: Landmark },
  { type: "credit", label: "Credit & pay later", icon: CreditCard },
];

function AccountsPane({ ledger }: { ledger: Ledger }) {
  const [alwaysShow] = useShowArchived();
  const [peek, setPeek] = useState(false);
  const showArchived = alwaysShow || peek;
  const list = showArchived ? ledger.accounts : ledger.activeAccounts;
  const archivedCount = ledger.accounts.filter((a) => a.archived).length;

  return (
    <div className="space-y-5 pb-4">
      <DesktopAccounts ledger={ledger} list={list} />
      <Tiles className="lg:hidden">
        <Tile label="Available funds"><Money minor={ledger.totals.availableFunds} /></Tile>
        <Tile label="Credit outstanding"><Money minor={ledger.totals.creditOutstanding} /></Tile>
      </Tiles>

      <div className="space-y-5 lg:hidden">
        {GROUPS.map(({ type, label, icon: Icon }) => {
          const items = list.filter((a) => a.type === type);
          if (!items.length) return null;
          return (
            <section key={type}>
              <GroupTitle icon={Icon}>{label}</GroupTitle>
              <Card className="divide-y divide-line overflow-hidden p-0!">
                {items.map((a) => {
                  const b = ledger.balances.get(a.id)!;
                  const bank = a.type === "cash" ? undefined : bankFor(a);
                  return (
                    <Row
                      key={a.id}
                      href={`/accounts/view?id=${a.id}`}
                      archived={a.archived}
                      lead={bank ? <BankLogo bank={bank} size={36} /> : <span className="grid size-9 shrink-0 place-items-center rounded-xl text-ink" style={{ background: `color-mix(in srgb, ${a.color} 28%, var(--color-surface))` }} aria-hidden="true"><Icon className="size-5" /></span>}
                      title={a.name}
                      sub={
                        a.type === "credit" ? (
                          <div className="mt-1 flex items-center gap-2">
                            <Progress value={b.utilisation ?? 0} className="h-1.5 flex-1" />
                            <span className="num">{(b.utilisation ?? 0).toFixed(0)}%</span>
                          </div>
                        ) : (
                          <>{a.issuer || label}{a.last4 ? ` · •••• ${a.last4}` : ""}</>
                        )
                      }
                      trail={
                        <>
                          <Money minor={b.balance} className="font-semibold" />
                          {a.type === "credit" && <p className="text-[0.68rem] text-ink-3">owed</p>}
                        </>
                      }
                    />
                  );
                })}
              </Card>
            </section>
          );
        })}

        {!list.length && (
          <EmptyState
            icon={<WalletCards className="size-6" />}
            title="No accounts yet"
            body="Add your wallet cash, a bank or e-wallet account, or a credit card."
            action={<ButtonLink href="/accounts/new"><Plus className="size-4" /> Add account</ButtonLink>}
          />
        )}
      </div>

      {archivedCount > 0 && !alwaysShow && (
        <Chip active={peek} onClick={() => setPeek((v) => !v)}>
          <Archive className="size-4" /> {peek ? "Hide" : "Show"} archived ({archivedCount})
        </Chip>
      )}
    </div>
  );
}

/** Desktop: summary tiles plus the visual account cards in a grid. */
function DesktopAccounts({ ledger, list }: { ledger: Ledger; list: Ledger["accounts"] }) {
  const owed = ledger.debtStatus.reduce((s, d) => s + Math.max(0, d.outstanding), 0);
  const tiles = [
    { label: "Available funds", value: ledger.totals.availableFunds },
    { label: "Credit outstanding", value: ledger.totals.creditOutstanding },
    { label: "Net position", value: ledger.totals.netPosition },
    { label: "Owed to you", value: owed },
  ];
  return (
    <div className="hidden space-y-8 lg:block">
      <div className="grid grid-cols-4 gap-4">
        {tiles.map((t) => (
          <Card key={t.label}>
            <p className="text-sm text-ink-3">{t.label}</p>
            <Money minor={t.value} className="mt-1 block text-2xl font-semibold" />
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-5 xl:grid-cols-3">
        {GROUPS.flatMap(({ type }) => list.filter((a) => a.type === type)).map((a) => (
          <Link key={a.id} href={`/accounts/view?id=${a.id}`} className={a.archived ? undefined : "transition hover:-translate-y-1"}>
            <AccountCard b={ledger.balances.get(a.id)!} />
          </Link>
        ))}
        <Link
          href="/accounts/new"
          className="flex h-48 flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed border-line text-sm font-medium text-ink-3 transition hover:border-brand-2 hover:bg-pale hover:text-brand"
        >
          <Plus className="size-6" /> Add account
        </Link>
      </div>
    </div>
  );
}

/* ---------- People ---------- */

function PeoplePane({ ledger, avatars, onAdd }: { ledger: Ledger; avatars: ReadonlyMap<string, string>; onAdd: () => void }) {
  const [alwaysShow] = useShowArchived();
  const [peek, setPeek] = useState(false);
  const showArchived = alwaysShow || peek;
  const people = ledger.people.filter((p) => !p.archived);
  const archivedPeople = ledger.people.filter((p) => p.archived);
  const listed = showArchived ? [...people, ...archivedPeople] : people;
  const owedTotal = ledger.debtStatus.reduce((s, d) => s + Math.max(0, d.outstanding), 0);
  const owing = people.filter((p) => ledger.debtStatus.some((d) => d.debt.personId === p.id && d.outstanding > 0)).length;

  return (
    <div className="space-y-5 pb-4">
      <Tiles className="lg:hidden">
        <Tile label="People"><span className="num">{people.length}</span></Tile>
        <Tile label={owing ? `Owed by ${owing} ${owing === 1 ? "person" : "people"}` : "Owed to you"}><Money minor={owedTotal} /></Tile>
      </Tiles>

      {listed.length ? (
        <section>
          <GroupTitle icon={Users}>Split bills and lend to</GroupTitle>
          <Card className="divide-y divide-line overflow-hidden p-0!">
            {listed.map((p) => {
              const ds = ledger.debtStatus.filter((d) => d.debt.personId === p.id);
              const owes = ds.reduce((s, d) => s + Math.max(0, d.outstanding), 0);
              const shared = ds.reduce((s, d) => s + d.debt.amountMinor, 0);
              const paid = ds.reduce((s, d) => s + d.repaid, 0);
              return (
                <Row
                  key={p.id}
                  href={`/owed/person?id=${p.id}`}
                  archived={p.archived}
                  lead={<Avatar name={p.name} color={p.color} avatar={avatars.get(p.id)} size={36} />}
                  title={
                    ledger.familyPersonIds.has(p.id) ? (
                      <span className="flex items-center gap-2"><span className="truncate">{p.name}</span><FamilyBadge /></span>
                    ) : p.name
                  }
                  sub={shared === 0 ? p.nickname || "No shared expenses yet" : paid > 0 ? <>Paid back <Money minor={paid} className="text-income" /></> : <>Shared <Money minor={shared} /></>}
                  trail={
                    owes > 0 ? (
                      <>
                        <Money minor={owes} className="font-semibold" />
                        <p className="text-[0.68rem] text-ink-3">owes you</p>
                      </>
                    ) : shared > 0 ? (
                      <span className="text-xs font-medium text-income">Settled</span>
                    ) : undefined
                  }
                />
              );
            })}
          </Card>
        </section>
      ) : (
        <EmptyState icon={<Users className="size-6" />} title="No people yet" body="Add the friends or relatives you split bills with or lend money to. They don't need an account." action={<Button onClick={onAdd}><UserPlus className="size-4" /> Add person</Button>} />
      )}

      {archivedPeople.length > 0 && !alwaysShow && (
        <Chip active={peek} onClick={() => setPeek((v) => !v)}>
          <Archive className="size-4" /> {peek ? "Hide" : "Show"} archived ({archivedPeople.length})
        </Chip>
      )}
    </div>
  );
}

function AddPersonSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string>();

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try {
      await savePerson({ name, nickname: nickname.trim() || undefined });
      setName("");
      setNickname("");
      setError(undefined);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add person">
      <form onSubmit={add} className="space-y-3">
        <Field label="Name" error={error}>{(id) => <input id={id} className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Mama" />}</Field>
        <Field label="Nickname (optional)">{(id) => <input id={id} className={inputCls} value={nickname} onChange={(e) => setNickname(e.target.value)} />}</Field>
        <Button type="submit" wrapperClassName="w-full">Add person</Button>
      </form>
    </Sheet>
  );
}

/* ---------- Owed to me ---------- */

function OwedPane({ ledger, avatars, onAdd }: { ledger: Ledger; avatars: ReadonlyMap<string, string>; onAdd: () => void }) {
  const [filter, setFilter] = useState<"open" | "settled">("open");
  const rows = ledger.people
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
    <div className="space-y-5 pb-4">
      <Tiles className="lg:hidden">
        <Tile label="Owed to you"><Money minor={totalOutstanding} /></Tile>
        <Tile label="Repaid so far"><Money minor={totalRepaid} /></Tile>
      </Tiles>

      <section>
        <div className="mb-3 flex gap-1.5">
          <Chip active={filter === "open"} onClick={() => setFilter("open")}>Unsettled</Chip>
          <Chip active={filter === "settled"} onClick={() => setFilter("settled")}>Settled</Chip>
        </div>
        {rows.length ? (
          <Card className="divide-y divide-line overflow-hidden p-0!">
            {rows.map((r) => {
              const pct = r.total ? ((r.total - r.outstanding) / r.total) * 100 : 0;
              return (
                <Row
                  key={r.person.id}
                  href={`/owed/person?id=${r.person.id}`}
                  lead={<Avatar name={r.person.name} color={r.person.color} avatar={avatars.get(r.person.id)} size={36} />}
                  title={r.person.name}
                  archived={r.person.archived}
                  sub={
                    <div className="mt-1 flex items-center gap-2">
                      <Progress value={pct} className="h-1.5 flex-1" />
                      <span className="num">{Math.round(pct)}% repaid</span>
                    </div>
                  }
                  trail={
                    <>
                      <Money minor={r.outstanding} className="font-semibold" />
                      <p className="text-[0.68rem] text-ink-3">{r.open ? `${r.open} open` : "settled"}</p>
                    </>
                  }
                />
              );
            })}
          </Card>
        ) : (
          <EmptyState
            icon={<HandCoins className="size-6" />}
            title={filter === "open" ? "Nobody owes you right now" : "No settled debts yet"}
            body="Split a purchase when adding it, or record a standalone debt."
            action={filter === "open" && <Button onClick={onAdd}>Record a debt</Button>}
          />
        )}
      </section>
    </div>
  );
}
