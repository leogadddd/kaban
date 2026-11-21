"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { ChevronRight, LineChart, PieChart, Repeat, ShieldCheck, type LucideIcon } from "lucide-react";
import { Loading, Money, PageHeader } from "@/components/ui";
import { daysLabel } from "@/components/tools-ui";
import { formatDay } from "@/lib/dates";
import { budgetStatuses, forecast } from "@/lib/tools";
import { useBudgets, useSafeToSpend } from "@/lib/tools-hooks";

function ToolCard({ href, icon: Icon, title, body, children }: { href: string; icon: LucideIcon; title: string; body: string; children?: ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-3xl border border-line bg-surface p-4 shadow-soft hover:bg-pale active:scale-[0.99]">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-pale text-brand" aria-hidden="true">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block text-xs text-ink-3">{body}</span>
        {children && <span className="mt-1.5 block text-sm text-ink-2">{children}</span>}
      </span>
      <ChevronRight className="size-5 shrink-0 text-ink-3" aria-hidden="true" />
    </Link>
  );
}

export default function ToolsPage() {
  const { ledger, allowance, paydays, recurring, today, ready } = useSafeToSpend();
  const budgets = useBudgets();
  const statuses = useMemo(() => budgetStatuses(budgets, ledger.txns, today, paydays), [budgets, ledger.txns, today, paydays]);
  const flagged = statuses.filter((s) => s.level !== "ok").length;
  const live = recurring.filter((r) => !r.lapsed);
  const changed = live.filter((r) => r.priceChange).length;
  const outlook = useMemo(() => forecast(ledger, today, allowance.cycle.nextPayday, paydays), [ledger, today, allowance.cycle.nextPayday, paydays]);

  return (
    <>
      <PageHeader title="Tools" back={true} subtitle="Plan the days until payday" />
      {!ready ? <Loading /> : (
        <div className="space-y-3 px-4 pb-4">
          <ToolCard href="/tools/safe-to-spend" icon={ShieldCheck} title="Safe to spend today" body="What you can spend each day until payday">
            <Money minor={allowance.perDay} className={allowance.perDay < 0 ? "font-semibold text-expense" : "font-semibold"} /> today · {daysLabel(allowance.cycle.daysLeft)} to {formatDay(allowance.cycle.nextPayday)}
          </ToolCard>
          <ToolCard href="/tools/budgets" icon={PieChart} title="Category budgets" body="Limits per category, by month or pay cycle">
            {!statuses.length ? "No budgets yet" : flagged ? `${statuses.length} ${statuses.length === 1 ? "budget" : "budgets"} · ${flagged} need attention` : `${statuses.length} ${statuses.length === 1 ? "budget" : "budgets"} · all on track`}
          </ToolCard>
          <ToolCard href="/tools/forecast" icon={LineChart} title="Cash-flow forecast" body="Where your balance is headed before payday">
            {!outlook.enoughHistory
              ? "Needs about 2 months of history"
              : outlook.lowest && outlook.lowest.balance < outlook.start
                ? <>Lowest around {formatDay(outlook.lowest.date)}: <Money minor={outlook.lowest.balance} className={outlook.lowest.balance < 0 ? "font-semibold text-expense" : "font-semibold"} /></>
                : "No dips expected before payday"}
          </ToolCard>
          <ToolCard href="/tools/recurring" icon={Repeat} title="Recurring bills" body="Bills and subscriptions found in your history">
            {!live.length ? "None found yet" : `${live.length} found${changed ? ` · ${changed} changed price` : ""}`}
          </ToolCard>
          <p className="px-1 pt-1 text-xs text-ink-3">
            Everything here is worked out on this device from your own transactions, with simple fixed rules.
            {ledger.activeAccounts.length === 0 && " Add an account to get started."}
          </p>
        </div>
      )}
    </>
  );
}
