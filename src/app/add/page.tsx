"use client";
/* eslint-disable react-hooks/set-state-in-effect -- form state is initialised from async IndexedDB reads and deep-link params */

import { DateField } from "@/components/date-field";
import { AnimatePresence, motion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Ban, Check, ChevronDown, CreditCard, Minus, Plus, RotateCcw, Split, UserPlus, X } from "lucide-react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Avatar, Button, Chip, cx, Field, inputCls, Loading, Segmented } from "@/components/ui";
import { shiftStatement, statementFor } from "@/lib/billing";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, TYPE_LABEL } from "@/lib/categories";
import { db } from "@/lib/db";
import { formatDayLong, todayISO } from "@/lib/dates";
import { BankLogo } from "@/components/bank-logo";
import { bankFor } from "@/lib/banks";
import { useLedger } from "@/lib/hooks";
import { animatedBack } from "@/lib/nav-direction";
import { formatMoney, minorToInput, parseMinor, splitEvenly } from "@/lib/money";
import { savePerson, saveTransaction, setTransactionVoid } from "@/lib/repo";
import { ME, type Account, type Arrangement, type Txn, type TxnType } from "@/lib/types";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Editor />
    </Suspense>
  );
}

const TYPES: TxnType[] = ["expense", "income", "transfer", "card_payment", "refund", "adjustment"];
const INSTALMENT_PRESETS = [3, 6, 9, 12, 18, 24, 36];

