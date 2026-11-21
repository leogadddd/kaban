"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { formatAnalyticsRange, type AnalyticsBucket, type PacePoint } from "@/lib/analytics";
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

const AXIS_TICK = { fill: INK3, fontSize: 10 };
const CURSOR_FILL = { fill: "var(--color-ink-3)", fillOpacity: 0.08, stroke: "none" };

function LegendDot({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      {dashed
        ? <span className="h-0 w-3 border-t-2 border-dashed" style={{ borderColor: color }} />
        : <span className="size-2 rounded-full" style={{ background: color }} />}
      {label}
    </span>
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
  const hasIncome = data.some((bucket) => bucket.income > 0);
  const selectBar = (_: unknown, index: number) => {
    const bucket = data[index];
    if (bucket) onSelect(bucket);
  };

  return (
    <Card className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[0.95rem] font-semibold tracking-tight">Money in vs. out</h2>
          <p className="text-xs text-ink-3">Tap a bar to see its transactions</p>
        </div>
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
        <EmptyState title="No activity" body="Nothing was earned or spent in this period." />
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
            {hasIncome && <LegendDot color={SERIES_IN} label="Income" />}
            <LegendDot color={SERIES_OUT} label="Spent" />
          </div>
          <div className="h-44 sm:h-52" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} accessibilityLayer={false} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={2} barCategoryGap={data.length > 20 ? "18%" : "28%"}>
                <CartesianGrid vertical={false} stroke={LINE} strokeDasharray="3 4" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} minTickGap={18} />
                <YAxis width={42} tickCount={3} tickFormatter={(v) => fmt(v, { compact: true })} tickLine={false} axisLine={false} tick={AXIS_TICK} />
                <Tooltip
                  cursor={CURSOR_FILL}
                  content={({ active, payload }) =>
                    active && payload?.[0] ? (
                      <Tip>
                        <p className="mb-1 text-ink-3">{formatAnalyticsRange(payload[0].payload, today)}</p>
                        {hasIncome && <p className="num">Income <b className="amount">{fmt(payload[0].payload.income)}</b></p>}
                        <p className="num">Spent <b className="amount">{fmt(payload[0].payload.expense)}</b></p>
                      </Tip>
                    ) : null
                  }
                />
                {hasIncome && <Bar dataKey="income" fill={SERIES_IN} radius={[4, 4, 0, 0]} maxBarSize={18} onClick={selectBar} className="cursor-pointer" />}
                <Bar dataKey="expense" fill={SERIES_OUT} radius={[4, 4, 0, 0]} maxBarSize={18} onClick={selectBar} className="cursor-pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </figure>
      )}
    </Card>
  );
}

