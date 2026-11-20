"use client";

import Link from "next/link";
import { CalendarClock, CreditCard, History, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";
import { DateField } from "@/components/date-field";
import { HapticButton, HapticLink } from "@/components/haptic-button";
import { SwipeHub, Tile, Tiles, type HubPane } from "@/components/swipe-hub";
import { GroupedTxns } from "@/components/txn-row";
import { ButtonLink, Card, Chip, cx, EmptyState, inputCls, Money, Progress, Segmented } from "@/components/ui";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, TYPE_LABEL } from "@/lib/categories";
import { formatDay, todayISO } from "@/lib/dates";
import { useLedger } from "@/lib/hooks";
import type { TxnType } from "@/lib/types";

type Ledger = ReturnType<typeof useLedger>;

/** All activity, Payments and Instalments: one swipeable screen under the Activity tab. */
export function ActivityHub() {
  const ledger = useLedger();
  const panes: HubPane[] = [
    { href: "/activity", tab: "All", title: "Activity", content: <AllPane ledger={ledger} /> },
    {
      href: "/payments",
      tab: "Payments",
      title: "Payment history",
      action: (
        <HapticLink href="/add?type=card_payment" className="grid size-11 place-items-center rounded-full bg-brand text-on-brand shadow-soft" aria-label="Record card payment">
          <Plus className="size-5" />
        </HapticLink>
      ),
      content: <PaymentsPane ledger={ledger} />,
    },
    { href: "/instalments", tab: "Instalments", title: "Instalments", content: <InstalmentsPane ledger={ledger} /> },
  ];
  return <SwipeHub title="Activity" panes={panes} ready={ledger.ready} back="/home" />;
}

/* ---------- All ---------- */

type Range = "all" | "month" | "30" | "custom";