function Editor() {
  const router = useRouter();
  const params = useSearchParams();
  const ledger = useLedger();
  const editId = params.get("edit") ?? undefined;

  const [existing, setExisting] = useState<Txn | null | undefined>(editId ? undefined : null);
  const [type, setType] = useState<TxnType>(() => (TYPES.includes(params.get("type") as TxnType) ? (params.get("type") as TxnType) : "expense"));
  const [amount, setAmount] = useState(() => {
    const p = params.get("amount");
    const m = p ? parseMinor(p) : null;
    return m && m > 0 ? minorToInput(m) : "";
  });
  const [adjSign, setAdjSign] = useState<1 | -1>(1);
  const [accountId, setAccountId] = useState<string>("");
  const [toAccountId, setToAccountId] = useState<string>(params.get("to") ?? "");
  const [description, setDescription] = useState(params.get("description") ?? params.get("note") ?? "");
  const [category, setCategory] = useState(params.get("category") ?? "");
  const [date, setDate] = useState(params.get("date") ?? todayISO());
  const [notes, setNotes] = useState("");
  const [arrangement, setArrangement] = useState<Arrangement>("regular");
  const [months, setMonths] = useState(6);
  const [splitOn, setSplitOn] = useState(false);
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
  const [participants, setParticipants] = useState<string[]>([ME]);
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [newPerson, setNewPerson] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const initialised = useRef(false);

  useEffect(() => {
    if (!editId) amountRef.current?.focus({ preventScroll: true });
  }, [editId, ledger.ready]);

  // Load the record being edited.
  useEffect(() => {
    if (!editId) return;
    (async () => {
      const t = await db.transactions.get(editId);
      setExisting(t ?? null);
      if (!t) return;
      setType(t.type);
      setAmount(minorToInput(Math.abs(t.amountMinor)));
      setAdjSign(t.amountMinor < 0 ? -1 : 1);
      setAccountId(t.accountId);
      setToAccountId(t.toAccountId ?? "");
      setDescription(t.description);
      setCategory(t.category ?? "");
      setDate(t.date);
      setNotes(t.notes ?? "");
      setArrangement(t.arrangement ?? "regular");
      setMonths(t.instalmentCount ?? 6);
      const splits = await db.splits.where("transactionId").equals(t.id).toArray();
      if (splits.length) {
        setSplitOn(true);
        setParticipants(splits.map((s) => s.personId));
        const amounts = splits.map((s) => s.amountMinor);
        const even = splitEvenly(t.amountMinor, splits.length);
        const isEven = [...amounts].sort().join() === [...even].sort().join();
        setSplitMode(isEven ? "equal" : "custom");
        setCustom(Object.fromEntries(splits.map((s) => [s.personId, minorToInput(s.amountMinor)])));
      }
    })();
  }, [editId]);

  // Default / deep-linked account once accounts load. Accepts an id or a case-insensitive name.
  useEffect(() => {
    if (!ledger.ready || initialised.current || editId) return;
    initialised.current = true;
    const want = params.get("account")?.toLowerCase();
    const match = want && ledger.activeAccounts.find((a) => a.id === want || a.name.toLowerCase() === want);
    const fallbackCredit = ledger.activeAccounts.find((a) => a.type === "credit");
    const fallbackFunds = ledger.activeAccounts.find((a) => a.type !== "credit");
    if (match) setAccountId(match.id);
    else if (type === "card_payment" || type === "transfer" || type === "income") setAccountId(fallbackFunds?.id ?? "");
    else setAccountId((fallbackCredit ?? fallbackFunds)?.id ?? "");
    if (type === "card_payment" && !toAccountId) setToAccountId(fallbackCredit?.id ?? "");
  }, [ledger.ready, ledger.activeAccounts, params, type, editId, toAccountId]);

  const accounts = ledger.activeAccounts.concat(
    // keep archived accounts selectable when editing an old record
    ledger.accounts.filter((a) => a.archived && (a.id === accountId || a.id === toAccountId)),
  );
  const fromChoices = accounts.filter((a) => {
    if (type === "income" || type === "transfer" || type === "card_payment" || type === "reimbursement") return a.type !== "credit";
    return true;
  });
  const toChoices = accounts.filter((a) => (type === "card_payment" ? a.type === "credit" : a.type !== "credit" && a.id !== accountId));
  const account = ledger.accountById.get(accountId);

  // Keep selection valid when switching type.
  useEffect(() => {
    if (!ledger.ready) return;
    if (accountId && !fromChoices.some((a) => a.id === accountId)) setAccountId(fromChoices[0]?.id ?? "");
    if ((type === "transfer" || type === "card_payment") && !toChoices.some((a) => a.id === toAccountId)) setToAccountId(toChoices[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, accountId, ledger.ready]);

  const amountMinor = parseMinor(amount) ?? 0;
  const isCreditPurchase = type === "expense" && account?.type === "credit";
  const canSplit = type === "expense";
  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const showCategories = type === "expense" || type === "income";

  const allocations = useMemo(() => {
    if (!splitOn || !canSplit) return [];
    if (splitMode === "equal") {
      const parts = splitEvenly(amountMinor, participants.length);
      return participants.map((p, i) => ({ personId: p, amountMinor: parts[i] }));
    }
    return participants.map((p) => ({ personId: p, amountMinor: parseMinor(custom[p] ?? "") ?? 0 }));
  }, [splitOn, canSplit, splitMode, amountMinor, participants, custom]);
  const allocated = allocations.reduce((s, a) => s + a.amountMinor, 0);
  const remaining = amountMinor - allocated;

  const schedulePreview = useMemo(() => {
    if (!isCreditPurchase || !account) return null;
    const s = statementFor(account, date);
    if (arrangement === "regular") return `Billed on the ${formatDayLong(s)} statement`;
    if (arrangement === "deferred") return `Deferred to the ${formatDayLong(shiftStatement(account, s, 1))} statement`;
    const parts = splitEvenly(amountMinor, months);
    return `${months} × ${formatMoney(parts[parts.length - 1] ?? 0)} · ${formatDayLong(s)} → ${formatDayLong(shiftStatement(account, s, months - 1))}`;
  }, [isCreditPurchase, account, date, arrangement, months, amountMinor]);

  function toggleParticipant(id: string) {
    setParticipants((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function addPerson() {
    const name = newPerson.trim();
    if (!name) return;
    const id = await savePerson({ name });
    setParticipants((p) => [...p, id]);
    setNewPerson("");
  }

  const close = () => animatedBack(() => (window.history.length > 1 ? router.back() : router.replace("/home")), "down");

  async function submit() {
    setError(undefined);
    if (!(amountMinor > 0)) return setError("Enter an amount");
    if (splitOn && canSplit) {
      if (participants.length < 2) return setError("Pick at least two people to split with");
      if (remaining !== 0) return setError(`Split is ${remaining > 0 ? "short" : "over"} by ${formatMoney(Math.abs(remaining))}`);
    }
    setSaving(true);
    try {
      await saveTransaction(
        {
          type,
          accountId,
          toAccountId: type === "transfer" || type === "card_payment" ? toAccountId : undefined,
          amountMinor: type === "adjustment" ? adjSign * amountMinor : amountMinor,
          date,
          description: description.trim() || defaultDescription(type, category, ledger.accountById.get(toAccountId)),
          category: showCategories ? category || "Other" : type === "card_payment" ? "Card payment" : undefined,
          notes: notes.trim() || undefined,
          arrangement: isCreditPurchase ? arrangement : undefined,
          instalmentCount: isCreditPurchase && arrangement === "instalment" ? months : undefined,
          debtId: existing?.debtId,
          personId: existing?.personId,
          splits: canSplit && splitOn ? allocations : editId ? [] : undefined,
        },
        editId,
      );
      setSaved(true);
      setTimeout(close, 450);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  if (!ledger.ready || existing === undefined) return <Loading />;
  if (editId && existing === null) return <p className="p-6">Transaction not found.</p>;
  if (!ledger.activeAccounts.length)
    return (
      <div className="pt-safe p-6 text-center">
        <p className="font-semibold">Add an account first</p>
        <Button className="mt-4" onClick={() => router.replace("/accounts/new")}>Add account</Button>
      </div>
    );

  const isReimbursement = type === "reimbursement";
  const voided = existing?.state === "void";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="pt-safe sticky top-0 z-20 flex items-center justify-between bg-bg/85 px-4 pb-2 backdrop-blur-xl">
        <button onClick={close} className="-ml-2 grid size-11 place-items-center rounded-full active:bg-pale" aria-label="Close">
          <X className="size-6" />
        </button>
        <h1 className="font-semibold">{editId ? (voided ? "Voided transaction" : "Edit transaction") : "New transaction"}</h1>
        <span className="size-11" />
      </header>

      <div className="flex-1 space-y-5 px-4 pb-40">
        {/* Type */}
        {isReimbursement ? (
          <p className="rounded-2xl bg-pale p-3 text-sm text-brand">Reimbursement from {ledger.personById.get(existing?.personId ?? "")?.name ?? "someone"} — linked to a debt in Who Owes Me.</p>
        ) : (
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label="Transaction type">
            {TYPES.map((t) => (
              <Chip key={t} active={type === t} onClick={() => setType(t)}>
                {TYPE_LABEL[t]}
              </Chip>
            ))}
          </div>
        )}

        {/* Amount first */}
        <div className="text-center">
          <label htmlFor="amount" className="text-sm text-ink-3">
            {type === "card_payment" ? "Payment amount" : type === "adjustment" ? "Adjust balance by" : "Amount"}
          </label>
          <div className="mt-1 flex items-center justify-center gap-2">
            {type === "adjustment" && (
              <button onClick={() => setAdjSign((s) => (s === 1 ? -1 : 1))} className="grid size-11 place-items-center rounded-full bg-pale text-brand" aria-label={adjSign === 1 ? "Increase (tap to decrease)" : "Decrease (tap to increase)"}>
                {adjSign === 1 ? <Plus className="size-5" /> : <Minus className="size-5" />}
              </button>
            )}
            <span className="text-4xl font-semibold text-ink-3" aria-hidden="true">₱</span>
            <input
              id="amount"
              ref={amountRef}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
              placeholder="0"
              className="num max-w-[17rem] bg-transparent text-left text-[3.4rem] leading-none font-semibold tracking-tighter outline-none placeholder:text-line"
              style={{ fontSize: amount.length > 8 ? "2.6rem" : undefined, width: `${Math.max(1, amount.length) * 0.62 + 0.2}em` }}
            />
          </div>
          {type === "adjustment" && account && (
            <p className="mt-1 text-xs text-ink-3">{adjSign === 1 ? (account.type === "credit" ? "Raises card outstanding" : "Raises balance") : account.type === "credit" ? "Lowers card outstanding" : "Lowers balance"}</p>
          )}
        </div>

        {/* Accounts */}
        <AccountPicker
          label={type === "card_payment" ? "Pay from" : type === "transfer" ? "From" : type === "income" ? "Into" : isReimbursement ? "Received into" : "Account"}
          accounts={fromChoices}
          value={accountId}
          onChange={setAccountId}
          ledger={ledger}
        />
        {(type === "transfer" || type === "card_payment") && (
          <AccountPicker label={type === "card_payment" ? "Card to pay" : "To"} accounts={toChoices} value={toAccountId} onChange={setToAccountId} ledger={ledger} />
        )}
        {type === "card_payment" && (
          <p className="-mt-2 px-1 text-xs text-ink-3">Lowers both the source balance and the card&apos;s outstanding. Not counted as spending.</p>
        )}

        {/* Credit arrangement */}
        <AnimatePresence initial={false}>
          {isCreditPurchase && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="space-y-3 rounded-3xl border border-line bg-white p-4">
                <p className="flex items-center gap-1.5 text-sm font-medium"><CreditCard className="size-4 text-brand" /> Billing</p>
                <Segmented<Arrangement>
                  size="sm"
                  value={arrangement}
                  onChange={setArrangement}
                  options={[
                    { value: "regular", label: "Regular" },
                    { value: "deferred", label: "Next cycle" },
                    { value: "instalment", label: "Instalment" },
                  ]}
                />
                {arrangement === "instalment" && (
                  <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
                    {INSTALMENT_PRESETS.map((m) => (
                      <Chip key={m} active={months === m} onClick={() => setMonths(m)}>
                        {m} mo
                      </Chip>
                    ))}
                  </div>
                )}
                {schedulePreview && <p className="num text-xs text-ink-3">{schedulePreview}</p>}
                {arrangement !== "regular" && <p className="text-xs text-ink-3">The full amount counts toward outstanding now; only billing is scheduled.</p>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Description + category */}
        <Field label="Description">
          {(id) => <input id={id} className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={type === "expense" ? "What was it for?" : "Optional"} />}
        </Field>

        {showCategories && (
          <div>
            <p className="mb-1.5 px-1 text-sm font-medium text-ink-2">Category</p>
            <div className="grid grid-cols-4 gap-2">
              {categories.map(({ name, icon: Icon }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setCategory(name)}
                  aria-pressed={category === name}
                  className={cx(
                    "flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-2xl border p-1.5 text-[0.68rem] leading-tight font-medium transition",
                    category === name ? "border-brand bg-brand text-white" : "border-line bg-white text-ink-2",
                  )}
                >
                  <Icon className="size-5" />
                  <span className="line-clamp-2 text-center">{name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <Field label="Date">{(id) => <DateField id={id} value={date} onChange={setDate} title="Transaction date" />}</Field>

        {/* Split */}
        {canSplit && (
          <div className="rounded-3xl border border-line bg-white p-4">
            <button type="button" onClick={() => setSplitOn((v) => !v)} className="flex w-full items-center justify-between" aria-expanded={splitOn}>
              <span className="flex items-center gap-2 font-medium"><Split className="size-4 text-brand" /> Split with others</span>
              <span className={cx("relative h-7 w-12 rounded-full transition-colors", splitOn ? "bg-brand" : "bg-line")}>
                <motion.span layout className={cx("absolute top-1 size-5 rounded-full bg-white shadow", splitOn ? "right-1" : "left-1")} />
              </span>
            </button>
            <AnimatePresence initial={false}>
              {splitOn && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="space-y-3 pt-4">
                    <div className="flex flex-wrap gap-2">
                      <Chip active={participants.includes(ME)} onClick={() => toggleParticipant(ME)}>Me</Chip>
                      {ledger.people.filter((p) => !p.archived).map((p) => (
                        <Chip key={p.id} active={participants.includes(p.id)} onClick={() => toggleParticipant(p.id)}>
                          {p.name}
                        </Chip>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input className={cx(inputCls, "min-h-11")} placeholder="Add a person" value={newPerson} onChange={(e) => setNewPerson(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPerson())} />
                      <Button type="button" variant="secondary" className="min-h-11 px-3" onClick={addPerson} aria-label="Add person"><UserPlus className="size-4" /></Button>
                    </div>
                    <Segmented<"equal" | "custom">
                      size="sm"
                      value={splitMode}
                      onChange={(m) => {
                        if (m === "custom") setCustom(Object.fromEntries(allocations.map((a) => [a.personId, minorToInput(a.amountMinor)])));
                        setSplitMode(m);
                      }}
                      options={[
                        { value: "equal", label: "Split equally" },
                        { value: "custom", label: "Custom amounts" },
                      ]}
                    />
                    <ul className="divide-y divide-line">
                      {allocations.map((a) => {
                        const person = a.personId === ME ? { name: "Me", color: "#176B4D" } : ledger.personById.get(a.personId);
                        return (
                          <li key={a.personId} className="flex items-center gap-3 py-2">
                            <Avatar name={person?.name ?? "?"} color={person?.color ?? "#999"} size={32} />
                            <span className="flex-1 text-sm font-medium">{person?.name}{a.personId !== ME && <span className="block text-xs font-normal text-ink-3">will owe you</span>}</span>
                            {splitMode === "equal" ? (
                              <span className="num font-semibold">{formatMoney(a.amountMinor)}</span>
                            ) : (
                              <div className="w-28 shrink-0">
                              <input
                                inputMode="decimal"
                                aria-label={`${person?.name} share`}
                                className={cx(inputCls, "num min-h-10 px-3 text-right")}
                                value={custom[a.personId] ?? ""}
                                onChange={(e) => setCustom((c) => ({ ...c, [a.personId]: e.target.value }))}
                              />
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                    {participants.length > 0 && (
                      <p className={cx("num flex items-center gap-1.5 text-xs font-medium", remaining === 0 ? "text-income" : "text-expense")}>
                        {remaining === 0 ? <><Check className="size-3.5" /> Adds up to {formatMoney(amountMinor)}</> : <>{remaining > 0 ? "Unassigned" : "Over by"} {formatMoney(Math.abs(remaining))}</>}
                      </p>
                    )}
                    {account?.type === "credit" && <p className="text-xs text-ink-3">The whole charge stays on the card; splitting only tracks who owes you.</p>}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <button type="button" onClick={() => setMoreOpen((v) => !v)} className="flex items-center gap-1 px-1 text-sm font-medium text-brand" aria-expanded={moreOpen}>
          Notes <ChevronDown className={cx("size-4 transition", moreOpen && "rotate-180")} />
        </button>
        {(moreOpen || notes) && (
          <textarea className={cx(inputCls, "min-h-24 py-3")} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to remember" aria-label="Notes" />
        )}

        {editId && existing && (
          <Button
            variant={voided ? "secondary" : "danger"}
            className="w-full"
            onClick={async () => {
              if (!voided && !confirm("Void this transaction? It stays in history but stops affecting balances.")) return;
              await setTransactionVoid(existing.id, !voided);
              close();
            }}
          >
            {voided ? <><RotateCcw className="size-4" /> Restore transaction</> : <><Ban className="size-4" /> Void transaction</>}
          </Button>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md bg-gradient-to-t lg:left-64 lg:max-w-xl from-bg via-bg to-transparent px-4 pt-6 pb-[max(var(--safe-bottom),1rem)]">
        {error && <p className="mb-2 rounded-2xl bg-expense/10 p-3 text-sm text-expense" role="alert">{error}</p>}
        <Button className="w-full text-base" onClick={submit} disabled={saving || voided}>
          <AnimatePresence mode="wait" initial={false}>
            {saved ? (
              <motion.span key="ok" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-2"><Check className="size-5" /> Saved</motion.span>
            ) : (
              <motion.span key="save" className="num">
                {editId ? "Save changes" : `Save${amountMinor > 0 ? ` ${formatMoney(amountMinor)}` : ""}`}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </div>
    </div>
  );
}

function defaultDescription(type: TxnType, category: string, to?: Account) {
  if (type === "card_payment") return `Payment to ${to?.name ?? "card"}`;
  if (type === "transfer") return `Transfer to ${to?.name ?? "account"}`;
  if (type === "adjustment") return "Balance adjustment";
  return category || TYPE_LABEL[type];
}

function AccountPicker({ label, accounts, value, onChange, ledger }: { label: string; accounts: Account[]; value: string; onChange: (id: string) => void; ledger: ReturnType<typeof useLedger> }) {
  return (
    <div>
      <p className="mb-1.5 px-1 text-sm font-medium text-ink-2">{label}</p>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label={label}>
        {accounts.map((a) => {
          const b = ledger.balances.get(a.id);
          const active = a.id === value;
          return (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(a.id)}
              className={cx("min-w-36 shrink-0 rounded-2xl border p-3 text-left transition", active ? "border-transparent text-white shadow-float" : "border-line bg-white")}
              style={active ? { background: a.color } : undefined}
            >
              <span className="flex items-center gap-1.5 text-sm font-medium">
                {(() => {
                  const bank = a.type === "cash" ? undefined : bankFor(a);
                  if (bank) return <BankLogo bank={bank} size={20} />;
                  return !active && <span className="size-2.5 rounded-full" style={{ background: a.color }} />;
                })()}
                {a.name}
              </span>
              <span className={cx("num block text-xs", active ? "text-white/75" : "text-ink-3")}>
                {a.type === "credit" ? `${formatMoney(b?.available ?? 0, { compact: true })} available` : formatMoney(b?.balance ?? 0)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