/** Running total of spending, this period against the same point of the comparison period. */
export function PaceChart({ data, previousLabel }: { data: PacePoint[]; previousLabel: string }) {
  const { fmt } = useMoney();
  const hasPrevious = data.some((point) => (point.previous ?? 0) > 0);
  return (
    <figure>
      <div className="mb-2 flex gap-3 text-xs text-ink-3">
        <LegendDot color="var(--color-brand)" label="This period" />
        {hasPrevious && <LegendDot color={INK3} label={previousLabel} dashed />}
      </div>
      <div className="h-44 sm:h-52" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} accessibilityLayer={false} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="paceFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--color-brand)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--color-brand)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={LINE} strokeDasharray="3 4" />
            <XAxis dataKey="date" tickFormatter={(date) => formatDay(date)} tickLine={false} axisLine={false} tick={AXIS_TICK} minTickGap={28} />
            <YAxis width={42} tickCount={3} tickFormatter={(v) => fmt(v, { compact: true })} tickLine={false} axisLine={false} tick={AXIS_TICK} />
            <Tooltip
              cursor={{ stroke: INK3, strokeWidth: 1, strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                const point = payload?.[0]?.payload as PacePoint | undefined;
                if (!active || !point) return null;
                return (
                  <Tip>
                    <p className="mb-1 text-ink-3">Day {point.index + 1} · {formatDay(point.date)}</p>
                    {point.current !== null && <p className="num">This period <b className="amount">{fmt(point.current)}</b></p>}
                    {hasPrevious && point.previous !== null && <p className="num">{previousLabel} <b className="amount">{fmt(point.previous)}</b></p>}
                  </Tip>
                );
              }}
            />
            {hasPrevious && <Line type="monotone" dataKey="previous" stroke={INK3} strokeWidth={2} strokeDasharray="4 4" dot={false} activeDot={false} isAnimationActive={false} connectNulls={false} />}
            <Area type="monotone" dataKey="current" stroke="var(--color-brand)" strokeWidth={2} fill="url(#paceFill)" dot={false} activeDot={{ r: 4, stroke: "var(--color-surface)", strokeWidth: 2 }} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

/** Average spend per weekday. The busiest day is drawn solid, the rest recede. */
export function WeekdayChart({ data }: { data: { day: string; average: number; total: number }[] }) {
  const { fmt } = useMoney();
  const peak = Math.max(...data.map(({ average }) => average));
  return (
    <div className="h-36" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} accessibilityLayer={false} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barCategoryGap="22%">
          <XAxis dataKey="day" tickLine={false} axisLine={false} tick={AXIS_TICK} interval={0} />
          <YAxis hide domain={[0, "dataMax"]} />
          <Tooltip
            cursor={CURSOR_FILL}
            content={({ active, payload }) =>
              active && payload?.[0] ? (
                <Tip>
                  <p className="mb-1 text-ink-3">{payload[0].payload.day}</p>
                  <p className="num">Average <b className="amount">{fmt(payload[0].payload.average)}</b></p>
                  <p className="num">Total <b className="amount">{fmt(payload[0].payload.total)}</b></p>
                </Tip>
              ) : null
            }
          />
          <Bar dataKey="average" radius={[4, 4, 0, 0]} maxBarSize={28}>
            {data.map(({ day, average }) => (
              <Cell key={day} fill="var(--color-brand)" fillOpacity={average === peak && peak > 0 ? 1 : 0.38} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export type BarListRow = {
  key: string;
  label: string;
  amount: number;
  /** Comparison-period amount; omit to hide the change line. */
  before?: number;
  detail?: string;
  icon?: LucideIcon;
};

/** Ranked horizontal bars: label, share of total, amount and change. Each row opens its transactions. */
export function BarList({ rows, total, onSelect, limit = 6, color = "var(--color-brand)" }: {
  rows: BarListRow[];
  total: number;
  onSelect?: (key: string) => void;
  limit?: number;
  color?: string;
}) {
  const { hidden } = useMoney();
  const max = Math.max(1, ...rows.map(({ amount }) => amount));
  const item = ({ key, label, amount, before, detail, icon: Icon }: BarListRow) => {
    const share = total > 0 ? Math.round((amount / total) * 100) : 0;
    const body = (
      <>
        {Icon && (
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-pale text-brand" aria-hidden="true">
            <Icon className="size-4" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate text-sm font-medium">{label}</span>
            <Money minor={amount} className="shrink-0 text-sm font-semibold" />
          </span>
          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-pale" aria-hidden="true">
            {!hidden && <span className="block h-full rounded-full" style={{ width: `${Math.max(2, (amount / max) * 100)}%`, background: amount > 0 ? color : LINE }} />}
          </span>
          <span className="mt-1 flex justify-between gap-2 text-xs text-ink-3">
            <span className="truncate">{[!hidden && amount > 0 && total > 0 ? `${share}%` : null, detail].filter(Boolean).join(" · ")}</span>
            {before !== undefined && <Change amount={amount} before={before} />}
          </span>
        </span>
      </>
    );
    return (
      <li key={key}>
        {onSelect ? (
          <button type="button" onClick={() => onSelect(key)} aria-haspopup="dialog" className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-pale active:bg-pale">
            {body}
          </button>
        ) : (
          <div className="flex items-center gap-3 px-2 py-2">{body}</div>
        )}
      </li>
    );
  };
  return (
    <>
      <ul className="-mx-2">{rows.slice(0, limit).map(item)}</ul>
      {rows.length > limit && (
        <details className="-mx-2 mt-1">
          <summary className="min-h-10 cursor-pointer px-2 py-2 text-sm font-medium text-brand">Show {rows.length - limit} more</summary>
          <ul>{rows.slice(limit).map(item)}</ul>
        </details>
      )}
    </>
  );
}

/** Spending change with an arrow and words, so direction never rides on color alone. Less spent = good. */
export function Change({ amount, before, goodWhen = "down", className }: { amount: number; before: number; goodWhen?: "up" | "down"; className?: string }) {
  const { hidden } = useMoney();
  const diff = amount - before;
  if (diff === 0) return <span className={cx("text-xs text-ink-3", className)}>No change</span>;
  if (before === 0) return <span className={cx("text-xs text-ink-3", className)}>New</span>;
  const percent = Math.round((Math.abs(diff) / Math.abs(before)) * 100);
  const up = diff > 0;
  const good = up === (goodWhen === "up");
  const Arrow = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cx("inline-flex items-center gap-0.5 text-xs font-medium", good ? "text-income" : "text-expense", className)}>
      <Arrow className="size-3.5" aria-hidden="true" />
      <span className="sr-only">{up ? "Up" : "Down"} </span>
      {hidden ? <Money minor={Math.abs(diff)} compact /> : `${percent > 999 ? ">999" : percent}%`}
    </span>
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
