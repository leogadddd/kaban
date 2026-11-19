"use client";

import Link from "next/link";
import { createElement } from "react";
import { Split } from "lucide-react";
import { iconFor, TYPE_LABEL } from "@/lib/categories";
import { formatDay, relativeDayLabel } from "@/lib/dates";
import type { Ledger } from "@/lib/hooks";
import { formatMoney } from "@/lib/money";
import type { Account, Txn } from "@/lib/types";
import { cx } from "./ui";

/** Signed amount from the point of view of `perspective` (or of the user's money overall). */
export function displayAmount(t: Txn, accById: Map<string, Account>, perspective?: string): { amount: number; tone: "expense" | "income" | "neutral" } {
  const src = accById.get(t.accountId);
  if (perspective) {
    const acc = accById.get(perspective);
    if (acc) {
      const isSrc = t.accountId === perspective;
      switch (t.type) {
        case "expense":
          return { amount: -t.amountMinor, tone: "expense" };
        case "income":
        case "reimbursement":
          return { amount: t.amountMinor, tone: "income" };
        case "refund":
          return { amount: t.amountMinor, tone: "income" };
        case "transfer":
          return isSrc ? { amount: -t.amountMinor, tone: "neutral" } : { amount: t.amountMinor, tone: "neutral" };
        case "card_payment":
          return isSrc ? { amount: -t.amountMinor, tone: "neutral" } : { amount: t.amountMinor, tone: "income" };
        case "adjustment":
          return { amount: acc.type === "credit" ? -t.amountMinor : t.amountMinor, tone: "neutral" };
      }
    }
  }
  switch (t.type) {
    case "expense":
      return { amount: -t.amountMinor, tone: "expense" };
    case "income":
    case "reimbursement":
    case "refund":
      return { amount: t.amountMinor, tone: "income" };
    case "adjustment":
      return { amount: src?.type === "credit" ? -t.amountMinor : t.amountMinor, tone: "neutral" };
    default:
      return { amount: -t.amountMinor, tone: "neutral" };
  }
}

export function TxnRow({ t, ledger, perspective, showDate = true }: { t: Txn; ledger: Ledger; perspective?: string; showDate?: boolean }) {
  const acc = ledger.accountById.get(t.accountId);
  const to = t.toAccountId ? ledger.accountById.get(t.toAccountId) : undefined;
  const { amount, tone } = displayAmount(t, ledger.accountById, perspective);
  const split = ledger.splits.some((s) => s.transactionId === t.id);
  const voided = t.state === "void";
  const sub = [
    t.type === "transfer" || t.type === "card_payment" ? `${acc?.name ?? "?"} → ${to?.name ?? "?"}` : acc?.name,
    t.arrangement === "instalment" ? `${t.instalmentCount}× instalment` : t.arrangement === "deferred" ? "Deferred" : null,
    showDate ? formatDay(t.date) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link href={`/add?edit=${t.id}`} className={cx("flex min-h-16 items-center gap-3 rounded-2xl px-2 py-2 active:bg-pale", voided && "opacity-45")}>
      <span className={cx("grid size-11 shrink-0 place-items-center rounded-2xl", tone === "expense" ? "bg-expense/10 text-expense" : tone === "income" ? "bg-income/10 text-income" : "bg-pale text-brand")}>
        {createElement(iconFor(t.type, t.category), { className: "size-5" })}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cx("truncate font-medium", voided && "line-through")}>{t.description || t.category || TYPE_LABEL[t.type]}</p>
        <p className="truncate text-xs text-ink-3">
          {split && <Split className="mr-1 inline size-3 align-[-2px]" />}
          {sub}
        </p>
      </div>
      <div className="text-right">
        <p className={cx("num font-semibold", tone === "expense" ? "text-ink" : tone === "income" ? "text-income" : "text-ink-2")}>{formatMoney(amount, { sign: true })}</p>
        <p className="text-[0.68rem] text-ink-3">{voided ? "Voided" : TYPE_LABEL[t.type]}</p>
      </div>
    </Link>
  );
}

export function GroupedTxns({ txns, ledger, perspective }: { txns: Txn[]; ledger: Ledger; perspective?: string }) {
  const groups: { day: string; items: Txn[] }[] = [];
  for (const t of txns) {
    const last = groups[groups.length - 1];
    if (last && last.day === t.date) last.items.push(t);
    else groups.push({ day: t.date, items: [t] });
  }
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g.day}>
          <h3 className="mb-1 px-2 text-xs font-semibold tracking-wide text-ink-3 uppercase">{relativeDayLabel(g.day)}</h3>
          <div className="rounded-3xl border border-line bg-white p-1.5 shadow-soft">
            {g.items.map((t) => (
              <TxnRow key={t.id} t={t} ledger={ledger} perspective={perspective} showDate={false} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
