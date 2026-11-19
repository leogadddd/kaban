import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarClock,
  CreditCard,
  HardDrive,
  ListChecks,
  Lock,
  Scale,
  Share,
  SmartphoneNfc,
  SquarePlus,
  Split,
  WifiOff,
  Zap,
} from "lucide-react";
import { InstallButton, InstallSheet, ShortcutBuilder } from "@/components/install";
import { HeroSecondary, HeroVisual, OpenAppButton, Reveal } from "@/components/landing";
import { LogoMark } from "@/lib/logo";

export const metadata: Metadata = {
  title: { absolute: "Kaban — Every peso on the family card, accounted for" },
  description:
    "Kaban is an offline-first tracker for cash, debit and a shared family credit card: billing cycles, instalments, splits and who owes you. Free, private, installs on iPhone.",
};

const FEATURES = [
  {
    icon: CreditCard,
    title: "One card, many hands",
    body: "See exactly what's owed to the bank, what's left of the limit, and when the next statement is due, even when the whole family uses the card.",
  },
  {
    icon: CalendarClock,
    title: "Instalments that make sense",
    body: "Bill a purchase normally, push it to the next cycle, or spread it over 3–36 months. Kaban schedules each portion against your closing date.",
  },
  {
    icon: Split,
    title: "Split it, then track it",
    body: "Split a charge equally or by amount. Everyone's share becomes a balance in Who Owes Me, and you can record partial repayments into any account.",
  },
  {
    icon: WifiOff,
    title: "Works with zero signal",
    body: "Every screen and every record lives on your phone. Add expenses in the mall basement and they're still there when you reopen the app.",
  },
  {
    icon: Zap,
    title: "Two-tap quick add",
    body: "Hook Kaban to an iPhone Shortcut, Back Tap or Home Screen icon and land straight on a pre-filled expense form.",
  },
  {
    icon: Scale,
    title: "No double counting",
    body: "Card payments, transfers, reimbursements and instalment schedules never inflate your spending. The numbers always reconcile.",
  },
];

