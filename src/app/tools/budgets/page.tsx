"use client";

import { createElement, useMemo, useState } from "react";
import { PieChart, Plus } from "lucide-react";
import { Select } from "@/components/picker";
import { GroupedTxns } from "@/components/txn-row";
import { BudgetFlag } from "@/components/tools-ui";
import { Button, Card, cx, EmptyState, Field, inputCls, Loading, Money, PageHeader, Progress, Segmented, Sheet } from "@/components/ui";
import { EXPENSE_CATEGORIES, iconFor } from "@/lib/categories";
import { formatAnalyticsRange } from "@/lib/analytics";
import { byCategory } from "@/lib/finance";
import { useLedger } from "@/lib/hooks";
import { minorToInput, parseMinor } from "@/lib/money";
import { useMoney } from "@/lib/privacy";
import { setMeta } from "@/lib/repo";
import { BUDGETS_META, budgetStatuses, type Budget, type BudgetPeriod, type BudgetStatus } from "@/lib/tools";
import { useBudgets, usePaydays } from "@/lib/tools-hooks";
import { toISO, todayISO } from "@/lib/dates";

const PERIOD_LABEL: Record<BudgetPeriod, string> = { month: "This month", cycle: "This pay cycle" };

function BudgetForm({ budgets, editing, suggestions, onDone }: { budgets: Budget[]; editing?: Budget; suggestions: Map<string, number>; onDone: () => void }) {
  const taken = new Set(budgets.map((b) => b.category));
  const choices = EXPENSE_CATEGORIES.filter((c) => c.name === editing?.category || !taken.has(c.name));
  const [category, setCategory] = useState(editing?.category ?? choices[0]?.name ?? "");
  const [amount, setAmount] = useState(editing ? minorToInput(editing.limitMinor) : "");
  const [period, setPeriod] = useState<BudgetPeriod>(editing?.period ?? "month");
  const limit = parseMinor(amount);
  const ok = !!category && limit !== null && limit > 0;
  const lastMonth = suggestions.get(category);

  async function save(next: Budget[]) {
    await setMeta(BUDGETS_META, next);
    onDone();
  }

  if (!choices.length) return <p className="pb-4 text-sm text-ink-3">Every category already has a budget.</p>;
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ok) return;
        const rest = budgets.filter((b) => b.category !== editing?.category && b.category !== category);
        save([...rest, { category, limitMinor: limit!, period }]);
      }}
    >
      <Field label="Category">
        {(id) => (
          <Select
            id={id}
            value={category}
            onChange={setCategory}
            disabled={!!editing}
            title="Category"
            options={choices.map((c) => ({ value: c.name, label: c.name, icon: c.icon }))}
          />
        )}
      </Field>
      <Field label="Limit" hint={lastMonth ? <>You spent <Money minor={lastMonth} /> on this last month.</> : undefined}>
        {(id) => (
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-3">₱</span>
            <input id={id} className={cx(inputCls, "pl-8")} inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        )}
      </Field>
      <div className="space-y-1.5">
        <p className="px-1 text-sm font-medium text-ink-2">Resets</p>
        <Segmented value={period} onChange={setPeriod} options={[{ value: "month", label: "Every month" }, { value: "cycle", label: "Every payday" }]} />
      </div>
      <Button type="submit" disabled={!ok} wrapperClassName="grid">{editing ? "Save budget" : "Add budget"}</Button>
      {editing && (
        <Button type="button" variant="danger" wrapperClassName="grid" onClick={() => save(budgets.filter((b) => b.category !== editing.category))}>Remove budget</Button>
      )}
    </form>
  );
}

function BudgetRow({ status, onOpen }: { status: BudgetStatus; onOpen: () => void }) {
  const { budget, spent, remaining, percent, level } = status;
  const { hidden } = useMoney();
  const color = level === "over" ? "var(--color-expense)" : level === "warn" ? "var(--color-gold)" : "var(--color-brand-2)";
  return (
    <li>
      <button type="button" onClick={onOpen} aria-haspopup="dialog" className="w-full rounded-3xl border border-line bg-surface p-4 text-left shadow-soft hover:bg-pale active:scale-[0.99]">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-pale text-brand" aria-hidden="true">{createElement(iconFor("expense", budget.category), { className: "size-[1.1rem]" })}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{budget.category}</span>
            <span className="block text-xs text-ink-3">{PERIOD_LABEL[budget.period]} · {formatAnalyticsRange(status, todayISO())}</span>
          </span>
          {!hidden && <span className="num shrink-0 text-sm font-semibold">{Math.round(percent)}%</span>}
        </div>
        {hidden ? <div className="mt-3 h-2 rounded-full bg-pale" aria-hidden="true" /> : <Progress value={percent} color={color} className="mt-3" />}
        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
          <span className="text-ink-2"><Money minor={spent} className="font-medium" /> of <Money minor={budget.limitMinor} /></span>
          <span className="flex items-center gap-2">
            <BudgetFlag level={level} />
            {remaining >= 0
              ? <span className="text-ink-3"><Money minor={remaining} className="font-medium text-ink-2" /> left</span>
              : <span className="font-medium text-expense"><Money minor={-remaining} /> over</span>}
          </span>
        </div>
      </button>
    </li>
  );
}

