"use client";

import { createElement, useMemo, useState } from "react";
import { AlertTriangle, Repeat, TrendingDown, TrendingUp } from "lucide-react";
import { GroupedTxns } from "@/components/txn-row";
import { Card, cx, EmptyState, Loading, Money, PageHeader, SectionTitle, Sheet } from "@/components/ui";
import { iconFor } from "@/lib/categories";
import { daysBetween, formatDay, todayISO } from "@/lib/dates";
import { useLedger } from "@/lib/hooks";
import { CADENCE_LABEL, detectRecurring, type Recurring } from "@/lib/tools";

function PriceNote({ r }: { r: Recurring }) {
  const change = r.priceChange;
  if (!change) return null;
  if (change.kind === "changed") {
    const up = change.to > change.from;
    const Icon = up ? TrendingUp : TrendingDown;
    return (
      <p className={cx("mt-1 flex items-center gap-1 text-xs font-medium", up ? "text-expense" : "text-income")}>
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        Price {up ? "went up" : "went down"}: <Money minor={change.from} /> → <Money minor={change.to} />
      </p>
    );
  }
  return (
    <p className="mt-1 flex items-center gap-1 text-xs font-medium text-gold">
      <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
      Last one was higher than usual: <Money minor={change.to} /> vs <Money minor={change.usual} />
    </p>
  );
}

function RecurringRow({ r, today, onOpen }: { r: Recurring; today: string; onOpen: () => void }) {
  const inDays = daysBetween(today, r.next);
  const when = r.lapsed
    ? `Last charged ${formatDay(r.last.date)}`
    : inDays < 0 ? `Expected ${formatDay(r.next)}, not recorded yet` : inDays === 0 ? "Expected today" : `Next ${formatDay(r.next)} · in ${inDays} ${inDays === 1 ? "day" : "days"}`;
  return (
    <li>
      <button type="button" onClick={onOpen} aria-haspopup="dialog" className="flex w-full items-start gap-3 rounded-2xl px-2 py-3 text-left hover:bg-pale active:bg-pale">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-pale text-brand" aria-hidden="true">{createElement(iconFor("expense", r.category), { className: "size-[1.1rem]" })}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate text-sm font-semibold">{r.label}</span>
            <Money minor={r.typical} className="shrink-0 text-sm font-semibold" />
          </span>
          <span className="flex justify-between gap-2 text-xs text-ink-3">
            <span className={cx("min-w-0 truncate", !r.lapsed && inDays < 0 && "text-gold")}>{when}</span>
            <span className="shrink-0">{CADENCE_LABEL[r.cadence]}{r.fixed ? "" : " · varies"}</span>
          </span>
          {!r.fixed && <span className="block text-xs text-ink-3"><Money minor={r.low} /> – <Money minor={r.high} /> over {r.txns.length} charges</span>}
          <PriceNote r={r} />
        </span>
      </button>
    </li>
  );
}

export default function RecurringPage() {
  const ledger = useLedger();
  const today = todayISO();
  const all = useMemo(() => detectRecurring(ledger.txns, today), [ledger.txns, today]);
  const active = all.filter((r) => !r.lapsed);
  const stopped = all.filter((r) => r.lapsed);
  const changed = active.filter((r) => r.priceChange);
  const monthly = active.reduce((s, r) => s + Math.round((r.typical * 30) / r.interval), 0);
  const [open, setOpen] = useState<Recurring | null>(null);

  return (
    <>
      <PageHeader title="Recurring bills" back="/tools" />
      {!ledger.ready ? <Loading /> : !all.length ? (
        <Card className="mx-4">
          <EmptyState icon={<Repeat className="size-6" />} title="Nothing recurring yet" body="Bills and subscriptions show up here once the same payment appears at a steady interval, like Meralco every month." />
        </Card>
      ) : (
        <div className="space-y-4 px-4 pb-4">
          <div className="grid grid-cols-2 gap-2">
            <Card className="min-w-0 p-3.5">
              <p className="text-xs font-medium text-ink-3">About per month</p>
              <Money minor={monthly} className="mt-1 block truncate text-lg font-semibold" />
              <p className="text-xs text-ink-3">{active.length} recurring</p>
            </Card>
            <Card className="min-w-0 p-3.5">
              <p className="text-xs font-medium text-ink-3">Price changes</p>
              <p className="mt-1 flex items-center gap-1.5 text-lg font-semibold">
                {changed.length > 0 && <AlertTriangle className="size-4 text-gold" aria-hidden="true" />}
                {changed.length}
              </p>
              <p className="truncate text-xs text-ink-3">{changed.length ? changed.map((r) => r.label).join(", ") : "All steady"}</p>
            </Card>
          </div>

          {active.length > 0 && (
            <Card className="p-2">
              <div className="px-2 pt-2"><SectionTitle>Upcoming</SectionTitle></div>
              <ul>{active.map((r) => <RecurringRow key={r.key} r={r} today={today} onOpen={() => setOpen(r)} />)}</ul>
            </Card>
          )}
          {stopped.length > 0 && (
            <Card className="p-2">
              <div className="px-2 pt-2"><SectionTitle>Might have stopped</SectionTitle></div>
              <p className="-mt-1 px-3 pb-1 text-xs text-ink-3">No charge since it was last expected. Not counted in Safe to spend.</p>
              <ul>{stopped.map((r) => <RecurringRow key={r.key} r={r} today={today} onOpen={() => setOpen(r)} />)}</ul>
            </Card>
          )}
          <p className="px-1 text-xs text-ink-3">Found by matching descriptions that repeat at a steady interval. Amounts are the typical (median) charge.</p>

          <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.label ?? "Recurring"}>
            {open && (
              <div className="space-y-3">
                <p className="text-sm text-ink-3">{CADENCE_LABEL[open.cadence]} · {open.txns.length} {open.txns.length === 1 ? "charge" : "charges"} · typical <Money minor={open.typical} /></p>
                <GroupedTxns txns={open.txns} ledger={ledger} />
              </div>
            )}
          </Sheet>
        </div>
      )}
    </>
  );
}
