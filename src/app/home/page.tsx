"use client";

import { HapticButton, HapticLink } from "@/components/haptic-button";
import { motion } from "motion/react";
import Link from "next/link";
import { ArrowRight, CreditCard, HandCoins, Landmark, Plus, Wallet, WalletCards } from "lucide-react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SwipePager } from "@/components/swipe-pager";
import { CardStack } from "@/components/account-card";
import { SpendTrend } from "@/components/charts";
import { CreditOverview } from "@/components/credit-overview";
import { PrivacyToggle } from "@/components/privacy-toggle";
import { ProfileButton } from "@/components/profile-menu";
import { NotificationsButton } from "@/components/notifications-ui";
import { TxnRow } from "@/components/txn-row";
import { useHideVoided } from "@/lib/display-prefs";
import { BigMoney, ButtonLink, Card, EmptyState, Money, SectionTitle, Segmented } from "@/components/ui";
import { dailySpend } from "@/lib/finance";
import { useIsDesktop, useLedger } from "@/lib/hooks";
import { LogoMark } from "@/lib/logo";
import { useMoney } from "@/lib/privacy";
import { useProfile } from "@/lib/family";
import { KabanChest } from "@/components/kaban-chest";
import { SafeToSpendCard } from "@/components/tools-ui";

type Pane = "money" | "credit";

export default function HomePage() {
  const ledger = useLedger();
  const desktop = useIsDesktop();
  // Greet by the profile name (Profile › Edit); before one is set, the app's name.
  const name = useProfile()?.display_name?.trim();

  return (
    <div className="overflow-x-clip">
      <header className="pt-safe flex items-center justify-between px-4 pb-2 lg:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <LogoMark size={36} />
          <div className="min-w-0">
            <p className="text-xs text-ink-3">{greeting()}</p>
            <p className="truncate font-semibold tracking-tight">{name || "Kaban"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PrivacyToggle />
          <NotificationsButton />
          <ProfileButton />
        </div>
      </header>

      <div className="hidden items-end justify-between px-4 pt-6 pb-5 lg:flex">
        <div>
          <p className="text-sm text-ink-3">{greeting()}</p>
          <h1 className="text-[2rem] leading-tight font-semibold tracking-tight">Overview</h1>
        </div>
        <div className="flex items-center gap-2">
          <NotificationsButton />
          {ledger.activeAccounts.length > 0 && (
            <HapticLink href="/accounts/new" className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-line bg-surface px-4 text-sm font-medium hover:bg-pale">
              <Plus className="size-4" /> Add account
            </HapticLink>
          )}
        </div>
      </div>

      {!desktop && (
        <Suspense fallback={null}><MobileHome ledger={ledger} /></Suspense>
      )}
      {desktop && ledger.ready && (!ledger.activeAccounts.length ? (
        <DesktopSetup />
      ) : (
        <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] items-start gap-6 px-4">
          <section aria-label="Money">
            <MoneyPane ledger={ledger} onCredit={() => document.getElementById("credit-col")?.scrollIntoView({ behavior: "smooth" })} />
          </section>
          <section id="credit-col" aria-label="Credit" className="intro-stagger sticky top-6">
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
      ))}
    </div>
  );
}