export default function BudgetsPage() {
  const ledger = useLedger();
  const budgets = useBudgets();
  const { paydays, moveEarlier, loading } = usePaydays();
  const { hidden } = useMoney();
  const today = todayISO();
  const statuses = useMemo(() => budgetStatuses(budgets, ledger.txns, today, paydays, moveEarlier).sort((a, b) => b.percent - a.percent), [budgets, ledger.txns, today, paydays, moveEarlier]);
  const [form, setForm] = useState<{ editing?: Budget } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const selected = statuses.find((s) => s.budget.category === open);
  const suggestions = useMemo(() => {
    const d = new Date();
    const last = toISO(new Date(d.getFullYear(), d.getMonth() - 1, 1)).slice(0, 7);
    return new Map(byCategory(ledger.txns, last).map((c) => [c.category, c.amount]));
  }, [ledger.txns]);
  const total = statuses.reduce((s, b) => s + b.budget.limitMinor, 0);
  const spent = statuses.reduce((s, b) => s + b.spent, 0);

  return (
    <>
      <PageHeader
        title="Budgets"
        back="/tools"
        action={budgets.length > 0 && budgets.length < EXPENSE_CATEGORIES.length ? (
          <button type="button" onClick={() => setForm({})} aria-label="Add budget" className="grid size-11 place-items-center rounded-full bg-pale text-brand active:scale-95">
            <Plus className="size-5" />
          </button>
        ) : undefined}
      />
      {!ledger.ready || loading ? <Loading /> : (
        <div className="space-y-4 px-4 pb-4">
          {!statuses.length ? (
            <Card>
              <EmptyState
                icon={<PieChart className="size-6" />}
                title="No budgets yet"
                body="Set a limit for a category like Food & Dining, and see how much is left this month or this pay cycle."
                action={<Button onClick={() => setForm({})}><Plus className="size-4" /> Add a budget</Button>}
              />
            </Card>
          ) : (
            <>
              <Card className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-xs text-ink-3">Budgeted spending so far</p>
                  <p className="text-sm text-ink-2"><Money minor={spent} className="text-lg font-semibold text-ink" /> of <Money minor={total} /></p>
                </div>
                {!hidden && <span className="num shrink-0 text-sm font-semibold text-ink-2">{total ? Math.round((spent / total) * 100) : 0}%</span>}
              </Card>
              <ul className="space-y-3">
                {statuses.map((s) => <BudgetRow key={s.budget.category} status={s} onOpen={() => setOpen(s.budget.category)} />)}
              </ul>
              <p className="px-1 text-xs text-ink-3">You&apos;re warned at 80% and when you go over. Tap a budget to see its transactions.</p>
            </>
          )}

          <Sheet open={form !== null} onClose={() => setForm(null)} title={form?.editing ? `Edit ${form.editing.category}` : "New budget"}>
            {form && <BudgetForm key={form.editing?.category ?? "new"} budgets={budgets} editing={form.editing} suggestions={suggestions} onDone={() => setForm(null)} />}
          </Sheet>
          <Sheet open={!!selected} onClose={() => setOpen(null)} title={selected?.budget.category ?? "Budget"}>
            {selected && (
              <div className="space-y-3">
                <p className="text-sm text-ink-3">
                  {formatAnalyticsRange(selected, today)} · {selected.txns.length} {selected.txns.length === 1 ? "transaction" : "transactions"}
                </p>
                {selected.txns.length ? <GroupedTxns txns={selected.txns} ledger={ledger} /> : <EmptyState title="Nothing spent yet" />}
                <Button variant="secondary" wrapperClassName="grid" onClick={() => { setForm({ editing: selected.budget }); setOpen(null); }}>Edit budget</Button>
              </div>
            )}
          </Sheet>
        </div>
      )}
    </>
  );
}
