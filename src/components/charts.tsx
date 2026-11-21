"use client";

import { motion } from "motion/react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronRight } from "lucide-react";
import { formatAnalyticsRange, type AnalyticsBucket } from "@/lib/analytics";
import { formatDay } from "@/lib/dates";
import { useMoney } from "@/lib/privacy";
import { cx, Money } from "./ui";

const INK3 = "var(--color-ink-3)";
const LINE = "var(--color-line)";
const SERIES_IN = "var(--color-income)";
const SERIES_OUT = "var(--color-expense)";

function Tip({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-float">{children}</div>;
}

/** Single-series daily spend trend (title names the series; no legend needed). */
export function SpendTrend({ data, height = 140 }: { data: { day: string; amount: number }[]; height?: number }) {
  const { fmt } = useMoney();
  const total = data.reduce((s, d) => s + d.amount, 0);
  return (
    <figure>
      <div style={{ height }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="spendFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--color-brand-2)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--color-brand-2)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" hide />
            <YAxis hide domain={[0, "dataMax"]} />
            <Tooltip
              cursor={{ stroke: "var(--color-brand)", strokeWidth: 1, strokeDasharray: "3 3" }}
              content={({ active, payload }) =>
                active && payload?.[0] ? (
                  <Tip>
                    <p className="text-ink-3">{formatDay(payload[0].payload.day)}</p>
                    <p className="num amount font-semibold">{fmt(payload[0].payload.amount)}</p>
                  </Tip>
                ) : null
              }
            />
            <Area type="monotone" dataKey="amount" stroke="var(--color-brand)" strokeWidth={2} fill="url(#spendFill)" activeDot={{ r: 5, stroke: "var(--color-surface)", strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        Daily spending over the last {data.length} days, total {fmt(total)}.
      </figcaption>
    </figure>
  );
}

/** Select a chart bar or its table row to view the transactions for that period. */
export function FlowChart({ data, onSelect }: { data: AnalyticsBucket[]; onSelect: (bucket: AnalyticsBucket) => void }) {
  const { fmt, hidden } = useMoney();
  const selectBar = (_: unknown, index: number) => {
    const bucket = data[index];
    if (bucket) onSelect(bucket);
  };
  return (
    <figure>
      {!hidden && (
        <>
          <div className="mb-2 flex gap-4 text-xs text-ink-2">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: SERIES_IN }} /> Income</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: SERIES_OUT }} /> Expenses</span>
          </div>
          <p className="mb-1 text-xs text-ink-3">Select a bar to see its transactions.</p>
          <div className="h-[200px]" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} accessibilityLayer={false} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={2} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke={LINE} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: INK3, fontSize: 11 }} minTickGap={12} />
                <YAxis width={44} tickFormatter={(v) => fmt(v, { compact: true })} tickLine={false} axisLine={false} tick={{ fill: INK3, fontSize: 10 }} />
                <Tooltip
                  cursor={{ fill: "var(--color-pale)", fillOpacity: 0.45, stroke: "none" }}
                  content={({ active, payload }) =>
                    active && payload?.[0] ? (
                      <Tip>
                        <p className="mb-1 text-ink-3">{formatAnalyticsRange(payload[0].payload)}</p>
                        <p className="num">Income <b className="amount">{fmt(payload[0].payload.income)}</b></p>
                        <p className="num">Expenses <b className="amount">{fmt(payload[0].payload.expense)}</b></p>
                      </Tip>
                    ) : null
                  }
                />
                <Bar dataKey="income" fill={SERIES_IN} radius={[4, 4, 0, 0]} maxBarSize={24} onClick={selectBar} className="cursor-pointer" />
                <Bar dataKey="expense" fill={SERIES_OUT} radius={[4, 4, 0, 0]} maxBarSize={24} onClick={selectBar} className="cursor-pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
      <details className="mt-2 text-xs text-ink-2">
        <summary className="min-h-10 cursor-pointer py-2 font-medium text-brand">View periods as a table</summary>
        <table className="num mt-1 w-full">
          <thead className="text-ink-3">
            <tr><th scope="col" className="py-1 text-left font-medium">Period</th><th scope="col" className="text-right font-medium">Income</th><th scope="col" className="text-right font-medium">Expenses</th></tr>
          </thead>
          <tbody>
            {data.map((bucket) => (
              <tr key={bucket.from} className="border-t border-line">
                <th scope="row" className="pr-2 text-left font-normal">
                  <button type="button" onClick={() => onSelect(bucket)} aria-haspopup="dialog" className="min-h-11 text-left font-medium text-brand hover:underline">
                    {formatAnalyticsRange(bucket)}
                  </button>
                </th>
                <td className="text-right"><Money minor={bucket.income} /></td>
                <td className="text-right"><Money minor={bucket.expense} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

type CategoryChange = { category: string; amount: number; before: number };

export function CategoryBars({ data, onSelect }: { data: CategoryChange[]; onSelect: (category: string) => void }) {
  const { hidden } = useMoney();
  const top = Math.max(1, ...data.map((row) => row.amount));
  const total = data.reduce((sum, row) => sum + row.amount, 0);
  const rows = (items: CategoryChange[]) => items.map(({ category, amount, before }) => (
    <li key={category}>
      <button type="button" onClick={() => onSelect(category)} className="w-full rounded-xl p-2 text-left hover:bg-pale active:bg-pale" aria-haspopup="dialog">
        <span className="flex items-center justify-between gap-2 text-sm">
          <span className="min-w-0 break-words font-medium">{category}</span>
          <span className="flex shrink-0 items-center gap-1.5">
            <Money minor={amount} className="font-semibold" />
            <ChevronRight className="size-4 text-ink-3" aria-hidden="true" />
          </span>
        </span>
        {!hidden && (
          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-pale" aria-hidden="true">
            <span className="block h-full rounded-full bg-brand-2" style={{ width: `${(amount / top) * 100}%` }} />
          </span>
        )}
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-3">
          {!hidden && total > 0 && <span>{Math.round((amount / total) * 100)}% of spending</span>}
          <span><Money minor={amount - before} sign /> change</span>
        </span>
      </button>
    </li>
  ));
  return (
    <>
      <ul className="space-y-1">{rows(data.slice(0, 6))}</ul>
      {data.length > 6 && (
        <details className="mt-2">
          <summary className="min-h-10 cursor-pointer px-2 py-2 text-sm font-medium text-brand">More categories ({data.length - 6})</summary>
          <ul className="space-y-1">{rows(data.slice(6))}</ul>
        </details>
      )}
    </>
  );
}

/** Credit utilisation ring with the number in text (not color-alone). */
export function UtilisationRing({ value, size = 120, label = "utilised" }: { value: number; size?: number; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const r = 44;
  const c = 2 * Math.PI * r;
  const color = v >= 80 ? "var(--color-expense)" : v >= 50 ? "var(--color-gold)" : "var(--color-brand-2)";
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${v.toFixed(0)}% of credit limit ${label}`}>
      <svg viewBox="0 0 100 100" className="-rotate-90" width={size} height={size}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-pale)" strokeWidth="9" />
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v / 100) }}
          transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </svg>
      <div className="absolute text-center text-ink">
        <p className={cx("num font-semibold", size < 100 ? "text-lg" : "text-2xl")}>{v.toFixed(0)}%</p>
        <p className="text-[0.68rem] text-ink-3">{label}</p>
      </div>
    </div>
  );
}
