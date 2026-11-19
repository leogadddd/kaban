"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, ChevronRight, CreditCard, HandCoins, Landmark, Plus, UserPlus, Users, Wallet, WalletCards } from "lucide-react";
import { useState, type ReactNode } from "react";
import { AccountCard } from "@/components/account-card";
import { BankLogo } from "@/components/bank-logo";
import { DebtSheet } from "@/components/debt-sheets";
import { HapticButton, HapticLink } from "@/components/haptic-button";
import { SwipePager } from "@/components/swipe-pager";
import { Avatar, Button, ButtonLink, Card, Chip, cx, EmptyState, Field, inputCls, Loading, Money, PageHeader, Progress, Segmented, Sheet } from "@/components/ui";
import { bankFor } from "@/lib/banks";
import { useIsDesktop, useLedger } from "@/lib/hooks";
import { savePerson } from "@/lib/repo";
import type { AccountType } from "@/lib/types";

type Ledger = ReturnType<typeof useLedger>;

/** The three pages under the Accounts tab, shown as one swipeable screen (like Home's Money / Credit). */
const PANES = [
  { href: "/accounts", key: "accounts", tab: "Accounts", title: "Accounts" },
  { href: "/people", key: "people", tab: "People", title: "People" },
  { href: "/owed", key: "owed", tab: "Owed to me", title: "Who Owes Me" },
] as const;

type PaneKey = (typeof PANES)[number]["key"];

const indexFor = (path: string) => Math.max(0, PANES.findIndex((p) => p.href === path));

export function AccountsHub() {
  const pathname = usePathname();
  const ledger = useLedger();
  const desktop = useIsDesktop();
  const [index, setIndex] = useState(() => indexFor(pathname));
  const [seenPath, setSeenPath] = useState(pathname);
  const [addingPerson, setAddingPerson] = useState(false);
  const [addingDebt, setAddingDebt] = useState(false);

  // Bottom-nav or sidebar navigation to one of the three routes moves the pager.
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setIndex(indexFor(pathname));
  }

  function select(i: number) {
    setIndex(i);
    // Keep the address in step so reload, share and back land on the same pane, without a page transition.
    if (window.location.pathname !== PANES[i].href) window.history.replaceState(window.history.state, "", PANES[i].href);
  }

  const key: PaneKey = PANES[index].key;
  const action = {
    accounts: (
      <HapticLink href="/accounts/new" className="grid size-11 place-items-center rounded-full bg-brand text-on-brand shadow-soft" aria-label="Add account">
        <Plus className="size-5" />
      </HapticLink>
    ),
    people: (
      <HapticButton onClick={() => setAddingPerson(true)} className="grid size-11 place-items-center rounded-full bg-brand text-on-brand shadow-soft" aria-label="Add person">
        <UserPlus className="size-5" />
      </HapticButton>
    ),
    owed: (
      <HapticButton onClick={() => setAddingDebt(true)} className="grid size-11 place-items-center rounded-full bg-brand text-on-brand shadow-soft" aria-label="Record a debt">
        <Plus className="size-5" />
      </HapticButton>
    ),
  }[key];

  const panes = [
    <AccountsPane key="accounts" ledger={ledger} />,
    <PeoplePane key="people" ledger={ledger} onAdd={() => setAddingPerson(true)} />,
    <OwedPane key="owed" ledger={ledger} onAdd={() => setAddingDebt(true)} />,
  ];

  return (
    <>
      <PageHeader
        title={desktop ? PANES[index].title : "Accounts"}
        action={
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={key} className="grid" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.16 }}>
              {action}
            </motion.span>
          </AnimatePresence>
        }
      />

      {!ledger.ready ? (
        <Loading />
      ) : desktop ? (
        // Desktop lists the three pages separately in the sidebar: show just the current one.
        <div className="px-4">{panes[index]}</div>
      ) : (
        <>
          <div className="px-4 pb-4">
            <Segmented<PaneKey> value={key} onChange={(k) => select(indexFor(PANES.find((p) => p.key === k)!.href))} options={PANES.map((p) => ({ value: p.key, label: p.tab }))} />
          </div>
          <SwipePager index={index} onIndexChange={select}>
            {panes}
          </SwipePager>
        </>
      )}

      <AddPersonSheet open={addingPerson} onClose={() => setAddingPerson(false)} />
      <DebtSheet open={addingDebt} onClose={() => setAddingDebt(false)} ledger={ledger} />
    </>
  );
}

