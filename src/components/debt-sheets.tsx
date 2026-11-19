"use client";

import { HapticButton } from "@/components/haptic-button";
import { useMoney } from "@/lib/privacy";
import { useState } from "react";
import { todayISO } from "@/lib/dates";
import type { Ledger } from "@/lib/hooks";
import { formatMoney, minorToInput, parseMinor } from "@/lib/money";
import { allocatePayment, recordPersonPayment, saveDebt, savePerson } from "@/lib/repo";
import { DateField } from "./date-field";
import { Avatar, Button, Chip, cx, Field, inputCls, Sheet } from "./ui";
import { BankLogo } from "./bank-logo";
import { bankFor } from "@/lib/banks";

// The forms mount only while the sheet is open, so each opening starts with fresh state.

export function DebtSheet({ open, onClose, ledger, personId }: { open: boolean; onClose: () => void; ledger: Ledger; personId?: string }) {
  return (
    <Sheet open={open} onClose={onClose} title="Record a debt">
      <DebtForm onClose={onClose} ledger={ledger} personId={personId} />
    </Sheet>
  );
}

function DebtForm({ onClose, ledger, personId }: { onClose: () => void; ledger: Ledger; personId?: string }) {
  const [person, setPerson] = useState(personId ?? "");
  const [newName, setNewName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState<string>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    try {
      const amountMinor = parseMinor(amount) ?? 0;
      if (!(amountMinor > 0)) throw new Error("Enter an amount greater than zero");
      let pid = person;
      if (!pid && newName.trim()) pid = await savePerson({ name: newName });
      await saveDebt({ personId: pid, amountMinor, description: description.trim() || "Loan", date });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {!personId && (
        <div>
          <p className="mb-1.5 px-1 text-sm font-medium text-ink-2">Who owes you?</p>
          <div className="flex flex-wrap gap-2">
            {ledger.people.filter((p) => !p.archived).map((p) => (
              <Chip key={p.id} active={person === p.id} onClick={() => setPerson(person === p.id ? "" : p.id)}>{p.name}</Chip>
            ))}
          </div>
          {!person && <input className={cx(inputCls, "mt-2")} placeholder="…or type a new name" value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="New person name" />}
        </div>
      )}
      <Field label="Amount">{(id) => <input id={id} className={cx(inputCls, "num")} inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />}</Field>
      <Field label="What for">{(id) => <input id={id} className={inputCls} placeholder="Borrowed for tuition" value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
      <Field label="Date">{(id) => <DateField id={id} value={date} onChange={setDate} title="Date of the debt" />}</Field>
      {error && <p className="text-sm text-expense" role="alert">{error}</p>}
      <Button type="submit" wrapperClassName="w-full">Record debt</Button>
    </form>
  );
}

/** Who is paying, and optionally which single debt. Without debtId the payment covers their oldest debts first. */
export type RepayTarget = { personId: string; debtId?: string } | null;

export function RepaySheet({ target, onClose, ledger }: { target: RepayTarget; onClose: () => void; ledger: Ledger }) {
  return (
    <Sheet open={!!target} onClose={onClose} title="Record payment">
      {target && <RepayForm target={target} onClose={onClose} ledger={ledger} />}
    </Sheet>
  );
}

function RepayForm({ target, onClose, ledger }: { target: NonNullable<RepayTarget>; onClose: () => void; ledger: Ledger }) {
  const { fmt } = useMoney();
  const person = ledger.personById.get(target.personId);
  const funds = ledger.activeAccounts.filter((a) => a.type !== "credit");

  // Open debts this payment can go toward, oldest first.
  const open = ledger.debtStatus
    .filter((d) => d.debt.personId === target.personId && !d.settled && (!target.debtId || d.debt.id === target.debtId))
    .sort((a, b) => a.debt.date.localeCompare(b.debt.date) || a.debt.createdAt - b.debt.createdAt);
  const owedHere = open.reduce((s, d) => s + d.outstanding, 0);
  const owedTotal = ledger.debtStatus.filter((d) => d.debt.personId === target.personId).reduce((s, d) => s + Math.max(0, d.outstanding), 0);

  const [amount, setAmount] = useState(minorToInput(owedHere));
  const [accountId, setAccountId] = useState(funds[0]?.id ?? "");
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const m = parseMinor(amount) ?? 0;
  const { parts, unallocated } = allocatePayment(m, open.map((d) => ({ debtId: d.debt.id, outstanding: d.outstanding })));
  const account = ledger.accountById.get(accountId);
  const accountBefore = account ? ledger.balances.get(account.id)?.balance ?? 0 : 0;
  const over = unallocated > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    if (!(m > 0)) return setError("Enter an amount");
    if (over) return setError(`That's more than the ${formatMoney(owedHere)} ${person?.name ?? "they"} owe${target.debtId ? " on this" : ""}`);
    if (!accountId) return setError("Choose where the money went");
    setSaving(true);
    try {
      await recordPersonPayment({ personId: target.personId, amountMinor: m, accountId, date, debtIds: open.map((d) => d.debt.id) });
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  if (!person) return null;
  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Who is paying and what they owe */}
      <div className="flex items-center gap-3 rounded-2xl bg-surface p-3 ring-1 ring-line">
        <Avatar name={person.name} color={person.color} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{person.name}</p>
          <p className="text-sm text-ink-3">
            {target.debtId && open[0] ? <>For {open[0].debt.description} · </> : null}
            owes you <span className="num amount font-semibold text-ink">{fmt(target.debtId ? owedHere : owedTotal)}</span>
          </p>
        </div>
      </div>

      <Field label="Amount they paid">
        {(id) => (
          <div className="relative">
            <span className="absolute top-1/2 left-4 -translate-y-1/2 text-ink-3">₱</span>
            <input id={id} className={cx(inputCls, "num pl-8 text-lg font-semibold")} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        )}
      </Field>
      <div className="flex gap-2">
        <Chip onClick={() => setAmount(minorToInput(owedHere))} active={m === owedHere}>Everything</Chip>
        <Chip onClick={() => setAmount(minorToInput(Math.round(owedHere / 2)))} active={m === Math.round(owedHere / 2) && m !== owedHere}>Half</Chip>
      </div>

      {/* Where the money goes */}
      <div>
        <p className="mb-1.5 px-1 text-sm font-medium text-ink-2">Goes to</p>
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label="Receiving account">
          {funds.map((a) => {
            const active = a.id === accountId;
            const bank = a.type === "cash" ? undefined : bankFor(a);
            return (
              <HapticButton
                key={a.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setAccountId(a.id)}
                wrapperClassName="min-w-36 shrink-0"
                className={cx("rounded-2xl border p-3 text-left transition", active ? "border-brand bg-pale ring-2 ring-brand/25" : "border-line bg-surface")}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  {bank ? <BankLogo bank={bank} size={20} /> : <span className="size-2.5 rounded-full" style={{ background: a.color }} />}
                  <span className="truncate">{a.name}</span>
                </span>
                <span className="num amount mt-0.5 block text-xs text-ink-3">{fmt(ledger.balances.get(a.id)?.balance ?? 0)}</span>
              </HapticButton>
            );
          })}
        </div>
        {!funds.length && <p className="text-sm text-expense">Add a cash or debit account first.</p>}
      </div>

      {/* What changes */}
      {m > 0 && !over && account && (
        <div className="space-y-2 rounded-2xl bg-pale p-3 text-sm">
          <p className="text-xs font-semibold tracking-wide text-brand uppercase">After this</p>
          <div className="flex items-center justify-between gap-2">
            <span className="text-ink-2">{person.name} owes</span>
            <span className="num">
              <span className="amount text-ink-3 line-through">{fmt(target.debtId ? owedHere : owedTotal)}</span>
              {" → "}
              <span className="amount font-semibold">{fmt((target.debtId ? owedHere : owedTotal) - m)}</span>
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-ink-2">{account.name}</span>
            <span className="num">
              <span className="amount text-ink-3">{fmt(accountBefore)}</span>
              {" → "}
              <span className="amount font-semibold text-income">{fmt(accountBefore + m)}</span>
            </span>
          </div>
          {!target.debtId && parts.length > 0 && (
            <ul className="space-y-1 border-t border-brand/15 pt-2 text-xs">
              {parts.map((p) => {
                const d = open.find((o) => o.debt.id === p.debtId)!;
                return (
                  <li key={p.debtId} className="flex items-center justify-between gap-2">
                    <span className="truncate text-ink-2">
                      {d.debt.description}
                      {p.settles && <span className="ml-1.5 rounded-full bg-income/15 px-1.5 py-0.5 text-[0.65rem] font-medium text-income">settled</span>}
                    </span>
                    <span className="num amount">{fmt(p.amountMinor)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <Field label="Date received">{(id) => <DateField id={id} value={date} onChange={setDate} title="Date received" />}</Field>
      {over && <p className="text-sm text-expense">More than they owe</p>}
      {error && <p className="text-sm text-expense" role="alert">{error}</p>}
      <Button type="submit" wrapperClassName="w-full" disabled={saving || over || !(m > 0)}>
        Record repayment
      </Button>
      <p className="text-center text-xs text-ink-3">Adds to the account above. Not counted as income.</p>
    </form>
  );
}
