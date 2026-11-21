"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronRight } from "lucide-react";
import { formatAnalyticsRange, type AnalyticsBucket } from "@/lib/analytics";
import { CHART_COLORS } from "@/lib/categories";
import { formatDay, todayISO } from "@/lib/dates";
import { useMoney } from "@/lib/privacy";
import { Card, cx, EmptyState, Money, Segmented } from "./ui";

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

/** Two views over the same buckets. Each opens the corresponding transactions. */
export function FlowReport({ data, hasActivity, onSelect }: {
  data: AnalyticsBucket[];
  hasActivity: boolean;
  onSelect: (bucket: AnalyticsBucket) => void;
}) {
  const { fmt, hidden } = useMoney();
  const [view, setView] = useState<"chart" | "table">("chart");
  const today = todayISO();
  const selectBar = (_: unknown, index: number) => {
    const bucket = data[index];
    if (bucket) onSelect(bucket);
  };

  return (
    <Card className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[0.95rem] font-semibold tracking-tight">Income vs. spending</h2>
        {hasActivity && !hidden && (
          <Segmented
            size="sm"
            value={view}
            onChange={setView}
            options={[{ value: "chart", label: "Chart" }, { value: "table", label: "Table" }]}
          />
        )}
      </div>
      {!hasActivity ? (
        <EmptyState title="No activity" />
      ) : view === "table" || hidden ? (
        <table className="num w-full table-fixed text-xs text-ink-2">
          <thead className="text-ink-3">
            <tr>
              <th scope="col" className="w-[38%] pb-2 text-left font-medium">Period</th>
              <th scope="col" className="pb-2 text-right font-medium">Income</th>
              <th scope="col" className="pb-2 text-right font-medium">Spent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.map((bucket) => (
              <tr key={bucket.from}>
                <th scope="row" className="pr-1 text-left font-normal">
                  <button type="button" onClick={() => onSelect(bucket)} aria-haspopup="dialog" className="min-h-11 text-left font-medium text-brand hover:underline">
                    {formatAnalyticsRange(bucket, today)}
                  </button>
                </th>
                <td className="wrap-anywhere pl-1 text-right"><Money minor={bucket.income} /></td>
                <td className="wrap-anywhere pl-1 text-right"><Money minor={bucket.expense} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <figure>
          <div className="mb-2 flex gap-3 text-xs text-ink-3">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: SERIES_IN }} /> Income</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: SERIES_OUT }} /> Spent</span>
          </div>
          <div className="h-40 sm:h-48" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} accessibilityLayer={false} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={3} barCategoryGap="26%">
                <CartesianGrid vertical={false} stroke={LINE} strokeDasharray="3 4" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: INK3, fontSize: 10 }} minTickGap={16} />
                <YAxis width={38} tickCount={3} tickFormatter={(v) => fmt(v, { compact: true })} tickLine={false} axisLine={false} tick={{ fill: INK3, fontSize: 10 }} />
                <Tooltip
                  cursor={{ fill: "var(--color-pale)", fillOpacity: 0.45, stroke: "none" }}
                  content={({ active, payload }) =>
                    active && payload?.[0] ? (
                      <Tip>
                        <p className="mb-1 text-ink-3">{formatAnalyticsRange(payload[0].payload, today)}</p>
                        <p className="num">Income <b className="amount">{fmt(payload[0].payload.income)}</b></p>
                        <p className="num">Spent <b className="amount">{fmt(payload[0].payload.expense)}</b></p>
                      </Tip>
                    ) : null
                  }
                />
                <Bar dataKey="income" fill={SERIES_IN} radius={[6, 6, 2, 2]} maxBarSize={22} onClick={selectBar} className="cursor-pointer" />
                <Bar dataKey="expense" fill={SERIES_OUT} radius={[6, 6, 2, 2]} maxBarSize={22} onClick={selectBar} className="cursor-pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </figure>
      )}
    </Card>
  );
}

type CategoryChange = { category: string; amount: number; before: number };

export function CategoryChart({ data, onSelect }: { data: CategoryChange[]; onSelect: (category: string) => void }) {
  const { hidden } = useMoney();
  const rows = data.map((row, index) => ({ ...row, fill: CHART_COLORS[index % CHART_COLORS.length] }));
  const slices = rows.filter(({ amount }) => amount > 0);
  const total = slices.reduce((sum, row) => sum + row.amount, 0);
  const listItems = (items: typeof rows) => items.map(({ category, amount, before, fill }) => (
    <li key={category}>
      <button type="button" onClick={() => onSelect(category)} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-pale active:bg-pale" aria-haspopup="dialog">
        {!hidden && <span className="size-2 shrink-0 rounded-full" style={{ background: amount > 0 ? fill : LINE }} aria-hidden="true" />}
        <span className="min-w-0 flex-1 wrap-anywhere text-sm font-medium">
          {category}
          {!hidden && total > 0 && amount > 0 && (
            <span className="ml-1.5 text-xs font-normal text-ink-3">{Math.round((amount / total) * 100)}%</span>
          )}
        </span>
        <span className="min-w-0 wrap-anywhere text-right">
          <Money minor={amount} className="block text-sm font-semibold" />
          {amount !== before && (
            <span className="block text-xs text-ink-3">
              <span className="sr-only">Change </span><Money minor={amount - before} sign />
            </span>
          )}
        </span>
        <ChevronRight className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
      </button>
    </li>
  ));
  return (
    <>
      {!hidden && total > 0 && (
        <div className="relative mx-auto mb-3 h-44 w-full max-w-52" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart accessibilityLayer={false}>
              <Pie
                data={slices}
                dataKey="amount"
                nameKey="category"
                innerRadius="73%"
                outerRadius="98%"
                stroke="var(--color-surface)"
                strokeWidth={2}
                startAngle={90}
                endAngle={-270}
                cornerRadius={4}
                isAnimationActive={false}
                className="cursor-pointer"
                onClick={(_, index) => { const slice = slices[index]; if (slice) onSelect(slice.category); }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <Money minor={total} className="max-w-[55%] wrap-anywhere text-center text-base font-semibold" />
          </div>
        </div>
      )}
      <ul>{listItems(rows.slice(0, 6))}</ul>
      {rows.length > 6 && (
        <details className="mt-1">
          <summary className="min-h-10 cursor-pointer px-2 py-2 text-sm font-medium text-brand">More categories</summary>
          <ul>{listItems(rows.slice(6))}</ul>
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
