"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { SettingsGroup, SettingsSwitch } from "@/components/settings-ui";
import { Button, Field, inputCls, Loading, PageHeader } from "@/components/ui";
import { formatDay, todayISO } from "@/lib/dates";
import { useLedger } from "@/lib/hooks";
import { setMeta } from "@/lib/repo";
import { DEFAULT_PAYDAYS, detectPaydays, formatPaydays, PAYDAYS_META, PAYDAY_WEEKEND_META, payCycle } from "@/lib/tools";
import { usePaydays } from "@/lib/tools-hooks";

const same = (a: number[], b: number[]) => a.length === b.length && a.every((day, i) => day === b[i]);

async function savePreference(key: string, value: number[] | boolean) {
  try {
    await setMeta(key, value);
    toast.success("Payday settings saved");
  } catch {
    toast.error("Couldn’t save payday settings");
  }
}

function PaydayForm({ current }: { current: number[] }) {
  const [first, setFirst] = useState(String(current[0] ?? 15));
  const [second, setSecond] = useState(current[1] ? String(current[1]) : "");
  const parse = (v: string) => (v.trim() === "" ? null : Number(v));
  const a = parse(first);
  const b = parse(second);
  const valid = (n: number | null) => n === null || (Number.isInteger(n) && n >= 1 && n <= 31);
  const ok = a !== null && valid(a) && valid(b) && a !== b;
  async function save(days: number[]) {
    await savePreference(PAYDAYS_META, [...new Set(days)].sort((x, y) => x - y));
  }
  return (
    <form className="space-y-4 p-4" onSubmit={(e) => { e.preventDefault(); if (ok && a !== null) void save([a, ...(b !== null ? [b] : [])]); }}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Payday" error={valid(a) && a !== null ? undefined : "Pick a day from 1 to 31"}>
          {(id) => <input id={id} className={inputCls} inputMode="numeric" value={first} onChange={(e) => setFirst(e.target.value.replace(/\D/g, "").slice(0, 2))} />}
        </Field>
        <Field label="Second payday" error={valid(b) ? (a === b ? "Pick a different day" : undefined) : "Pick a day from 1 to 31"}>
          {(id) => <input id={id} className={inputCls} inputMode="numeric" placeholder="None" value={second} onChange={(e) => setSecond(e.target.value.replace(/\D/g, "").slice(0, 2))} />}
        </Field>
      </div>
      <p className="px-1 text-xs text-ink-3">Leave the second day blank if you’re paid monthly. In shorter months, dates past the end of the month use its last day.</p>
      <Button type="submit" disabled={!ok} wrapperClassName="grid">Save paydays</Button>
      {!same(current, DEFAULT_PAYDAYS) && (
        <Button type="button" variant="ghost" wrapperClassName="grid" onClick={() => save(DEFAULT_PAYDAYS)}>Reset to the 15th and 30th</Button>
      )}
    </form>
  );
}

export default function PaydaySettingsPage() {
  const { paydays, moveEarlier, loading } = usePaydays();
  const ledger = useLedger();
  const today = todayISO();
  const detected = useMemo(() => detectPaydays(ledger.txns, today), [ledger.txns, today]);
  const suggestion = detected && !same(detected, paydays) ? detected : null;
  const { nextPayday } = payCycle(today, paydays, moveEarlier);

  return (
    <>
      <PageHeader title="Payday" back="/settings" privacy={false} />
      {loading ? <Loading /> : (
        <div className="space-y-6 px-4 pb-6">
          <SettingsGroup title="Pay schedule" footer={`Next payday: ${formatDay(nextPayday)}`}>
            <PaydayForm key={paydays.join(",")} current={paydays} />
            {suggestion && (
              <div className="flex items-start gap-2.5 px-4 py-3">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                <div className="text-sm">
                  <p className="text-ink-2">Suggested from your income: {formatPaydays(suggestion)}.</p>
                  <Button variant="ghost" onClick={() => void savePreference(PAYDAYS_META, suggestion)}>Use these paydays</Button>
                </div>
              </div>
            )}
          </SettingsGroup>
          <SettingsGroup title="Weekend rule">
            <SettingsSwitch
              icon={CalendarDays}
              label="Pay early on weekends"
              detail="Saturday or Sunday paydays move to Friday"
              checked={moveEarlier}
              onChange={(value) => void savePreference(PAYDAY_WEEKEND_META, value)}
            />
          </SettingsGroup>
        </div>
      )}
    </>
  );
}
