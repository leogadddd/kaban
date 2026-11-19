"use client";

import { motion } from "motion/react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDay, formatMonth, formatMonthShort } from "@/lib/dates";
import type { MonthFlow } from "@/lib/finance";
import { useMoney } from "@/lib/privacy";
import { cx } from "./ui";

const INK3 = "#85948B";
const LINE = "#E1EBE4";
const SERIES_IN = "#1E8A5A";
const SERIES_OUT = "#C94B4B";

function Tip({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-line bg-white px-3 py-2 text-xs shadow-float">{children}</div>;
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
                <stop offset="0%" stopColor="#2D936C" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#2D936C" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" hide />
            <YAxis hide domain={[0, "dataMax"]} />
            <Tooltip
              cursor={{ stroke: "#176B4D", strokeWidth: 1, strokeDasharray: "3 3" }}
              content={({ active, payload }) =>
                active && payload?.[0] ? (
                  <Tip>
                    <p className="text-ink-3">{formatDay(payload[0].payload.day)}</p>
                    <p className="num amount font-semibold">{fmt(payload[0].payload.amount)}</p>
                  </Tip>
                ) : null
              }
            />
            <Area type="monotone" dataKey="amount" stroke="#176B4D" strokeWidth={2} fill="url(#spendFill)" activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        Daily spending over the last {data.length} days, total {fmt(total)}.
      </figcaption>
    </figure>
  );
}

/** Income vs expense by month: two series, legend + table fallback. */
export function FlowChart({ data, height = 200 }: { data: MonthFlow[]; height?: number }) {
  const { fmt } = useMoney();
  return (
    <figure>
      <div className="mb-2 flex gap-4 text-xs text-ink-2">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: SERIES_IN }} /> Income</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: SERIES_OUT }} /> Expenses</span>
      </div>
      <div style={{ height }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barGap={2} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke={LINE} />
            <XAxis dataKey="month" tickFormatter={formatMonthShort} tickLine={false} axisLine={false} tick={{ fill: INK3, fontSize: 11 }} />
            <YAxis width={44} tickFormatter={(v) => fmt(v, { compact: true })} tickLine={false} axisLine={false} tick={{ fill: INK3, fontSize: 10 }} />
            <Tooltip
              cursor={{ fill: "rgba(23,107,77,0.06)" }}
              content={({ active, payload }) =>
                active && payload?.[0] ? (
                  <Tip>
                    <p className="mb-1 text-ink-3">{formatMonth(payload[0].payload.month)}</p>
                    <p className="num">Income <b className="amount">{fmt(payload[0].payload.income)}</b></p>
                    <p className="num">Expenses <b className="amount">{fmt(payload[0].payload.expense)}</b></p>
                  </Tip>
                ) : null
              }
            />
            <Bar dataKey="income" fill={SERIES_IN} radius={[4, 4, 0, 0]} maxBarSize={18} />
            <Bar dataKey="expense" fill={SERIES_OUT} radius={[4, 4, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2 text-xs text-ink-2">
        <summary className="cursor-pointer py-1 text-ink-3">Show as table</summary>
        <table className="num mt-1 w-full">
          <thead className="text-ink-3">
            <tr><th className="py-1 text-left font-medium">Month</th><th className="text-right font-medium">Income</th><th className="text-right font-medium">Expenses</th></tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.month} className="border-t border-line">
                <td className="py-1">{formatMonth(d.month)}</td>
                <td className="amount text-right">{fmt(d.income)}</td>
                <td className="amount text-right">{fmt(d.expense)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** Ranked category spend as labelled horizontal bars (single hue = magnitude). */
export function CategoryBars({ data, max = 6 }: { data: { category: string; amount: number }[]; max?: number }) {
  const { fmt } = useMoney();
  const rows = data.slice(0, max);
  const rest = data.slice(max).reduce((s, d) => s + d.amount, 0);
  if (rest > 0) rows.push({ category: "Everything else", amount: rest });
  const top = Math.max(1, ...rows.map((r) => r.amount));
  const total = data.reduce((s, d) => s + d.amount, 0);
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.category}>
          <div className="mb-1 flex justify-between text-sm">
            <span className="font-medium">{r.category}</span>
            <span className="num text-ink-2">
              <span className="amount">{fmt(r.amount)}</span> <span className="text-ink-3">· {Math.round((r.amount / total) * 100)}%</span>
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-pale">
            <motion.div
              className="h-full rounded-full bg-brand-2"
              initial={{ width: 0 }}
              animate={{ width: `${(r.amount / top) * 100}%` }}
              transition={{ delay: i * 0.05, duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Credit utilisation ring with the number in text (not color-alone). */
export function UtilisationRing({ value, size = 120, label = "utilised" }: { value: number; size?: number; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const r = 44;
  const c = 2 * Math.PI * r;
  const color = v >= 80 ? "#C94B4B" : v >= 50 ? "#D99A1E" : "#2D936C";
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${v.toFixed(0)}% of credit limit ${label}`}>
      <svg viewBox="0 0 100 100" className="-rotate-90" width={size} height={size}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="#E8F4EC" strokeWidth="9" />
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
