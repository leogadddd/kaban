"use client";

import { useMemo, useState } from "react";
import { Zap } from "lucide-react";
import { BankLogo } from "@/components/bank-logo";
import { DateField } from "@/components/date-field";
import { HapticButton } from "@/components/haptic-button";
import { Button, cx, Field, inputCls, Money, Segmented } from "@/components/ui";
import { bankFor } from "@/lib/banks";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/categories";
import { toISO } from "@/lib/dates";
import { minorToInput, parseMinor } from "@/lib/money";
import { approveEntry, rejectEntry, type QuickEntry } from "@/lib/quick-add";
import type { Account, Txn } from "@/lib/types";

function eligible(accounts: Account[], type: QuickEntry["type"]) {
  return type === "income" ? accounts.filter((a) => a.type !== "credit") : accounts;
}

function guessAccount(entry: QuickEntry, accounts: Account[], txns: Txn[]) {
  const options = eligible(accounts, entry.type);
  const wanted = entry.account?.toLowerCase();
  if (wanted) {
    const hit = options.find((a) => a.name.toLowerCase() === wanted) ?? options.find((a) => a.name.toLowerCase().includes(wanted) || wanted.includes(a.name.toLowerCase()));
    if (hit) return hit.id;
  }
  // Otherwise the account last used for this kind of entry.
  let latest: Txn | undefined;
  for (const t of txns) if (t.type === entry.type && t.state === "active" && options.some((a) => a.id === t.accountId) && (!latest || t.createdAt > latest.createdAt)) latest = t;
  return latest?.accountId ?? options[0]?.id ?? "";
}

/** Review one quick add: adjust it, then approve (saves it to the ledger) or reject. */
export function QuickEntryForm({ entry, accounts, txns, onDone }: { entry: QuickEntry; accounts: Account[]; txns: Txn[]; onDone: () => void }) {
  const [type, setType] = useState(entry.type);
  const [amount, setAmount] = useState(minorToInput(entry.amountMinor));
  const [description, setDescription] = useState(entry.description ?? "");
  const [accountId, setAccountId] = useState(() => guessAccount(entry, accounts, txns));
  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const [category, setCategory] = useState(() => categories.find((c) => c.name.toLowerCase() === entry.category?.toLowerCase())?.name ?? "");
  const [date, setDate] = useState(entry.date ?? toISO(new Date(entry.createdAt)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const options = useMemo(() => eligible(accounts, type), [accounts, type]);
  const amountMinor = parseMinor(amount);
  const sent = new Date(entry.createdAt);

  function changeType(next: QuickEntry["type"]) {
    setType(next);
    setCategory("");
    if (!eligible(accounts, next).some((a) => a.id === accountId)) setAccountId(eligible(accounts, next)[0]?.id ?? "");
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() =>
          approveEntry(entry, {
            accountId,
            type,
            amountMinor: amountMinor ?? 0,
            description: description.trim() || (category || (type === "income" ? "Income" : "Expense")),
            category: category || undefined,
            date,
          }),
        );
      }}
    >
      <div className="flex items-center gap-3 rounded-2xl bg-pale p-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-brand">
          <Zap className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <Money minor={entry.amountMinor} tone={entry.type === "income" ? "income" : "expense"} className="text-lg font-semibold" />
          <p className="truncate text-xs text-ink-3">
            From {entry.source ?? "a shortcut"} · {sent.toLocaleDateString()} {sent.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </p>
        </div>
      </div>

      <Segmented
        value={type}
        onChange={changeType}
        options={[
          { value: "expense", label: "Expense" },
          { value: "income", label: "Income" },
        ]}
      />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount">
          {(id) => <input id={id} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputCls} num`} />}
        </Field>
        <Field label="Date">{(id) => <DateField id={id} value={date} onChange={setDate} title="Date" compact />}</Field>
      </div>

      <Field label="Description">
        {(id) => <input id={id} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={80} placeholder={category || "What was it for?"} className={inputCls} />}
      </Field>

      {/* Same pickers as the Add screen: native selects render squashed on iOS. */}
      <div>
        <p className="mb-1.5 px-1 text-sm font-medium text-ink-2">Account</p>
        {options.length ? (
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label="Account">
            {options.map((a) => {
              const active = a.id === accountId;
              const bank = a.type === "cash" ? undefined : bankFor(a);
              return (
                <HapticButton
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setAccountId(a.id)}
                  wrapperClassName="shrink-0"
                  className={cx(
                    "flex min-h-12 items-center gap-2 rounded-2xl border px-3 text-sm font-medium whitespace-nowrap text-ink transition",
                    active ? "border-brand bg-brand/10" : "border-line bg-surface",
                  )}
                >
                  {bank ? <BankLogo bank={bank} size={22} /> : <span className="size-2.5 rounded-full" style={{ background: a.color }} />}
                  {a.name}
                </HapticButton>
              );
            })}
          </div>
        ) : (
          <p className="rounded-2xl bg-pale p-3 text-sm text-ink-2">Add an account first, then approve this entry.</p>
        )}
      </div>

      <div>
        <p className="mb-1.5 px-1 text-sm font-medium text-ink-2">Category <span className="font-normal text-ink-3">(optional)</span></p>
        <div className="grid grid-cols-4 gap-2">
          {categories.map(({ name, icon: Icon }) => (
            <HapticButton
              key={name}
              type="button"
              onClick={() => setCategory((c) => (c === name ? "" : name))}
              aria-pressed={category === name}
              className={cx(
                "flex min-h-[4.25rem] w-full flex-col items-center justify-center gap-1 rounded-2xl border p-1.5 text-[0.68rem] leading-tight font-medium transition",
                category === name ? "border-brand bg-brand/10 text-brand" : "border-line bg-surface text-ink-2",
              )}
            >
              <Icon className="size-5" />
              <span className="line-clamp-2 text-center">{name}</span>
            </HapticButton>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="px-1 text-sm text-expense">{error}</p>}

      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant="danger" disabled={busy} onClick={() => void run(() => rejectEntry(entry))}>Reject</Button>
        <Button type="submit" disabled={busy || !accountId || !amountMinor || amountMinor <= 0 || !date}>Approve</Button>
      </div>
    </form>
  );
}
