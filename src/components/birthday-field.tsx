"use client";

import { useId, useSyncExternalStore } from "react";
import { daysInMonth } from "@/lib/dates";
import { cx } from "./ui";

const noop = () => () => {};
const currentYear = () => new Date().getFullYear();
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const selectCls =
  "min-h-12 w-full appearance-none rounded-2xl border border-line bg-field px-3 text-[16px] text-ink outline-none invalid:text-ink-3";

/**
 * Birthday as three dropdowns (month, day, year): quicker than a calendar for a date decades back.
 * `value` is "YYYY-MM-DD" once all three are picked; partial picks are kept in `parts`.
 */
export function BirthdayField({
  parts,
  onChange,
  label = "Birthday",
  hint,
}: {
  parts: { y: string; m: string; d: string };
  onChange: (parts: { y: string; m: string; d: string }) => void;
  label?: string;
  hint?: string;
}) {
  const id = useId();
  // Read the clock after mount: the page is prerendered, and the year list must reflect the visit.
  const thisYear = useSyncExternalStore(noop, currentYear, () => 0);
  const days = parts.y && parts.m ? daysInMonth(Number(parts.y), Number(parts.m) - 1) : 31;
  const set = (patch: Partial<typeof parts>) => {
    const next = { ...parts, ...patch };
    // Keep the day valid when the month or year changes (31 Jan → Feb).
    if (next.d && next.y && next.m && Number(next.d) > daysInMonth(Number(next.y), Number(next.m) - 1)) next.d = "";
    onChange(next);
  };
  return (
    <fieldset className="space-y-1.5">
      <legend id={id} className="mb-1.5 block px-1 text-sm font-medium text-ink-2">{label}</legend>
      <div className="grid grid-cols-[1.4fr_0.8fr_1fr] gap-2">
        <select aria-labelledby={id} aria-label="Month" required value={parts.m} onChange={(e) => set({ m: e.target.value })} className={selectCls}>
          <option value="" disabled>Month</option>
          {MONTHS.map((name, i) => (
            <option key={name} value={String(i + 1).padStart(2, "0")}>{name}</option>
          ))}
        </select>
        <select aria-label="Day" required value={parts.d} onChange={(e) => set({ d: e.target.value })} className={selectCls}>
          <option value="" disabled>Day</option>
          {Array.from({ length: days }, (_, i) => (
            <option key={i} value={String(i + 1).padStart(2, "0")}>{i + 1}</option>
          ))}
        </select>
        <select aria-label="Year" required value={parts.y} onChange={(e) => set({ y: e.target.value })} className={cx(selectCls, "num")}>
          <option value="" disabled>Year</option>
          {Array.from({ length: thisYear ? 110 : 0 }, (_, i) => String(thisYear - i)).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
      {hint && <p className="px-1 text-xs text-ink-3">{hint}</p>}
    </fieldset>
  );
}

export const birthdayISO = (p: { y: string; m: string; d: string }) => (p.y && p.m && p.d ? `${p.y}-${p.m}-${p.d}` : "");
