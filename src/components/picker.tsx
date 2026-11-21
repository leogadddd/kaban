"use client";

import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { HapticButton } from "./haptic-button";
import { cx, Sheet } from "./ui";

/** One row in a picker sheet (Analytics date range, category pickers, filters). */
export function PickerOption({ label, selected, onClick, icon: Icon }: { label: ReactNode; selected: boolean; onClick: () => void; icon?: LucideIcon }) {
  return (
    <HapticButton
      wrapperClassName="w-full"
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx("flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium hover:bg-pale", selected && "bg-pale text-brand")}
    >
      {Icon && (
        <span className={cx("grid size-8 shrink-0 place-items-center rounded-xl", selected ? "bg-brand/15 text-brand" : "bg-pale text-ink-2")} aria-hidden="true">
          <Icon className="size-4" />
        </span>
      )}
      <span className="min-w-0 flex-1 wrap-anywhere">{label}</span>
      {selected && <Check className="size-4 shrink-0" aria-hidden="true" />}
    </HapticButton>
  );
}

export type SelectOption<T extends string = string> = { value: T; label: string; icon?: LucideIcon };

/**
 * Form dropdown in place of a native <select>: a field-styled trigger that opens the same picker sheet
 * as Analytics. Sheets nest, so this works inside another sheet (e.g. "New budget").
 */
export function Select<T extends string = string>({
  value,
  onChange,
  options,
  title,
  placeholder = "Select",
  id,
  disabled,
  numeric,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: {
  value: T | "";
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  /** Sheet heading; defaults to the aria-label or placeholder. */
  title?: string;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  /** Tabular figures for number lists (days, years). */
  numeric?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const Icon = selected?.icon;
  return (
    <>
      <HapticButton
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        onClick={() => setOpen(true)}
        className={cx(
          "flex min-h-12 w-full items-center gap-2.5 rounded-2xl border border-line bg-field pr-3 pl-4 text-left text-[16px] outline-none disabled:opacity-70",
          className,
        )}
      >
        {Icon && <Icon className="size-4 shrink-0 text-brand" aria-hidden="true" />}
        <span className={cx("min-w-0 flex-1 truncate", selected ? "text-ink" : "text-ink-3", numeric && "num")}>{selected?.label ?? placeholder}</span>
        {!disabled && <ChevronDown className="size-4 shrink-0 text-ink-3" aria-hidden="true" />}
      </HapticButton>
      <Sheet open={open} onClose={() => setOpen(false)} title={title ?? ariaLabel ?? placeholder}>
        <div className="space-y-1">
          {options.map((o) => (
            <PickerOption
              key={o.value}
              label={numeric ? <span className="num">{o.label}</span> : o.label}
              icon={o.icon}
              selected={o.value === value}
              onClick={() => {
                if (o.value !== value) onChange(o.value);
                setOpen(false);
              }}
            />
          ))}
        </div>
      </Sheet>
    </>
  );
}