export default function Landing() {
  return (
    <div className="overflow-x-clip bg-bg text-ink">
      {/* Nav */}
      <header className="pt-safe sticky top-0 z-40 border-b border-transparent bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark size={34} />
            <span className="text-lg font-semibold tracking-tight">Kaban</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-ink-2 md:flex" aria-label="Sections">
            <a href="#features" className="hover:text-ink">Features</a>
            <a href="#how" className="hover:text-ink">How it adds up</a>
            <a href="#install" className="hover:text-ink">Install</a>
            <a href="#shortcut" className="hover:text-ink">Quick add</a>
            <a href="#privacy" className="hover:text-ink">Privacy</a>
          </nav>
          <OpenAppButton className="min-h-10 px-4 text-sm">Open app</OpenAppButton>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[40rem] bg-[radial-gradient(60%_50%_at_70%_20%,rgb(45_147_108/0.18),transparent)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-10 pb-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-16 lg:pb-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-brand">
              <span className="size-1.5 rounded-full bg-brand-2" /> Offline-first · Made for ₱
            </p>
            <h1 className="mt-5 text-[2.75rem] leading-[1.02] font-semibold tracking-tighter sm:text-6xl lg:text-[4.4rem]">
              Every peso on the family card, <span className="text-brand-2">accounted for.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-2">
              Kaban tracks your cash, debit and the shared credit card everyone swipes: billing cycles, instalments, splits, and exactly who still owes you.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <OpenAppButton className="sm:min-w-56" />
              <HeroSecondary />
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-3">
              <li className="flex items-center gap-1.5"><HardDrive className="size-4 text-brand" /> No sign-up needed</li>
              <li className="flex items-center gap-1.5"><WifiOff className="size-4 text-brand" /> Works offline</li>
              <li className="flex items-center gap-1.5"><SmartphoneNfc className="size-4 text-brand" /> Installs on iPhone</li>
            </ul>
          </div>
          <HeroVisual />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 bg-white py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal className="max-w-2xl">
            <p className="text-sm font-semibold text-brand-2">Built around the shared card</p>
            <h2 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">The card is shared. The confusion doesn&apos;t have to be.</h2>
          </Reveal>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }, i) => (
              <Reveal key={title} delay={(i % 3) * 0.08}>
                <article className="h-full rounded-3xl border border-line bg-bg p-6 transition hover:-translate-y-1 hover:shadow-soft">
                  <span className="grid size-12 place-items-center rounded-2xl bg-pale text-brand">
                    <Icon className="size-6" />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-ink-2">{body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How it adds up */}
      <section id="how" className="scroll-mt-20 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal className="max-w-2xl">
            <p className="text-sm font-semibold text-brand-2">How it adds up</p>
            <h2 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">One ₱6,000 grocery run, three people.</h2>
            <p className="mt-4 text-lg text-ink-2">You pay with the family card and split it with Mama and Kuya. Here is what Kaban records, and what it deliberately doesn&apos;t.</p>
          </Reveal>
          <div className="mt-12 grid gap-4 lg:grid-cols-4">
            {[
              { k: "Card outstanding", v: "+₱6,000", d: "The whole charge stays on the card. The bank doesn't care who ate what.", dark: true },
              { k: "Owed to you", v: "+₱4,000", d: "₱2,000 each from Mama and Kuya, tracked in Who Owes Me." },
              { k: "Mama pays ₱500", v: "−₱500", d: "Her balance drops and your wallet goes up. It isn't counted as income." },
              { k: "You pay the card", v: "−₱5,000", d: "Debit and card outstanding both drop, and your spending stays the same." },
            ].map((s, i) => (
              <Reveal key={s.k} delay={i * 0.1}>
                <div className={s.dark ? "h-full rounded-3xl bg-ink p-6 text-white shadow-float" : "h-full rounded-3xl border border-line bg-white p-6"}>
                  <p className={s.dark ? "text-sm text-white/60" : "text-sm text-ink-3"}>
                    <span className="num mr-2 font-semibold">{String(i + 1).padStart(2, "0")}</span>
                    {s.k}
                  </p>
                  <p className="num mt-3 text-4xl font-semibold tracking-tighter">{s.v}</p>
                  <p className={s.dark ? "mt-3 text-sm text-white/70" : "mt-3 text-sm text-ink-2"}>{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <p className="mt-6 flex items-start gap-2 rounded-2xl bg-pale p-4 text-sm text-brand">
              <ListChecks className="mt-0.5 size-4 shrink-0" />
              Every amount is stored in whole centavos and every balance is recalculated from the records, so totals always reconcile and nothing drifts.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Install */}
      <section id="install" className="scroll-mt-20 bg-brand py-20 text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <p className="text-sm font-semibold text-mint">No App Store required</p>
            <h2 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Put Kaban on your Home Screen in 30 seconds.</h2>
            <p className="mt-4 text-lg text-white/75">It opens full-screen like a native app and keeps working without internet once it&apos;s installed.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <InstallButton />
              <a href="#shortcut" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 font-medium text-white ring-1 ring-white/25 hover:bg-white/10">
                <Zap className="size-4" /> Set up quick add
              </a>
            </div>
          </Reveal>
          <ol className="grid gap-3">
            {[
              { icon: Share, t: "Open Kaban in Safari", d: "Tap the Share button in the toolbar." },
              { icon: SquarePlus, t: "Add to Home Screen", d: "Scroll the share sheet and tap Add to Home Screen." },
              { icon: Zap, t: "Optional: a quick-add Shortcut", d: "Build a one-tap “Add expense” button below." },
            ].map(({ icon: Icon, t, d }, i) => (
              <Reveal key={t} delay={i * 0.1}>
                <li className="flex items-start gap-4 rounded-3xl bg-white/8 p-5 ring-1 ring-white/10">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-brand">
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <p className="font-semibold">{t}</p>
                    <p className="text-sm text-white/70">{d}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Quick-add Shortcut */}
      <section id="shortcut" className="scroll-mt-20 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal className="mb-10 max-w-2xl">
            <p className="text-sm font-semibold text-brand-2">iPhone Shortcut</p>
            <h2 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Log a purchase before you leave the counter.</h2>
            <p className="mt-4 text-lg text-ink-2">
              Make a Shortcut that asks for the amount and opens Kaban with the form already filled in. You can put it on your Home Screen or trigger it with a double tap on the back of your phone.
            </p>
          </Reveal>
          <ShortcutBuilder />
        </div>
      </section>

      {/* Privacy */}
      <section id="privacy" className="scroll-mt-20 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal className="grid gap-8 rounded-[2rem] border border-line bg-white p-8 sm:p-12 lg:grid-cols-[auto_1fr] lg:items-center">
            <span className="grid size-16 place-items-center rounded-3xl bg-pale text-brand">
              <Lock className="size-7" />
            </span>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">Your money data stays on your device.</h2>
              <p className="mt-3 max-w-3xl text-ink-2">
                Kaban has no account wall and no bank logins, and nothing is uploaded. Records are stored in your browser on this device. Export a backup anytime from Sync &amp; Backup. Optional cloud sync for multiple devices is on the roadmap.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-20 sm:px-6">
        <Reveal className="card-grain mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-ink px-6 py-14 text-center text-white sm:px-12">
          <h2 className="mx-auto max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">Know what&apos;s on the card before the statement does.</h2>
          <p className="mx-auto mt-4 max-w-xl text-white/70">Start in seconds with your own numbers, or explore with sample data first.</p>
          <div className="mt-8 flex justify-center">
            <OpenAppButton variant="light" />
          </div>
        </Reveal>
      </section>

      <InstallSheet />

      <footer className="border-t border-line py-8 pb-[calc(2rem+var(--safe-bottom))]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-sm text-ink-3 sm:flex-row sm:px-6">
          <span className="flex items-center gap-2"><LogoMark size={22} /> Kaban: <i>kaban</i> means coffer in Tagalog.</span>
          <span>Amounts in PHP · Works offline</span>
        </div>
      </footer>
    </div>
  );
}