function AllPane({ ledger }: { ledger: Ledger }) {
  const [q, setQ] = useState("");
  const [accountId, setAccountId] = useState("");
  const [type, setType] = useState<TxnType | "">("");
  const [category, setCategory] = useState("");
  const [range, setRange] = useState<Range>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showVoid, setShowVoid] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const d30 = new Date(now.getTime() - 30 * 86400000);
    const thirty = `${d30.getFullYear()}-${String(d30.getMonth() + 1).padStart(2, "0")}-${String(d30.getDate()).padStart(2, "0")}`;
    const needle = q.trim().toLowerCase();
    return ledger.txns.filter((t) => {
      if (!showVoid && t.state === "void") return false;
      if (accountId && t.accountId !== accountId && t.toAccountId !== accountId) return false;
      if (type && t.type !== type) return false;
      if (category && t.category !== category) return false;
      if (range === "month" && t.date < monthStart) return false;
      if (range === "30" && t.date < thirty) return false;
      if (range === "custom" && ((from && t.date < from) || (to && t.date > to))) return false;
      if (needle && !`${t.description} ${t.category ?? ""} ${t.notes ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [ledger.txns, q, accountId, type, category, range, from, to, showVoid]);

  const spent = filtered.filter((t) => t.type === "expense" && t.state === "active").reduce((s, t) => s + t.amountMinor, 0);
  const earned = filtered.filter((t) => t.type === "income" && t.state === "active").reduce((s, t) => s + t.amountMinor, 0);
  const activeFilters = [accountId, type, category, range !== "all" ? range : "", showVoid ? "v" : ""].filter(Boolean).length;
  const clear = () => {
    setAccountId("");
    setType("");
    setCategory("");
    setRange("all");
    setShowVoid(false);
  };

  return (
    <>
      <Tiles className="mb-4 lg:hidden">
        <Tile label="Spent"><Money minor={spent} /></Tile>
        <Tile label="Earned" dark><Money minor={earned} /></Tile>
      </Tiles>
      <div className="space-y-4 pb-4 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-x-6 lg:gap-y-4 lg:space-y-0">
        <div className="flex gap-2 lg:col-start-1 lg:row-start-1">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" />
            <input className={cx(inputCls, "pl-10")} placeholder="Search description, category, notes" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search transactions" type="search" />
          </div>
          <HapticButton
            wrapperClassName="shrink-0 lg:hidden"
            onClick={() => setFiltersOpen((v) => !v)}
            className={cx("relative grid size-12 place-items-center rounded-2xl border", filtersOpen || activeFilters ? "border-brand bg-brand text-on-brand" : "border-line bg-surface")}
            aria-label="Filters"
            aria-expanded={filtersOpen}
          >
            <SlidersHorizontal className="size-5" />
            {activeFilters > 0 && <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-gold text-[0.65rem] text-white">{activeFilters}</span>}
          </HapticButton>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <Card className={cx("space-y-3", !filtersOpen && "hidden lg:block")}>
            <p className="hidden text-sm font-semibold lg:block">Filters</p>
            <Segmented<Range>
              size="sm"
              value={range}
              onChange={setRange}
              options={[
                { value: "all", label: "All" },
                { value: "month", label: "Month" },
                { value: "30", label: "30 days" },
                { value: "custom", label: "Custom" },
              ]}
            />
            {range === "custom" && (
              <div className="grid grid-cols-2 gap-2">
                <DateField compact value={from} onChange={setFrom} placeholder="From" title="From date" max={to || undefined} allowClear />
                <DateField compact value={to} onChange={setTo} placeholder="To" title="To date" min={from || undefined} allowClear />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <select className={inputCls} value={accountId} onChange={(e) => setAccountId(e.target.value)} aria-label="Account">
                <option value="">All accounts</option>
                {ledger.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as TxnType | "")} aria-label="Type">
                <option value="">All types</option>
                {(Object.keys(TYPE_LABEL) as TxnType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
            </div>
            <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
              <option value="">All categories</option>
              {[...new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].map((c) => c.name))].map((c) => <option key={c}>{c}</option>)}
            </select>
            <div className="flex items-center justify-between">
              <Chip active={showVoid} onClick={() => setShowVoid((v) => !v)}>Show voided</Chip>
              {activeFilters > 0 && <HapticButton onClick={clear} className="flex items-center gap-1 text-sm text-brand"><X className="size-4" /> Clear</HapticButton>}
            </div>
          </Card>

          <div className="hidden grid-cols-2 gap-3 lg:grid">
            <Card className="p-3"><p className="text-xs text-ink-3">Spent</p><Money minor={spent} className="font-semibold" /></Card>
            <Card className="p-3"><p className="text-xs text-ink-3">Earned</p><Money minor={earned} className="font-semibold text-income" /></Card>
          </div>
        </aside>

        <div className="lg:col-start-1 lg:row-start-2">
          {filtered.length ? <GroupedTxns txns={filtered} ledger={ledger} /> : <EmptyState icon={<Search className="size-6" />} title="No matching transactions" body="Try a different search or clear filters." />}
        </div>
      </div>
    </>
  );
}

/* ---------- Payments ---------- */

function PaymentsPane({ ledger }: { ledger: Ledger }) {
  const [kind, setKind] = useState<"card" | "received">("card");
  const active = ledger.txns.filter((t) => t.state === "active");
  const card = active.filter((t) => t.type === "card_payment");
  const received = active.filter((t) => t.type === "reimbursement");
  const items = kind === "card" ? card : received;
  const sum = (ts: typeof active) => ts.reduce((s, t) => s + t.amountMinor, 0);

  return (
    <div className="space-y-4 pb-4">
      <Tiles>
        <Tile label="Paid to cards"><Money minor={sum(card)} /></Tile>
        <Tile label="Received from people" dark><Money minor={sum(received)} /></Tile>
      </Tiles>
      <div className="flex gap-1.5">
        <Chip active={kind === "card"} onClick={() => setKind("card")}><CreditCard className="size-4" /> Card payments</Chip>
        <Chip active={kind === "received"} onClick={() => setKind("received")}>Received</Chip>
      </div>
      {items.length ? (
        <GroupedTxns txns={items} ledger={ledger} />
      ) : (
        <EmptyState
          icon={<History className="size-6" />}
          title={kind === "card" ? "No card payments yet" : "Nothing received yet"}
          body={kind === "card" ? "Payments you make to your credit cards show up here." : "Repayments from people you split with or lent to show up here."}
          action={kind === "card" && <ButtonLink href="/add?type=card_payment">Record card payment</ButtonLink>}
        />
      )}
    </div>
  );
}

/* ---------- Instalments ---------- */

function InstalmentsPane({ ledger }: { ledger: Ledger }) {
  const today = todayISO();
  const plans = ledger.txns
    .filter((t) => t.state === "active" && t.arrangement === "instalment")
    .map((t) => {
      const entries = ledger.instalments.filter((e) => e.transactionId === t.id).sort((a, b) => a.index - b.index);
      const billed = entries.filter((e) => e.statementDate <= today);
      return { t, entries, billed, remaining: entries.filter((e) => e.statementDate > today).reduce((s, e) => s + e.amountMinor, 0) };
    });
  const totalRemaining = plans.reduce((s, p) => s + p.remaining, 0);
  const activePlans = plans.filter((p) => p.remaining > 0).length;

  return (
    <div className="space-y-4 pb-4">
      <Tiles className="lg:hidden">
        <Tile label="Still to be billed"><Money minor={totalRemaining} /></Tile>
        <Tile label="Active plans" dark><span className="num">{activePlans}</span></Tile>
      </Tiles>
      {plans.length ? (
        <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5 lg:space-y-0">
          {plans.map(({ t, entries, billed, remaining }) => (
            <Card key={t.id} className="space-y-3">
              <Link href={`/add?edit=${t.id}`} className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{t.description}</p>
                  <p className="text-xs text-ink-3">
                    {ledger.accountById.get(t.accountId)?.name} · bought {formatDay(t.date)} · {t.instalmentCount} months
                  </p>
                </div>
                <div className="text-right">
                  <Money minor={t.amountMinor} className="font-semibold" />
                  <p className="text-xs text-ink-3">one purchase</p>
                </div>
              </Link>
              <div className="flex items-center gap-3">
                <Progress value={(billed.length / entries.length) * 100} className="flex-1" />
                <span className="num text-xs text-ink-3">{billed.length}/{entries.length} billed</span>
              </div>
              <ol className="grid grid-cols-2 gap-1.5 text-xs">
                {entries.map((e) => {
                  const done = e.statementDate <= today;
                  return (
                    <li key={e.id} className={done ? "flex justify-between rounded-xl bg-pale px-2.5 py-2 text-ink-3" : "flex justify-between rounded-xl border border-line px-2.5 py-2"}>
                      <span>
                        <b className="num">{e.index}</b> · {formatDay(e.statementDate)}
                      </span>
                      <Money minor={e.amountMinor} className="font-medium" />
                    </li>
                  );
                })}
              </ol>
              <p className="text-xs text-ink-3">
                Remaining to bill <Money minor={remaining} className="font-semibold text-ink" /> · statuses are by statement date (billed once it has closed).
              </p>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={<CalendarClock className="size-6" />} title="No instalment plans" body="Pick “Instalment” when adding a credit-card purchase to spread its billing over months." />
      )}
    </div>
  );
}
