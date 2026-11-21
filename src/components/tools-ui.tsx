"use client";

import Link from "next/link";
import { AlertTriangle, ChevronRight, OctagonAlert, ShieldCheck, Wrench } from "lucide-react";
import { Area, ComposedChart, CartesianGrid, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDay } from "@/lib/dates";
import { useMoney } from "@/lib/privacy";
import type { BudgetLevel, ForecastPoint } from "@/lib/tools";
import { useSafeToSpend } from "@/lib/tools-hooks";
import { cx, Money } from "./ui";

const INK3 = "var(--color-ink-3)";
const LINE = "var(--color-line)";
const AXIS_TICK = { fill: INK3, fontSize: 10 };

/** Header pill that opens the Tools area (Analytics header, Home). */
export function ToolsLink({ className }: { className?: string }) {
  return (
    <Link href="/tools" className={cx("inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-sm font-medium text-brand shadow-soft hover:bg-pale active:scale-[0.98]", className)}>
      <Wrench className="size-4" aria-hidden="true" /> Tools
    </Link>
  );
}

export function daysLabel(n: number) {
  return `${n} ${n === 1 ? "day" : "days"}`;
}

/** Compact "Safe to spend today" card for Home; opens the full breakdown. */
export function SafeToSpendCard() {
  const { allowance, ready, ledger } = useSafeToSpend();
  const { hidden } = useMoney();
  if (!ready || !ledger.activeAccounts.some((a) => a.type !== "credit")) return null;
  const { perDay, leftToday, spentToday, cycle } = allowance;
  const over = perDay <= 0;
  const usedShare = perDay > 0 ? Math.min(100, (spentToday / perDay) * 100) : 100;
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-soft">
    <Link href="/tools/safe-to-spend" className="block p-4 pb-3.5 hover:bg-pale active:bg-pale">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-medium text-ink-3">
            <ShieldCheck className="size-3.5 text-brand" aria-hidden="true" /> Safe to spend today
          </p>
          <Money minor={perDay} className={cx("mt-1 block text-2xl font-semibold tracking-tight", over && "text-expense")} />
        </div>
        <span className="mt-1 flex shrink-0 items-center gap-0.5 text-xs font-medium text-brand">
          Breakdown <ChevronRight className="size-3.5" aria-hidden="true" />
        </span>
      </div>
      {over ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-expense">
          <OctagonAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          Bills and card dues before payday are more than your cash.
        </p>
      ) : (
        <>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-pale" aria-hidden="true">
            {!hidden && <div className="h-full rounded-full" style={{ width: `${Math.max(spentToday > 0 ? 3 : 0, usedShare)}%`, background: leftToday < 0 ? "var(--color-expense)" : "var(--color-brand)" }} />}
          </div>
          <p className="mt-2 flex flex-wrap justify-between gap-x-3 text-xs text-ink-3">
            <span>
              {leftToday < 0
                ? <span className="inline-flex items-center gap-1 font-medium text-expense"><AlertTriangle className="size-3.5" aria-hidden="true" /> Over by <Money minor={-leftToday} /></span>
                : <><Money minor={leftToday} className="font-medium text-ink-2" /> left today</>}
            </span>
            <span>{daysLabel(cycle.daysLeft)} to payday · {formatDay(cycle.nextPayday)}</span>
          </p>
        </>
      )}
    </Link>
    <Link href="/tools" className="flex min-h-11 items-center justify-between gap-2 border-t border-line px-4 text-xs font-medium text-ink-2 hover:bg-pale active:bg-pale">
      <span className="flex items-center gap-1.5"><Wrench className="size-3.5 text-brand" aria-hidden="true" /> Budgets, forecast and more tools</span>
      <ChevronRight className="size-3.5 text-ink-3" aria-hidden="true" />
    </Link>
    </div>
  );
}

/** Warning text plus icon (never color alone) for a budget's level. */
export function BudgetFlag({ level, className }: { level: BudgetLevel; className?: string }) {
  if (level === "ok") return null;
  const Icon = level === "over" ? OctagonAlert : AlertTriangle;
  return (
    <span className={cx("inline-flex items-center gap-1 text-xs font-medium", level === "over" ? "text-expense" : "text-gold", className)}>
      <Icon className="size-3.5" aria-hidden="true" />
      {level === "over" ? "Over budget" : "Nearly there"}
    </span>
  );
}

/** Projected cash balance with a low/high band and the lowest point marked. */
export function ForecastChart({ points, lowest }: { points: ForecastPoint[]; lowest: ForecastPoint | null }) {
  const { fmt } = useMoney();
  const data = points.map((p) => ({ date: p.date, balance: p.balance, band: p.band, events: p.events }));
  const values = points.flatMap((p) => [p.band[0], p.band[1]]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(1, (max - min) * 0.08);
  return (
    <figure>
      <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-3">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded-full bg-brand" />Projected balance</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-3 rounded-sm bg-brand/25" />Likely range</span>
        {lowest && <span className="flex items-center gap-1.5"><span className="size-2 rounded-full border-2 border-expense bg-surface" />Lowest point</span>}
      </div>
      <div className="h-48 sm:h-56" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} accessibilityLayer={false} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={LINE} strokeDasharray="3 4" />
            <XAxis dataKey="date" tickFormatter={(d) => formatDay(d)} tickLine={false} axisLine={false} tick={AXIS_TICK} minTickGap={28} />
            <YAxis width={46} tickCount={4} domain={[Math.floor(min - pad), Math.ceil(max + pad)]} tickFormatter={(v) => fmt(v, { compact: true })} tickLine={false} axisLine={false} tick={AXIS_TICK} />
            {min < 0 && <ReferenceLine y={0} stroke="var(--color-expense)" strokeDasharray="4 4" strokeOpacity={0.6} />}
            <Tooltip
              cursor={{ stroke: INK3, strokeWidth: 1, strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as (typeof data)[number] | undefined;
                if (!active || !p) return null;
                return (
                  <div className="max-w-52 rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-float">
                    <p className="mb-1 text-ink-3">{formatDay(p.date)}</p>
                    <p className="num">Balance <b className="amount">{fmt(p.balance)}</b></p>
                    <p className="num text-ink-3">Range {fmt(p.band[0], { compact: true })} – {fmt(p.band[1], { compact: true })}</p>
                    {p.events.map((e, i) => (
                      <p key={i} className="num mt-0.5 truncate">{e.label} <b className={cx("amount", e.amount < 0 ? "text-expense" : "text-income")}>{fmt(e.amount, { sign: true })}</b></p>
                    ))}
                  </div>
                );
              }}
            />
            <Area type="stepAfter" dataKey="band" stroke="none" fill="var(--color-brand)" fillOpacity={0.2} isAnimationActive={false} activeDot={false} />
            <Line type="stepAfter" dataKey="balance" stroke="var(--color-brand)" strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--color-surface)", strokeWidth: 2 }} />
            {lowest && <ReferenceDot x={lowest.date} y={lowest.balance} r={5} fill="var(--color-surface)" stroke="var(--color-expense)" strokeWidth={2.5} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
