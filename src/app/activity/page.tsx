"use client";

import { DateField } from "@/components/date-field";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";
import { GroupedTxns } from "@/components/txn-row";
import { Card, Chip, cx, EmptyState, inputCls, Loading, Money, PageHeader, Segmented } from "@/components/ui";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, TYPE_LABEL } from "@/lib/categories";
import { useLedger } from "@/lib/hooks";
import type { TxnType } from "@/lib/types";

type Range = "all" | "month" | "30" | "custom";

export default function ActivityPage() {
  const ledger = useLedger();
  const [q, setQ] = useState("");
  const [accountId, setAccountId] = useState("");
  const [type, setType] = useState<TxnType | "">("");
  const [category, setCategory] = useState("");
  const [range, setRange] = useState<Range>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showVoid, setShowVoid] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const d30 = new Date(now.getTime() - 30 * 86400000);
    const thirty = `${d30.getFullYear()}-${String(d30.getMonth() + 1).padStart(2, "0")}-${String(d30.getDate()).padStart(2, "0")}`;
    const needle = q.trim().toLowerCase();
    return ledger.txns.filter((t) => {
      if (!showVoid && t.state === "void") return false;
      if (accountId && t.accountId !== accountId && t.toAccountId !== accountId) return false;
      if (type && t.type !== type) return false;
      if (category && t.category !== category) return false;
      if (range === "month" && t.date < monthStart) return false;
      if (range === "30" && t.date < thirty) return false;
      if (range === "custom" && ((from && t.date < from) || (to && t.date > to))) return false;
      if (needle && !`${t.description} ${t.category ?? ""} ${t.notes ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [ledger.txns, q, accountId, type, category, range, from, to, showVoid]);

  const spent = filtered.filter((t) => t.type === "expense" && t.state === "active").reduce((s, t) => s + t.amountMinor, 0);
  const earned = filtered.filter((t) => t.type === "income" && t.state === "active").reduce((s, t) => s + t.amountMinor, 0);
  const activeFilters = [accountId, type, category, range !== "all" ? range : "", showVoid ? "v" : ""].filter(Boolean).length;
  const clear = () => {
    setAccountId("");
    setType("");
    setCategory("");
    setRange("all");
    setShowVoid(false);
  };

  return (
    <>
      <PageHeader title="Activity" />
      <div className="space-y-4 px-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" />
            <input className={cx(inputCls, "pl-10")} placeholder="Search description, category, notes" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search transactions" type="search" />
          </div>
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className={cx("relative grid size-12 shrink-0 place-items-center rounded-2xl border", filtersOpen || activeFilters ? "border-brand bg-brand text-white" : "border-line bg-white")}
            aria-label="Filters"
            aria-expanded={filtersOpen}
          >
            <SlidersHorizontal className="size-5" />
            {activeFilters > 0 && <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-gold text-[0.65rem] text-white">{activeFilters}</span>}
          </button>
        </div>

        {filtersOpen && (
          <Card className="space-y-3">
            <Segmented<Range>
              size="sm"
              value={range}
              onChange={setRange}
              options={[
                { value: "all", label: "All" },
                { value: "month", label: "Month" },
                { value: "30", label: "30 days" },
                { value: "custom", label: "Custom" },
              ]}
            />
            {range === "custom" && (
              <div className="grid grid-cols-2 gap-2">
                <DateField compact value={from} onChange={setFrom} placeholder="From" title="From date" max={to || undefined} allowClear />
                <DateField compact value={to} onChange={setTo} placeholder="To" title="To date" min={from || undefined} allowClear />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <select className={inputCls} value={accountId} onChange={(e) => setAccountId(e.target.value)} aria-label="Account">
                <option value="">All accounts</option>
                {ledger.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as TxnType | "")} aria-label="Type">
                <option value="">All types</option>
                {(Object.keys(TYPE_LABEL) as TxnType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
            </div>
            <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
              <option value="">All categories</option>
              {[...new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].map((c) => c.name))].map((c) => <option key={c}>{c}</option>)}
            </select>
            <div className="flex items-center justify-between">
              <Chip active={showVoid} onClick={() => setShowVoid((v) => !v)}>Show voided</Chip>
              {activeFilters > 0 && <button onClick={clear} className="flex items-center gap-1 text-sm text-brand"><X className="size-4" /> Clear</button>}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3"><p className="text-xs text-ink-3">Spent</p><Money minor={spent} className="font-semibold" /></Card>
          <Card className="p-3"><p className="text-xs text-ink-3">Earned</p><Money minor={earned} className="font-semibold text-income" /></Card>
        </div>

        {!ledger.ready ? <Loading /> : filtered.length ? <GroupedTxns txns={filtered} ledger={ledger} /> : <EmptyState icon={<Search className="size-6" />} title="No matching transactions" body="Try a different search or clear filters." />}
      </div>
    </>
  );
}
