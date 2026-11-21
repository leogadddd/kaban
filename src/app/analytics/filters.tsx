"use client";

import { CalendarDays, Check, ChevronDown, CreditCard, Landmark, Wallet, WalletCards, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { BankLogo } from "@/components/bank-logo";
import { DateField } from "@/components/date-field";
import { HapticButton } from "@/components/haptic-button";
import { Button, cx, Money, Progress, Sheet } from "@/components/ui";
import type { AnalyticsPeriod, DateRange } from "@/lib/analytics";
import { bankFor } from "@/lib/banks";
import { useShowArchived } from "@/lib/display-prefs";
import type { AccountBalance } from "@/lib/finance";
import type { Account, AccountType } from "@/lib/types";

const PERIODS: { value: AnalyticsPeriod; label: string }[] = [
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "3-months", label: "Last 3 months" },
  { value: "6-months", label: "Last 6 months" },
  { value: "12-months", label: "Last 12 months" },
  { value: "custom", label: "Custom dates" },
];

function PickerTrigger({ label, value, icon: Icon, lead, open, onClick }: {
  label: string;
  value: string;
  icon: LucideIcon;
  lead?: React.ReactNode;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <HapticButton
      wrapperClassName="min-w-0 shrink-0 max-w-[60%]"
      type="button"
      aria-label={`${label}: ${value}`}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={onClick}
      className="flex min-h-10 w-full items-center gap-1.5 rounded-full border border-line bg-surface py-1.5 pr-2.5 pl-3 text-left hover:bg-pale"
    >
      {lead ?? <Icon className="size-4 shrink-0 text-brand" aria-hidden="true" />}
      <span className="min-w-0 truncate text-sm font-medium">{value}</span>
      <ChevronDown className="size-3.5 shrink-0 text-ink-3" aria-hidden="true" />
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

const GROUPS: { type: AccountType; label: string; icon: LucideIcon }[] = [
  { type: "cash", label: "Cash", icon: Wallet },
  { type: "debit", label: "Debit & bank", icon: Landmark },
  { type: "credit", label: "Credit & pay later", icon: CreditCard },
];
const TYPE_ICON = Object.fromEntries(GROUPS.map(({ type, icon }) => [type, icon])) as Record<AccountType, LucideIcon>;

/** Bank logo when we know the bank, otherwise the account-type icon on the account's colour. */
export function AccountMark({ account, size = 36 }: { account: Account; size?: number }) {
  const bank = account.type === "cash" ? undefined : bankFor(account);
  if (bank) return <BankLogo bank={bank} size={size} />;
  const Icon = TYPE_ICON[account.type];
  return (
    <span
      className="grid shrink-0 place-items-center rounded-xl text-ink"
      style={{ width: size, height: size, background: `color-mix(in srgb, ${account.color} 28%, var(--color-surface))` }}
      aria-hidden="true"
    >
      <Icon className="size-[55%]" />
    </span>
  );
}

function AccountOption({ account, balance, selected, onClick }: { account: Account; balance?: AccountBalance; selected: boolean; onClick: () => void }) {
  const credit = account.type === "credit";
  const limit = account.creditLimitMinor ?? 0;
  const detail = [account.issuer, account.last4 && `•••• ${account.last4}`].filter(Boolean).join(" · ");
  return (
    <HapticButton
      wrapperClassName="w-full"
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx("flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-pale", selected && "bg-pale", account.archived && !selected && "opacity-70")}
    >
      <AccountMark account={account} />
      <span className="min-w-0 flex-1">
        <span className={cx("block truncate text-sm font-medium", selected && "text-brand")}>{account.name}</span>
        {credit && limit > 0 && balance ? (
          <span className="mt-1 flex items-center gap-2 text-xs text-ink-3">
            <Progress value={balance.utilisation ?? 0} className="h-1.5 flex-1" />
            <span className="num">{(balance.utilisation ?? 0).toFixed(0)}% used</span>
          </span>
        ) : (
          <span className="block truncate text-xs text-ink-3">{detail || GROUPS.find(({ type }) => type === account.type)?.label}</span>
        )}
      </span>
      {balance && (
        <span className="shrink-0 text-right">
          <Money minor={credit && limit > 0 ? balance.available ?? 0 : balance.balance} className="block text-sm font-semibold" />
          <span className="block text-[0.68rem] text-ink-3">{credit ? (limit > 0 ? "available" : "owed") : "remaining"}</span>
        </span>
      )}
      {selected && <Check className="size-4 shrink-0 text-brand" aria-hidden="true" />}
    </HapticButton>
  );
}

export function AnalyticsFilters({ period, custom, today, accounts, balances, availableFunds, accountId, onPeriod, onAccount }: {
  period: AnalyticsPeriod;
  custom: DateRange;
  today: string;
  accounts: Account[];
  balances: Map<string, AccountBalance>;
  availableFunds: number;
  accountId: string;
  onPeriod: (period: AnalyticsPeriod, custom?: DateRange) => void;
  onAccount: (id: string) => void;
}) {
  const [picker, setPicker] = useState<"date" | "account" | null>(null);
  const close = () => setPicker(null);
  const active = accounts.filter((account) => !account.archived);
  const [showArchived] = useShowArchived();
  // Keep a selected archived account listed so the current filter is always visible in the picker.
  const archived = accounts.filter((account) => account.archived && (showArchived || account.id === accountId));
  const account = accounts.find(({ id }) => id === accountId);
  const accountLabel = account ? `${account.name}${account.archived ? " · Archived" : ""}` : "All accounts";
  const pickAccount = (id: string) => {
    onAccount(id);
    close();
  };

  return (
    <>
      <div className="flex gap-2">
        <PickerTrigger label="Date range" value={PERIODS.find(({ value }) => value === period)!.label} icon={CalendarDays} open={picker === "date"} onClick={() => setPicker("date")} />
        <PickerTrigger label="Account" value={accountLabel} icon={WalletCards} lead={account && <AccountMark account={account} size={20} />} open={picker === "account"} onClick={() => setPicker("account")} />
      </div>
      <Sheet open={picker === "date"} onClose={close} title="Date range">
        <DateOptions period={period} custom={custom} today={today} onSelect={(next, range) => { onPeriod(next, range); close(); }} />
      </Sheet>
      <Sheet open={picker === "account"} onClose={close} title="Accounts">
        <div className="space-y-4">
          <HapticButton
            wrapperClassName="w-full"
            type="button"
            aria-pressed={!accountId}
            onClick={() => pickAccount("")}
            className={cx("flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-pale", !accountId && "bg-pale")}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand" aria-hidden="true">
              <WalletCards className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className={cx("block text-sm font-medium", !accountId && "text-brand")}>All accounts</span>
              <span className="block text-xs text-ink-3">{active.length} active {active.length === 1 ? "account" : "accounts"}</span>
            </span>
            <span className="shrink-0 text-right">
              <Money minor={availableFunds} className="block text-sm font-semibold" />
              <span className="block text-[0.68rem] text-ink-3">available funds</span>
            </span>
            {!accountId && <Check className="size-4 shrink-0 text-brand" aria-hidden="true" />}
          </HapticButton>
          {[
            ...GROUPS.map(({ type, label, icon }) => ({ key: type, label, icon, items: active.filter((item) => item.type === type) })),
            { key: "archived", label: "Archived", icon: undefined, items: archived },
          ].map(({ key, label, icon: Icon, items }) => items.length > 0 && (
            <section key={key} aria-label={label}>
              <h3 className="mb-1 flex items-center gap-1.5 px-3 text-xs font-semibold text-ink-3">
                {Icon && <Icon className="size-3.5" aria-hidden="true" />}
                {label}
              </h3>
              <div className="space-y-0.5">
                {items.map((item) => (
                  <AccountOption key={item.id} account={item} balance={balances.get(item.id)} selected={accountId === item.id} onClick={() => pickAccount(item.id)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </Sheet>
    </>
  );
}
