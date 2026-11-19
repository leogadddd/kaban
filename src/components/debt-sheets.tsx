"use client";

import { useState } from "react";
import { todayISO } from "@/lib/dates";
import type { DebtStatus } from "@/lib/finance";
import type { Ledger } from "@/lib/hooks";
import { formatMoney, minorToInput, parseMinor } from "@/lib/money";
import { recordRepayment, saveDebt, savePerson } from "@/lib/repo";
import { Button, Chip, cx, Field, inputCls, Sheet } from "./ui";

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
      <Field label="Date">{(id) => <input id={id} type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
      {error && <p className="text-sm text-expense" role="alert">{error}</p>}
      <Button type="submit" className="w-full">Save debt</Button>
    </form>
  );
}

export function RepaySheet({ status, onClose, ledger }: { status: DebtStatus | null; onClose: () => void; ledger: Ledger }) {
  return (
    <Sheet open={!!status} onClose={onClose} title="Record repayment">
      {status && <RepayForm status={status} onClose={onClose} ledger={ledger} />}
    </Sheet>
  );
}

function RepayForm({ status, onClose, ledger }: { status: DebtStatus; onClose: () => void; ledger: Ledger }) {
  const funds = ledger.activeAccounts.filter((a) => a.type !== "credit");
  const [amount, setAmount] = useState(minorToInput(status.outstanding));
  const [accountId, setAccountId] = useState(funds[0]?.id ?? "");
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState<string>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const m = parseMinor(amount) ?? 0;
    if (!(m > 0)) return setError("Enter an amount");
    if (m > status.outstanding) return setError(`That's more than the ${formatMoney(status.outstanding)} still owed`);
    if (!accountId) return setError("Choose where the money went");
    try {
      await recordRepayment({ debtId: status.debt.id, amountMinor: m, accountId, date });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-ink-2">
        {status.debt.description} · <span className="num font-semibold">{formatMoney(status.outstanding)}</span> left
      </p>
      <Field label="Amount received">{(id) => <input id={id} className={cx(inputCls, "num text-lg")} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />}</Field>
      <div className="flex gap-2">
        <Chip onClick={() => setAmount(minorToInput(status.outstanding))} active={parseMinor(amount) === status.outstanding}>Full</Chip>
        <Chip onClick={() => setAmount(minorToInput(Math.round(status.outstanding / 2)))}>Half</Chip>
      </div>
      <div>
        <p className="mb-1.5 px-1 text-sm font-medium text-ink-2">Received into</p>
        <div className="flex flex-wrap gap-2">
          {funds.map((a) => <Chip key={a.id} active={accountId === a.id} onClick={() => setAccountId(a.id)}>{a.name}</Chip>)}
        </div>
        {!funds.length && <p className="text-sm text-expense">Add a cash or debit account first.</p>}
      </div>
      <Field label="Date">{(id) => <input id={id} type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
      {error && <p className="text-sm text-expense" role="alert">{error}</p>}
      <Button type="submit" className="w-full">Save repayment</Button>
      <p className="text-center text-xs text-ink-3">Increases the receiving account. Not counted as income.</p>
    </form>
  );
}
