"use client";

import { motion, type PanInfo } from "motion/react";
import Link from "next/link";
import { ArrowRight, CreditCard, HandCoins, Landmark, Plus, Wallet, WalletCards } from "lucide-react";
import { useState } from "react";
import { CardStack } from "@/components/account-card";
import { SpendTrend } from "@/components/charts";
import { CreditOverview } from "@/components/credit-overview";
import { PrivacyToggle } from "@/components/privacy-toggle";
import { SyncPill } from "@/components/sync-pill";
import { TxnRow } from "@/components/txn-row";
import { BigMoney, Button, Card, EmptyState, Loading, Money, SectionTitle, Segmented } from "@/components/ui";
import { dailySpend } from "@/lib/finance";
import { useIsDesktop, useLedger } from "@/lib/hooks";
import { loadDemoData } from "@/lib/demo";
import { LogoMark } from "@/lib/logo";

type Pane = "money" | "credit";

export default function HomePage() {
  const ledger = useLedger();
  const [pane, setPane] = useState<Pane>("money");
  const desktop = useIsDesktop();

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.y) > Math.abs(info.offset.x)) return;
    if (pane === "money" && (info.offset.x < -80 || info.velocity.x < -500)) setPane("credit");
    if (pane === "credit" && (info.offset.x > 80 || info.velocity.x > 500)) setPane("money");
  };

  return (
    <div className="overflow-x-hidden">
      <header className="pt-safe flex items-center justify-between px-4 pb-2 lg:hidden">
        <div className="flex items-center gap-2.5">
          <LogoMark size={36} />
          <div>
            <p className="text-xs text-ink-3">{greeting()}</p>
            <p className="font-semibold tracking-tight">Kaban</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PrivacyToggle />
          <SyncPill />
        </div>
      </header>

      <div className="hidden items-end justify-between px-4 pt-6 pb-5 lg:flex">
        <div>
          <p className="text-sm text-ink-3">{greeting()}</p>
          <h1 className="text-[2rem] leading-tight font-semibold tracking-tight">Overview</h1>
        </div>
        {ledger.activeAccounts.length > 0 && (
          <div className="flex items-center gap-2">
          <PrivacyToggle withLabel />
          <Link href="/accounts/new" className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-line bg-white px-4 text-sm font-medium hover:bg-pale">
            <Plus className="size-4" /> Add account
          </Link>
          </div>
        )}
      </div>

      <div className="px-4 pb-3 lg:hidden">
        <Segmented<Pane>
          value={pane}
          onChange={setPane}
          options={[
            { value: "money", label: "Money" },
            { value: "credit", label: "Credit" },
          ]}
        />
      </div>

      {!ledger.ready ? (
        <Loading />
      ) : desktop && !ledger.activeAccounts.length ? (
        <DesktopSetup />
      ) : desktop ? (
        <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] items-start gap-6 px-4">
          <section aria-label="Money">
            <MoneyPane ledger={ledger} onCredit={() => document.getElementById("credit-col")?.scrollIntoView({ behavior: "smooth" })} />
          </section>
          <section id="credit-col" aria-label="Credit" className="sticky top-6">
            <h2 className="mb-3 px-1 text-sm font-semibold text-ink-2">Credit</h2>
            {ledger.activeAccounts.some((a) => a.type === "credit") ? (
              <CreditOverview ledger={ledger} />
            ) : (
              <Card className="p-2">
                <CreditOverview ledger={ledger} />
              </Card>
            )}
          </section>
        </div>
      ) : (
        <motion.div
          className="flex w-[200%] touch-pan-y"
          animate={{ x: pane === "money" ? "0%" : "-50%" }}
          transition={{ type: "spring", stiffness: 300, damping: 34 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.12}
          dragDirectionLock
          onDragEnd={onDragEnd}
        >
          <section className="w-1/2 px-4" aria-hidden={pane !== "money"} inert={pane !== "money"}>
            <MoneyPane ledger={ledger} onCredit={() => setPane("credit")} />
          </section>
          <section className="w-1/2 px-4" aria-hidden={pane !== "credit"} inert={pane !== "credit"}>
            <CreditOverview ledger={ledger} />
          </section>
        </motion.div>
      )}
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function MoneyPane({ ledger, onCredit }: { ledger: ReturnType<typeof useLedger>; onCredit: () => void }) {
  const { totals, activeAccounts, balances, txns } = ledger;
  const receivable = ledger.debtStatus.reduce((s, d) => s + Math.max(0, d.outstanding), 0);
  const cards = activeAccounts.map((a) => balances.get(a.id)!);
  const trend = dailySpend(txns, 30);
  const monthSpend = trend.reduce((s, d) => s + d.amount, 0);

  if (!activeAccounts.length)
    return (
      <EmptyState
        icon={<WalletCards className="size-6" />}
        title="Add your first account"
        body="Start with your wallet cash, a debit account or the family credit card."
        action={
          <Link href="/accounts/new">
            <Button>
              <Plus className="size-4" /> Add account
            </Button>
          </Link>
        }
      />
    );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-ink-3">Available funds · cash & debit</p>
        <motion.div key={totals.availableFunds} initial={{ opacity: 0.4, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <BigMoney minor={totals.availableFunds} className="block text-[3rem] leading-[1.05] tracking-tighter" centsClass="text-3xl" />
        </motion.div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={onCredit} className="rounded-3xl bg-ink p-4 text-left text-white shadow-float active:scale-[0.98]">
          <p className="text-xs text-white/60">Credit outstanding</p>
          <Money minor={totals.creditOutstanding} className="mt-1 block text-xl font-semibold" />
          <p className="mt-2 flex items-center gap-1 text-xs text-mint">
            Credit view <ArrowRight className="size-3" />
          </p>
        </button>
        <Link href="/owed" className="rounded-3xl bg-brand-2 p-4 text-white shadow-float active:scale-[0.98]">
          <p className="flex items-center gap-1 text-xs text-white/75">
            <HandCoins className="size-3.5" /> Owed to me
          </p>
          <Money minor={receivable} className="mt-1 block text-xl font-semibold" />
          <p className="mt-2 text-xs text-white/75">Net position <Money minor={totals.netPosition} /></p>
        </Link>
      </div>

      <CardStack items={cards} />

      <Card>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-semibold">Spending · last 30 days</p>
            <p className="text-xs text-ink-3">Expenses only — card payments & transfers excluded</p>
          </div>
          <Money minor={monthSpend} className="font-semibold" />
        </div>
        <SpendTrend data={trend} />
      </Card>

      <section>
        <SectionTitle action={<Link href="/activity" className="text-sm font-medium text-brand">See all</Link>}>Recent activity</SectionTitle>
        <Card className="p-1.5">
          {txns.length ? (
            txns.slice(0, 6).map((t) => <TxnRow key={t.id} t={t} ledger={ledger} />)
          ) : (
            <p className="p-4 text-sm text-ink-3">
              Nothing yet. Tap <b>+</b> to add your first transaction.
            </p>
          )}
        </Card>
      </section>
    </div>
  );
}

/** Desktop first-run: one setup panel instead of two empty columns. */
function DesktopSetup() {
  const [busy, setBusy] = useState(false);
  const options = [
    { href: "/accounts/new?type=cash", icon: Wallet, title: "Cash wallet", body: "Money in your pocket or at home." },
    { href: "/accounts/new?type=debit", icon: Landmark, title: "Bank or e-wallet", body: "Savings, payroll, GCash, Maya…" },
    { href: "/accounts/new?type=credit", icon: CreditCard, title: "Credit card", body: "The family card: limit, billing cycle, due date." },
  ];
  return (
    <div className="px-4">
      <div className="rounded-[2rem] border border-line bg-white p-10 shadow-soft">
        <div className="max-w-xl">
          <span className="grid size-12 place-items-center rounded-2xl bg-pale text-brand">
            <WalletCards className="size-6" />
          </span>
          <h2 className="mt-5 text-2xl font-semibold tracking-tight">Add your first account</h2>
          <p className="mt-2 text-ink-2">Start with whatever you use most. You can add the rest any time, and each one gets its own card on the Overview.</p>
        </div>
        <div className="mt-8 grid grid-cols-3 gap-4">
          {options.map(({ href, icon: Icon, title, body }) => (
            <Link key={href} href={href} className="group rounded-3xl border border-line bg-bg p-5 transition hover:-translate-y-0.5 hover:border-brand-2 hover:bg-pale">
              <span className="grid size-11 place-items-center rounded-2xl bg-white text-brand ring-1 ring-line">
                <Icon className="size-5" />
              </span>
              <p className="mt-4 font-semibold">{title}</p>
              <p className="mt-1 text-sm text-ink-3">{body}</p>
              <p className="mt-4 flex items-center gap-1 text-sm font-medium text-brand">
                Add <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
              </p>
            </Link>
          ))}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await loadDemoData();
          }}
          className="mt-6 text-sm font-medium text-ink-3 hover:text-brand disabled:opacity-50"
        >
          {busy ? "Loading sample data…" : "Or explore with sample data first"}
        </button>
      </div>
    </div>
  );
}