function MobileHome({ ledger }: { ledger: ReturnType<typeof useLedger> }) {
  const params = useSearchParams();
  const pane: Pane = params.get("pane") === "credit" ? "credit" : "money";

  function setPane(next: Pane) {
    const url = new URL(window.location.href);
    if (next === "credit") url.searchParams.set("pane", "credit");
    else url.searchParams.delete("pane");
    // Replace this history entry so returning from a form also restores the pane after a remount.
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  return (
    <>
      <div className="px-4 pt-4 pb-3">
        <Segmented<Pane>
          value={pane}
          onChange={setPane}
          options={[
            { value: "money", label: "Money" },
            { value: "credit", label: "Credit" },
          ]}
        />
      </div>
      {ledger.ready && (
        <SwipePager index={pane === "money" ? 0 : 1} onIndexChange={(index) => setPane(index === 0 ? "money" : "credit")}>
          <MoneyPane ledger={ledger} onCredit={() => setPane("credit")} />
          <div className="intro-stagger"><CreditOverview ledger={ledger} /></div>
        </SwipePager>
      )}
    </>
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
  const spendable = activeAccounts.filter((a) => a.type !== "credit").length;
  const { hidden } = useMoney();
  const [hideVoided] = useHideVoided();
  const recent = hideVoided ? txns.filter((t) => t.state !== "void") : txns;

  if (!activeAccounts.length)
    return (
      <EmptyState
        icon={<WalletCards className="size-6" />}
        title="Add your first account"
        body="Start with your wallet cash, a bank or e-wallet account, or a credit card."
        action={
          <ButtonLink href="/accounts/new">
            <Plus className="size-4" /> Add account
          </ButtonLink>
        }
      />
    );

  return (
    <div className="intro-stagger">
      <div className="flex items-end gap-3 pt-5">
        <div className="@container min-w-0 flex-1 pb-5">
          <p className="text-sm text-ink-3">Available funds · cash & debit</p>
          <motion.div key={totals.availableFunds} initial={{ opacity: 0.4, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3">
            <BigMoney minor={totals.availableFunds} className="block text-[clamp(2.25rem,17cqw,3.5rem)] leading-none tracking-tighter" centsClass="text-[0.57em]" />
          </motion.div>
          <p className="mt-2.5 text-xs text-ink-3">
            Across {spendable} {spendable === 1 ? "account" : "accounts"}
          </p>
        </div>
        <KabanChest amount={totals.availableFunds} hidden={hidden} className="size-26 lg:size-32" />
      </div>

      <div className="space-y-5 pt-3 pb-6">
        <div className="grid grid-cols-2 gap-3">
          <HapticButton onClick={onCredit} wrapperClassName="grid" className="rounded-3xl border border-line bg-surface p-4 text-left shadow-soft hover:bg-pale active:scale-[0.98]">
            <p className="text-xs text-ink-3">Credit outstanding</p>
            <Money minor={totals.creditOutstanding} className="mt-1 block text-xl font-semibold" />
            <p className="mt-2 flex items-center gap-1 text-xs font-medium text-brand">
              Credit view <ArrowRight className="size-3" />
            </p>
          </HapticButton>
          <Link href="/owed" className="rounded-3xl border border-line bg-surface p-4 shadow-soft hover:bg-pale active:scale-[0.98]">
            <p className="flex items-center gap-1 text-xs text-ink-3">
              <HandCoins className="size-3.5 text-brand" /> Owed to me
            </p>
            <Money minor={receivable} className="mt-1 block text-xl font-semibold" />
            <p className="mt-2 text-xs text-ink-3">Net position <Money minor={totals.netPosition} /></p>
          </Link>
        </div>

        <CardStack items={cards} />

        <SafeToSpendCard />

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
            {recent.length ? (
              recent.slice(0, 6).map((t) => <TxnRow key={t.id} t={t} ledger={ledger} />)
            ) : (
              <p className="p-4 text-sm text-ink-3">
                Nothing yet. Tap <b>+</b> to add your first transaction.
              </p>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}

/** Desktop first-run: one setup panel instead of two empty columns. */
function DesktopSetup() {
  const options = [
    { href: "/accounts/new?type=cash", icon: Wallet, title: "Cash wallet", body: "Money in your pocket or at home." },
    { href: "/accounts/new?type=debit", icon: Landmark, title: "Bank or e-wallet", body: "Savings, payroll, GCash, Maya…" },
    { href: "/accounts/new?type=credit", icon: CreditCard, title: "Credit card", body: "Limit, billing cycle and due date." },
  ];
  return (
    <div className="px-4">
      <div className="rounded-[2rem] border border-line bg-surface p-10 shadow-soft">
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
              <span className="grid size-11 place-items-center rounded-2xl bg-surface text-brand ring-1 ring-line">
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
      </div>
    </div>
  );
}
