"use client";

import { DateField } from "@/components/date-field";
import { useRouter, useSearchParams } from "next/navigation";
import { CreditCard, Landmark, Wallet } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { AccountCard } from "@/components/account-card";
import { Button, cx, Field, inputCls, Loading, PageHeader, Segmented } from "@/components/ui";
import { db } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import { minorToInput, parseMinor } from "@/lib/money";
import { BankLogo } from "@/components/bank-logo";
import { BANKS, bankById, bankFor } from "@/lib/banks";
import { ACCOUNT_COLORS, saveAccount } from "@/lib/repo";
import type { AccountType } from "@/lib/types";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <AccountForm />
    </Suspense>
  );
}

function AccountForm() {
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get("edit") ?? undefined;
  const first = params.get("first") === "1";

  const [type, setType] = useState<AccountType>((params.get("type") as AccountType) || "debit");
  const [name, setName] = useState("");
  const [opening, setOpening] = useState("");
  const [openingDate, setOpeningDate] = useState(todayISO());
  const [limit, setLimit] = useState("");
  const [closingDay, setClosingDay] = useState("15");
  const [dueDays, setDueDays] = useState("21");
  const [issuer, setIssuer] = useState("");
  const [bankId, setBankId] = useState<string>("");
  const [otherBank, setOtherBank] = useState(false);
  const [last4, setLast4] = useState("");
  const [color, setColor] = useState(ACCOUNT_COLORS[0]);
  const [error, setError] = useState<string>();
  const [loaded, setLoaded] = useState(!editId);

  useEffect(() => {
    if (!editId) return;
    db.accounts.get(editId).then((a) => {
      if (!a) return;
      setType(a.type);
      setName(a.name);
      setOpening(minorToInput(a.openingMinor));
      setOpeningDate(a.openingDate);
      setLimit(a.creditLimitMinor ? minorToInput(a.creditLimitMinor) : "");
      setClosingDay(String(a.closingDay ?? 15));
      setDueDays(String(a.dueDaysAfterClosing ?? 21));
      setIssuer(a.issuer ?? "");
      const b = bankFor(a);
      setBankId(b?.id ?? "");
      setOtherBank(!b && !!a.issuer);
      setLast4(a.last4 ?? "");
      setColor(a.color);
      setLoaded(true);
    });
  }, [editId]);

  const credit = type === "credit";
  const openingMinor = parseMinor(opening || "0") ?? 0;
  const limitMinor = parseMinor(limit || "0") ?? 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    if (!name.trim()) return setError("Give the account a name");
    if (parseMinor(opening || "0") === null) return setError("Opening amount isn't a valid number");
    const cd = Number(closingDay);
    const dd = Number(dueDays);
    if (credit) {
      if (!(limitMinor > 0)) return setError("Enter the card's credit limit");
      if (!(cd >= 1 && cd <= 31)) return setError("Closing day must be 1–31");
      if (!(dd >= 1 && dd <= 60)) return setError("Due days must be 1–60");
    }
    if (last4 && !/^\d{4}$/.test(last4)) return setError("Last four digits must be 4 numbers");
    try {
      const id = await saveAccount(
        {
          type,
          name: name.trim(),
          openingMinor,
          openingDate,
          creditLimitMinor: credit ? limitMinor : undefined,
          closingDay: credit ? cd : undefined,
          dueDaysAfterClosing: credit ? dd : undefined,
          issuer: type === "cash" ? undefined : (bankById(bankId)?.name ?? issuer.trim()) || undefined,
          bankId: type !== "cash" && bankId ? bankId : undefined,
          last4: last4 || undefined,
          color,
        },
        editId,
      );
      router.replace(first ? "/home" : `/accounts/view?id=${id}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!loaded) return <Loading />;

  const preview = {
    account: { id: "p", type, name: name || "New account", openingMinor, openingDate, color, archived: false, sortOrder: 0, createdAt: 0, updatedAt: 0, version: 0, issuer, bankId: bankId || undefined, last4, creditLimitMinor: limitMinor },
    balance: openingMinor,
    available: limitMinor - openingMinor,
    utilisation: limitMinor > 0 ? (openingMinor / limitMinor) * 100 : 0,
  };

  return (
    <>
      <PageHeader title={editId ? "Edit account" : first ? "Your first account" : "New account"} back={first ? undefined : true} />
      <form onSubmit={submit} className="space-y-4 px-4 pb-[calc(2rem+var(--safe-bottom))]">
        <AccountCard b={preview} />

        {!editId && (
          <Segmented<AccountType>
            value={type}
            onChange={setType}
            options={[
              { value: "cash", label: <span className="flex items-center justify-center gap-1.5"><Wallet className="size-4" />Cash</span> },
              { value: "debit", label: <span className="flex items-center justify-center gap-1.5"><Landmark className="size-4" />Debit</span> },
              { value: "credit", label: <span className="flex items-center justify-center gap-1.5"><CreditCard className="size-4" />Credit</span> },
            ]}
          />
        )}

        <Field label="Name">{(id) => <input id={id} className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={credit ? "Family Card" : type === "cash" ? "Wallet" : "Savings"} autoFocus={!editId} />}</Field>

        <Field label={credit ? "Current outstanding debt" : "Opening balance"} hint={credit ? "What you already owe on the card today. Not counted as spending." : "Your balance today. Not counted as income."}>
          {(id) => (
            <div className="relative">
              <span className="absolute top-1/2 left-4 -translate-y-1/2 text-ink-3">₱</span>
              <input id={id} className={cx(inputCls, "num pl-8")} inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value)} placeholder="0.00" />
            </div>
          )}
        </Field>

        <Field label="As of">{(id) => <DateField id={id} value={openingDate} onChange={setOpeningDate} title="Balance as of" />}</Field>

        {credit && (
          <>
            <Field label="Credit limit">
              {(id) => (
                <div className="relative">
                  <span className="absolute top-1/2 left-4 -translate-y-1/2 text-ink-3">₱</span>
                  <input id={id} className={cx(inputCls, "num pl-8")} inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="100,000" />
                </div>
              )}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Closing day" hint="Day of month the statement closes (1–31)">
                {(id) => <input id={id} className={cx(inputCls, "num")} inputMode="numeric" value={closingDay} onChange={(e) => setClosingDay(e.target.value.replace(/\D/g, ""))} />}
              </Field>
              <Field label="Due after (days)" hint="Days after closing. Most PH banks: 20–25">
                {(id) => <input id={id} className={cx(inputCls, "num")} inputMode="numeric" value={dueDays} onChange={(e) => setDueDays(e.target.value.replace(/\D/g, ""))} />}
              </Field>
            </div>
          </>
        )}

        {type !== "cash" && (
          <div>
            <p className="mb-1.5 px-1 text-sm font-medium text-ink-2">{credit ? "Card issuer" : "Bank or e-wallet"} (optional)</p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Bank">
              {BANKS.filter((b) => !credit || b.kind !== "wallet").map((b) => {
                const active = bankId === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setBankId(active ? "" : b.id);
                      setOtherBank(false);
                      if (!active) setColor(b.color);
                    }}
                    className={cx(
                      "flex min-h-[4.75rem] flex-col items-center justify-center gap-1.5 rounded-2xl border p-1.5 text-[0.68rem] leading-tight font-medium transition active:scale-95",
                      active ? "border-brand bg-pale text-ink ring-2 ring-brand/30" : "border-line bg-white text-ink-2",
                    )}
                  >
                    <BankLogo bank={b} size={32} />
                    <span className="line-clamp-1 text-center">{b.short}</span>
                  </button>
                );
              })}
              <button
                type="button"
                role="radio"
                aria-checked={otherBank}
                onClick={() => {
                  setOtherBank((v) => !v);
                  setBankId("");
                }}
                className={cx(
                  "flex min-h-[4.75rem] flex-col items-center justify-center gap-1.5 rounded-2xl border p-1.5 text-[0.68rem] font-medium transition active:scale-95",
                  otherBank ? "border-brand bg-pale text-ink ring-2 ring-brand/30" : "border-dashed border-line bg-white text-ink-2",
                )}
              >
                <span className="grid size-8 place-items-center rounded-[9px] bg-pale text-base text-brand">+</span>
                Other
              </button>
            </div>
            {otherBank && (
              <input className={cx(inputCls, "mt-2")} value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="Bank name" aria-label="Bank name" autoFocus />
            )}
          </div>
        )}
        {type !== "cash" && (
          <Field label="Last 4 digits (optional)">
            {(id) => <input id={id} className={cx(inputCls, "num")} inputMode="numeric" maxLength={4} value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, ""))} placeholder="1234" />}
          </Field>
        )}

        <div>
          <p className="mb-1.5 px-1 text-sm font-medium text-ink-2">Card colour</p>
          <div className="flex flex-wrap gap-2.5">
            {[...new Set([bankById(bankId)?.color, ...ACCOUNT_COLORS].filter((c): c is string => !!c))].map((c) => (
              <button type="button" key={c} onClick={() => setColor(c)} className={cx("size-10 rounded-full ring-offset-2 ring-offset-bg", color === c && "ring-2 ring-brand")} style={{ background: c }} aria-label={`Colour ${c}`} aria-pressed={color === c} />
            ))}
          </div>
        </div>

        {error && <p className="rounded-2xl bg-expense/10 p-3 text-sm text-expense" role="alert">{error}</p>}
        <Button type="submit" className="w-full">{editId ? "Save changes" : "Create account"}</Button>
        {first && (
          <Button type="button" variant="ghost" className="w-full" onClick={() => router.replace("/home")}>
            Skip for now
          </Button>
        )}
      </form>
    </>
  );
}
