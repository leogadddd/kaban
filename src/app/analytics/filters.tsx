"use client";

import { CalendarDays, Check, ChevronDown, WalletCards, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { DateField } from "@/components/date-field";
import { HapticButton } from "@/components/haptic-button";
import { Button, cx, Sheet } from "@/components/ui";
import type { AnalyticsPeriod, DateRange } from "@/lib/analytics";
import type { Account } from "@/lib/types";

const PERIODS: { value: AnalyticsPeriod; label: string }[] = [
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "3-months", label: "Last 3 full months" },
  { value: "6-months", label: "Last 6 full months" },
  { value: "12-months", label: "Last 12 full months" },
  { value: "custom", label: "Custom dates" },
];

function PickerTrigger({ label, value, icon: Icon, open, onClick }: {
  label: string;
  value: string;
  icon: LucideIcon;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <HapticButton
      wrapperClassName="w-full"
      type="button"
      aria-label={`${label}: ${value}`}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={onClick}
      className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-left hover:bg-pale"
    >
      <Icon className="size-[1.15rem] shrink-0 text-brand" aria-hidden="true" />
      <span className="min-w-0 flex-1 wrap-anywhere text-sm font-medium">{value}</span>
      <ChevronDown className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
    </HapticButton>
  );
}

function PickerOption({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <HapticButton
      wrapperClassName="w-full"
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx("flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium hover:bg-pale", selected && "bg-pale text-brand")}
    >
      <span className="min-w-0 wrap-anywhere">{label}</span>
      {selected && <Check className="size-4 shrink-0" aria-hidden="true" />}
    </HapticButton>
  );
}

function DateOptions({ period, custom, today, onSelect }: {
  period: AnalyticsPeriod;
  custom: DateRange;
  today: string;
  onSelect: (period: AnalyticsPeriod, custom?: DateRange) => void;
}) {
  const [editing, setEditing] = useState(period === "custom");
  const [draft, setDraft] = useState(custom);

  return (
    <div className="space-y-1">
      {PERIODS.map(({ value, label }) => (
        <PickerOption key={value} label={label} selected={editing ? value === "custom" : period === value} onClick={() => {
          if (value === "custom") setEditing((isEditing) => !isEditing);
          else onSelect(value);
        }} />
      ))}
      {editing && (
        <div className="space-y-3 px-1 pt-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <label htmlFor="analytics-from" className="mb-1 block px-1 text-xs text-ink-3">From</label>
              <DateField id="analytics-from" title="From date" compact value={draft.from} max={draft.to} onChange={(from) => setDraft((range) => ({ ...range, from }))} />
            </div>
            <div className="min-w-0">
              <label htmlFor="analytics-to" className="mb-1 block px-1 text-xs text-ink-3">To</label>
              <DateField id="analytics-to" title="To date" compact value={draft.to} min={draft.from} max={today} onChange={(to) => setDraft((range) => ({ ...range, to }))} />
            </div>
          </div>
          <Button wrapperClassName="w-full" onClick={() => onSelect("custom", draft)}>Apply dates</Button>
        </div>
      )}
    </div>
  );
}

export function AnalyticsFilters({ period, custom, today, accounts, accountId, onPeriod, onAccount }: {
  period: AnalyticsPeriod;
  custom: DateRange;
  today: string;
  accounts: Account[];
  accountId: string;
  onPeriod: (period: AnalyticsPeriod, custom?: DateRange) => void;
  onAccount: (id: string) => void;
}) {
  const [picker, setPicker] = useState<"date" | "account" | null>(null);
  const close = () => setPicker(null);
  const active = accounts.filter((account) => !account.archived);
  const archived = accounts.filter((account) => account.archived);
  const account = accounts.find(({ id }) => id === accountId);
  const accountLabel = account ? `${account.name}${account.archived ? " · Archived" : ""}` : "All accounts";
  const pickAccount = (id: string) => {
    onAccount(id);
    close();
  };

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2 lg:max-w-2xl">
        <PickerTrigger label="Date range" value={PERIODS.find(({ value }) => value === period)!.label} icon={CalendarDays} open={picker === "date"} onClick={() => setPicker("date")} />
        <PickerTrigger label="Account" value={accountLabel} icon={WalletCards} open={picker === "account"} onClick={() => setPicker("account")} />
      </div>
      <Sheet open={picker === "date"} onClose={close} title="Date range">
        <DateOptions period={period} custom={custom} today={today} onSelect={(next, range) => { onPeriod(next, range); close(); }} />
      </Sheet>
      <Sheet open={picker === "account"} onClose={close} title="Accounts">
        <div className="space-y-3">
          <PickerOption label="All accounts" selected={!accountId} onClick={() => pickAccount("")} />
          {[
            { label: "Active", items: active },
            { label: "Archived", items: archived },
          ].map(({ label, items }) => items.length > 0 && (
            <section key={label} aria-label={label}>
              <h3 className="mb-1 px-3 text-xs font-semibold text-ink-3">{label}</h3>
              {items.map(({ id, name }) => (
                <PickerOption key={id} label={name} selected={accountId === id} onClick={() => pickAccount(id)} />
              ))}
            </section>
          ))}
        </div>
      </Sheet>
    </>
  );
}
