"use client";

import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useState } from "react";
import { addDays, daysInMonth, fromISO, toISO, todayISO } from "@/lib/dates";
import { Chip, cx, Sheet } from "./ui";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const monthTitle = new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric" });
const longDay = new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
const shortDay = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" });

function relative(iso: string): string | null {
  const t = todayISO();
  if (iso === t) return "Today";
  if (iso === toISO(addDays(new Date(), -1))) return "Yesterday";
  if (iso === toISO(addDays(new Date(), 1))) return "Tomorrow";
  return null;
}

/**
 * App date picker. Replaces <input type="date">, whose iOS rendering ignores width and spills out of
 * narrow layouts. Shows a full-width field; tapping opens a calendar sheet. Value is "YYYY-MM-DD" or "".
 */
export function DateField({
  id,
  value,
  onChange,
  placeholder = "Pick a date",
  allowClear = false,
  min,
  max,
  title = "Pick a date",
  compact = false,
  className,
}: {
  id?: string;
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  allowClear?: boolean;
  min?: string;
  max?: string;
  title?: string;
  /** Shorter label for side-by-side fields (no weekday, no "Today ·" prefix). */
  compact?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rel = value && !compact ? relative(value) : null;
  const label = value ? (compact ? shortDay : longDay).format(fromISO(value)) : placeholder;

  return (
    <>
      <button
        id={id}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={cx(
          cx("flex min-h-12 w-full min-w-0 items-center gap-2.5 rounded-2xl border border-line bg-field text-left text-[16px]", compact ? "px-3" : "px-4"),
          className,
        )}
      >
        <CalendarDays className="size-[1.1rem] shrink-0 text-brand" />
        <span className={cx("min-w-0 flex-1 truncate", !value && "text-ink-3")}>
          {rel && <span className="font-medium text-ink">{rel} · </span>}
          <span className={rel ? "text-ink-2" : ""}>{label}</span>
        </span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        <Calendar
          value={value}
          min={min}
          max={max}
          allowClear={allowClear}
          onPick={(iso) => {
            onChange(iso);
            setOpen(false);
          }}
        />
      </Sheet>
    </>
  );
}

function Calendar({
  value,
  onPick,
  min,
  max,
  allowClear,
}: {
  value: string;
  onPick: (iso: string) => void;
  min?: string;
  max?: string;
  allowClear: boolean;
}) {
  const start = fromISO(value || todayISO());
  const [view, setView] = useState({ y: start.getFullYear(), m: start.getMonth() });
  const [dir, setDir] = useState(0);
  const today = todayISO();

  const shift = (d: number) => {
    setDir(d);
    setView((v) => {
      const n = new Date(v.y, v.m + d, 1);
      return { y: n.getFullYear(), m: n.getMonth() };
    });
  };

  const first = new Date(view.y, view.m, 1).getDay();
  const count = daysInMonth(view.y, view.m);
  const cells: (string | null)[] = [
    ...Array.from({ length: first }, () => null),
    ...Array.from({ length: count }, (_, i) => toISO(new Date(view.y, view.m, i + 1))),
  ];
  while (cells.length % 7) cells.push(null);
  const disabled = (iso: string) => (min && iso < min) || (max && iso > max);

  const quick = [
    { label: "Today", iso: today },
    { label: "Yesterday", iso: toISO(addDays(new Date(), -1)) },
    { label: "2 days ago", iso: toISO(addDays(new Date(), -2)) },
  ].filter((q) => !disabled(q.iso));

  return (
    <div className="pb-1">
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        {quick.map((q) => (
          <Chip key={q.label} active={value === q.iso} onClick={() => onPick(q.iso)}>
            {q.label}
          </Chip>
        ))}
        {allowClear && value && (
          <Chip onClick={() => onPick("")}>
            <X className="size-3.5" /> Clear
          </Chip>
        )}
      </div>

      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} className="grid size-11 place-items-center rounded-full active:bg-pale" aria-label="Previous month">
          <ChevronLeft className="size-5" />
        </button>
        <p className="font-semibold" aria-live="polite">
          {monthTitle.format(new Date(view.y, view.m, 1))}
        </p>
        <button type="button" onClick={() => shift(1)} className="grid size-11 place-items-center rounded-full active:bg-pale" aria-label="Next month">
          <ChevronRight className="size-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-xs font-medium text-ink-3" aria-hidden="true">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="py-1.5">
            {d}
          </span>
        ))}
      </div>

      <div className="relative overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={`${view.y}-${view.m}`}
            custom={dir}
            variants={{
              enter: (d: number) => ({ x: d * 40, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (d: number) => ({ x: d * -40, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="grid grid-cols-7 gap-y-1"
            role="grid"
          >
            {cells.map((iso, i) =>
              iso ? (
                <button
                  key={iso}
                  type="button"
                  disabled={!!disabled(iso)}
                  onClick={() => onPick(iso)}
                  aria-pressed={iso === value}
                  aria-label={longDay.format(fromISO(iso))}
                  className={cx(
                    "num mx-auto grid aspect-square w-full max-w-11 place-items-center rounded-full text-[0.95rem] transition disabled:opacity-25",
                    iso === value ? "bg-brand font-semibold text-on-brand" : iso === today ? "font-semibold text-brand ring-1 ring-brand/40" : "text-ink active:bg-pale",
                  )}
                >
                  {Number(iso.slice(8))}
                </button>
              ) : (
                <span key={`e${i}`} />
              ),
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