/* ---------- Shared pieces so all three panes read the same ---------- */

function Tiles({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:hidden">{children}</div>;
}

function Tile({ label, children, dark }: { label: string; children: ReactNode; dark?: boolean }) {
  return (
    <Card className={dark ? "bg-night text-white dark:border-white/6" : "bg-pale"}>
      <p className={cx("text-xs", dark ? "text-white/60" : "text-ink-3")}>{label}</p>
      <div className="text-xl font-semibold">{children}</div>
    </Card>
  );
}

function GroupTitle({ icon: Icon, children }: { icon: typeof Wallet; children: ReactNode }) {
  return (
    <h2 className="mb-2 flex items-center gap-1.5 px-1 text-sm font-semibold text-ink-2">
      <Icon className="size-4" /> {children}
    </h2>
  );
}

function Row({ href, lead, title, sub, trail }: { href: string; lead: ReactNode; title: ReactNode; sub: ReactNode; trail?: ReactNode }) {
  return (
    <Link href={href} className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors active:bg-pale lg:hover:bg-pale">
      {lead}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{title}</p>
        <div className="truncate text-xs text-ink-3">{sub}</div>
      </div>
      {trail && <div className="shrink-0 text-right">{trail}</div>}
      <ChevronRight className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
    </Link>
  );
}

/* ---------- Accounts ---------- */

const GROUPS: { type: AccountType; label: string; icon: typeof Wallet }[] = [
  { type: "cash", label: "Cash", icon: Wallet },
  { type: "debit", label: "Debit & bank", icon: Landmark },
  { type: "credit", label: "Credit & pay later", icon: CreditCard },
];

function AccountsPane({ ledger }: { ledger: Ledger }) {
  const [showArchived, setShowArchived] = useState(false);
  const list = showArchived ? ledger.accounts : ledger.activeAccounts;
  const archivedCount = ledger.accounts.filter((a) => a.archived).length;

  return (
    <div className="space-y-5 pb-4">
      <DesktopAccounts ledger={ledger} list={list} />
      <Tiles>
        <Tile label="Available funds"><Money minor={ledger.totals.availableFunds} /></Tile>
        <Tile label="Credit outstanding" dark><Money minor={ledger.totals.creditOutstanding} /></Tile>
      </Tiles>

      <div className="space-y-5 lg:hidden">
        {GROUPS.map(({ type, label, icon }) => {
          const items = list.filter((a) => a.type === type);
          if (!items.length) return null;
          return (
            <section key={type}>
              <GroupTitle icon={icon}>{label}</GroupTitle>
              <Card className="divide-y divide-line p-0">
                {items.map((a) => {
                  const b = ledger.balances.get(a.id)!;
                  const bank = a.type === "cash" ? undefined : bankFor(a);
                  return (
                    <Row
                      key={a.id}
                      href={`/accounts/view?id=${a.id}`}
                      lead={bank ? <BankLogo bank={bank} size={36} /> : <span className="size-9 shrink-0 rounded-xl" style={{ background: a.color }} aria-hidden="true" />}
                      title={<>{a.name} {a.archived && <span className="ml-1 rounded-full bg-pale px-2 py-0.5 text-[0.65rem] text-ink-3">Archived</span>}</>}
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

      {archivedCount > 0 && (
        <Chip active={showArchived} onClick={() => setShowArchived((v) => !v)}>
          <Archive className="size-4" /> {showArchived ? "Hide" : "Show"} archived ({archivedCount})
        </Chip>
      )}
    </div>
  );
}

/** Desktop: summary tiles plus the visual account cards in a grid. */
function DesktopAccounts({ ledger, list }: { ledger: Ledger; list: Ledger["accounts"] }) {
  const owed = ledger.debtStatus.reduce((s, d) => s + Math.max(0, d.outstanding), 0);
  const tiles = [
    { label: "Available funds", value: ledger.totals.availableFunds, cls: "bg-pale" },
    { label: "Credit outstanding", value: ledger.totals.creditOutstanding, cls: "bg-night text-white dark:border-white/6", sub: "text-white/60" },
    { label: "Net position", value: ledger.totals.netPosition, cls: "bg-surface" },
    { label: "Owed to you", value: owed, cls: "bg-brand-2 text-on-brand", sub: "text-on-brand/75" },
  ];
  return (
    <div className="hidden space-y-8 lg:block">
      <div className="grid grid-cols-4 gap-4">
        {tiles.map((t) => (
          <Card key={t.label} className={t.cls}>
            <p className={t.sub ?? "text-sm text-ink-3"}>{t.label}</p>
            <Money minor={t.value} className="mt-1 block text-2xl font-semibold" />
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-5 xl:grid-cols-3">
        {GROUPS.flatMap(({ type }) => list.filter((a) => a.type === type)).map((a) => (
          <Link key={a.id} href={`/accounts/view?id=${a.id}`} className={a.archived ? "opacity-60" : "transition hover:-translate-y-1"}>
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

function PeoplePane({ ledger, onAdd }: { ledger: Ledger; onAdd: () => void }) {
  const people = ledger.people.filter((p) => !p.archived);
  const owedTotal = ledger.debtStatus.reduce((s, d) => s + Math.max(0, d.outstanding), 0);
  const owing = people.filter((p) => ledger.debtStatus.some((d) => d.debt.personId === p.id && d.outstanding > 0)).length;

  return (
    <div className="space-y-5 pb-4">
      <Tiles>
        <Tile label="People"><span className="num">{people.length}</span></Tile>
        <Tile label={owing ? `Owed by ${owing} ${owing === 1 ? "person" : "people"}` : "Owed to you"} dark><Money minor={owedTotal} /></Tile>
      </Tiles>

      {people.length ? (
        <section>
          <GroupTitle icon={Users}>Split bills and lend to</GroupTitle>
          <Card className="divide-y divide-line p-0">
            {people.map((p) => {
              const ds = ledger.debtStatus.filter((d) => d.debt.personId === p.id);
              const owes = ds.reduce((s, d) => s + Math.max(0, d.outstanding), 0);
              const shared = ds.reduce((s, d) => s + d.debt.amountMinor, 0);
              const paid = ds.reduce((s, d) => s + d.repaid, 0);
              return (
                <Row
                  key={p.id}
                  href={`/owed/person?id=${p.id}`}
                  lead={<Avatar name={p.name} color={p.color} size={36} />}
                  title={p.name}
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

function OwedPane({ ledger, onAdd }: { ledger: Ledger; onAdd: () => void }) {
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
      <Tiles>
        <Tile label="Owed to you"><Money minor={totalOutstanding} /></Tile>
        <Tile label="Repaid so far" dark><Money minor={totalRepaid} /></Tile>
      </Tiles>

      <section>
        <div className="mb-3 flex gap-1.5">
          <Chip active={filter === "open"} onClick={() => setFilter("open")}>Unsettled</Chip>
          <Chip active={filter === "settled"} onClick={() => setFilter("settled")}>Settled</Chip>
        </div>
        {rows.length ? (
          <Card className="divide-y divide-line p-0">
            {rows.map((r) => {
              const pct = r.total ? ((r.total - r.outstanding) / r.total) * 100 : 0;
              return (
                <Row
                  key={r.person.id}
                  href={`/owed/person?id=${r.person.id}`}
                  lead={<Avatar name={r.person.name} color={r.person.color} size={36} />}
                  title={r.person.name}
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
