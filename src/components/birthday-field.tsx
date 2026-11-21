"use client";

import { useId, useSyncExternalStore } from "react";
import { daysInMonth } from "@/lib/dates";
import { Select } from "./picker";

const noop = () => () => {};
const currentYear = () => new Date().getFullYear();
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

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
        <Select
          aria-label="Month"
          placeholder="Month"
          value={parts.m}
          onChange={(m) => set({ m })}
          options={MONTHS.map((name, i) => ({ value: String(i + 1).padStart(2, "0"), label: name }))}
        />
        <Select
          aria-label="Day"
          placeholder="Day"
          numeric
          value={parts.d}
          onChange={(d) => set({ d })}
          options={Array.from({ length: days }, (_, i) => ({ value: String(i + 1).padStart(2, "0"), label: String(i + 1) }))}
        />
        <Select
          aria-label="Year"
          placeholder="Year"
          numeric
          value={parts.y}
          onChange={(y) => set({ y })}
          options={Array.from({ length: thisYear ? 110 : 0 }, (_, i) => String(thisYear - i)).map((y) => ({ value: y, label: y }))}
        />
      </div>
      {hint && <p className="px-1 text-xs text-ink-3">{hint}</p>}
    </fieldset>
  );
}

export const birthdayISO = (p: { y: string; m: string; d: string }) => (p.y && p.m && p.d ? `${p.y}-${p.m}-${p.d}` : "");
