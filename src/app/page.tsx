import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3,
  CalendarClock,
  Check,
  CloudUpload,
  CreditCard,
  Download,
  EyeOff,
  HardDrive,
  KeyRound,
  ListChecks,
  LogOut,
  Plus,
  Scale,
  Share,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  SquarePlus,
  Split,
  Unplug,
  Users,
  Zap,
} from "lucide-react";
import { InstallButton, InstallSheet } from "@/components/install";
import { HeroSecondary, HeroVisual, OpenAppButton, Reveal } from "@/components/landing";
import { LogoMark } from "@/lib/logo";
import { SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import { cloudConfigured } from "@/lib/supabase";

export const metadata: Metadata = {
  title: { absolute: `${SITE_NAME}: ${SITE_TAGLINE}` },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  alternates: { canonical: "/" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  openGraph: {
    url: "/",
    title: `${SITE_NAME}: ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    type: "website",
    locale: "en_PH",
  },
  twitter: { card: "summary_large_image", title: `${SITE_NAME}: ${SITE_TAGLINE}`, description: SITE_DESCRIPTION },
};

const FAQ = [
  {
    q: "Is Kaban free?",
    a: "Yes. Kaban is free to use, with no trial and no paid tier. Cloud sync includes a generous per-account allowance that covers years of everyday records.",
  },
  {
    q: "Do I need an account?",
    a: cloudConfigured
      ? "No. Kaban works fully without one, and your records stay on your device. Create an account only if you want sync and backup across your phone, tablet and computer."
      : "No. Kaban works fully without one, and your records stay on your device.",
  },
  {
    q: "Does Kaban connect to my bank?",
    a: "No. Kaban never asks for bank, card or e-wallet logins and can't move money. You record transactions yourself, which takes a few seconds with quick add.",
  },
  {
    q: "What happens when I'm offline?",
    a: "Everything keeps working. Every screen and record is stored on your device, so you can add, edit and review transactions with no signal. Changes sync in the background once you're back online.",
  },
  ...(cloudConfigured
    ? [
        {
          q: "Where is my data stored when I sync?",
          a: "In a private cloud space tied to your account. Access rules on the database only allow your account to read your records, and you can protect sign-in with an authenticator app. You can delete your cloud data at any time from Sync & backup.",
        },
      ]
    : []),
  {
    q: "Can I export my data?",
    a: "Yes. Sync & backup exports a complete JSON backup you can keep anywhere and import again later. Imports merge by record, so nothing is duplicated.",
  },
];

/** Structured data so search engines understand Kaban is a free finance web app. */
const JSON_LD = [
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    applicationCategory: "FinanceApplication",
    operatingSystem: "iOS, Android, Web",
    browserRequirements: "Requires a modern browser. Installable as a Progressive Web App.",
    inLanguage: "en-PH",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "PHP" },
    featureList: [
      "Track cash, debit and credit accounts",
      "Shared family credit card tracking",
      "Credit card billing cycles and due dates",
      "Instalment and deferred purchase schedules",
      "Pay-later accounts such as Atome, SPayLater and LazPayLater",
      "Split expenses equally or by amount",
      "Who owes me and repayment tracking",
      "Works offline",
      ...(cloudConfigured ? ["Optional cloud sync across devices", "Two-factor sign-in"] : []),
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  },
];

const FEATURES = [
  {
    icon: CreditCard,
    title: "Shared credit cards",
    body: "Outstanding balance, available limit, utilisation and the next due date, even when the whole family uses one card.",
  },
  {
    icon: CalendarClock,
    title: "Instalments and billing cycles",
    body: "Bill a purchase normally, defer it to the next cycle, or spread it over 3–36 months. Each portion lands on the right statement.",
  },
  {
    icon: ShoppingBag,
    title: "Pay-later accounts",
    body: "Track Atome, SPayLater, LazPayLater and similar plans alongside your cards, with the same schedules and due dates.",
  },
  {
    icon: Split,
    title: "Splits and repayments",
    body: "Split a charge equally or by amount. Each share becomes a balance you can settle in full or in parts, into any account.",
  },
  {
    icon: Users,
    title: "People and totals",
    body: "See what each family member or friend still owes you, with their full history of charges and repayments in one place.",
  },
  {
    icon: BarChart3,
    title: "Clear analytics",
    body: "Income against expenses, spending by category and card utilisation over time, with a table view for exact figures.",
  },
  {
    icon: EyeOff,
    title: "Privacy mode",
    body: "One tap masks every amount on screen, including the number of digits, so you can open Kaban in public with confidence.",
  },
  {
    icon: Zap,
    title: "Quick add",
    body: "Set the installed app to open straight on a new transaction, so recording a purchase takes seconds at the counter.",
  },
];

const SECURITY = [
  { icon: HardDrive, t: "Local-first by design", d: "Your device holds the working copy. The app never waits on the network to save or show a record." },
  { icon: Unplug, t: "No bank logins", d: "Kaban never asks for bank, card or e-wallet credentials and has no way to move your money." },
  ...(cloudConfigured
    ? [
        { icon: KeyRound, t: "Two-factor sign-in", d: "Protect your account with an authenticator app. Sync then requires the second factor too." },
        { icon: ShieldCheck, t: "Private by account", d: "Database access rules only let your account read your records. No one else's app can see them." },
        { icon: LogOut, t: "Clean sign-out", d: "Signing out erases the device copy, and warns you first if anything hasn't synced yet." },
      ]
    : []),
  { icon: Download, t: "Your data, portable", d: "Export a full backup at any time and import it on another device. No lock-in." },
];

const BANK_NAMES = ["BDO", "BPI", "Metrobank", "Security Bank", "UnionBank", "RCBC", "GCash", "Maya", "GoTyme", "MariBank", "Atome", "SPayLater"];

function SectionHead({ eyebrow, title, body, className }: { eyebrow: string; title: string; body?: string; className?: string }) {
  return (
    <Reveal className={className ?? "max-w-2xl"}>
      <p className="text-sm font-semibold tracking-wide text-brand-2 uppercase">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-[2.6rem] sm:leading-[1.1]">{title}</h2>
      {body && <p className="mt-4 text-lg text-pretty text-ink-2">{body}</p>}
    </Reveal>
  );
}

export default function Landing() {
  return (
    <div className="overflow-x-clip bg-bg text-ink">
      <script
        type="application/ld+json"
        // JSON-LD must be raw; content is static and escaped against </script> injection.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c") }}
      />
      {/* Nav */}
      <header className="pt-safe sticky top-0 z-40 border-b border-line/70 bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark size={32} />
            <span className="text-lg font-semibold tracking-tight">Kaban</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-ink-2 md:flex" aria-label="Sections">
            <a href="#features" className="hover:text-ink">Features</a>
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#security" className="hover:text-ink">Security</a>
            <a href="#faq" className="hover:text-ink">FAQ</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-4">
            {cloudConfigured && (
              <Link href="/login" className="hidden text-sm font-medium text-ink-2 hover:text-ink sm:inline">
                Sign in
              </Link>
            )}
            <OpenAppButton className="min-h-10 rounded-xl px-4 text-sm">Open app</OpenAppButton>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[40rem] bg-[radial-gradient(60%_50%_at_70%_20%,rgb(45_147_108/0.16),transparent)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-12 pb-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-20 lg:pb-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink-2">
              <span className="size-1.5 rounded-full bg-brand-2" />
              {cloudConfigured ? "Now with cloud sync and two-factor sign-in" : "Free · Offline-first · Built for the Philippines"}
            </p>
            <h1 className="mt-6 text-[2.6rem] leading-[1.04] font-semibold tracking-tighter text-balance sm:text-6xl lg:text-[4.1rem]">
              Every peso on the family card, <span className="text-brand-2">accounted for.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-pretty text-ink-2">
              Kaban is a money tracker for Filipino households. Track cash, debit, credit cards and pay-later plans in one place, with billing cycles,
              instalments, shared expenses and exactly who still owes you.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <OpenAppButton className="sm:min-w-56" />
              <HeroSecondary />
            </div>
            <ul className="mt-8 grid gap-x-6 gap-y-2 text-sm text-ink-2 sm:flex sm:flex-wrap">
              <li className="flex items-center gap-2"><Check className="size-4 text-brand-2" /> Free, no sign-up required</li>
              <li className="flex items-center gap-2"><Check className="size-4 text-brand-2" /> Works offline</li>
              <li className="flex items-center gap-2">
                <Check className="size-4 text-brand-2" /> {cloudConfigured ? "Optional sync across devices" : "Installs on iPhone and Android"}
              </li>
            </ul>
          </div>
          <HeroVisual />
        </div>
      </section>

      {/* Supported institutions */}
      <section className="border-y border-line bg-white py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-center text-sm text-ink-3">Set up accounts for the banks, e-wallets and pay-later services you already use</p>
          <ul className="mt-4 flex flex-wrap justify-center gap-x-7 gap-y-2 text-[0.95rem] font-semibold tracking-tight text-ink-3/90">
            {BANK_NAMES.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHead
            eyebrow="Features"
            title="Everything a shared household budget needs. Nothing it doesn't."
            body="Kaban is built around how families in the Philippines actually pay: one card swiped by several people, purchases on instalment, and money lent between relatives."
          />
          <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <article key={title} className="bg-white p-6 sm:p-7">
                <span className="grid size-10 place-items-center rounded-xl bg-pale text-brand">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-5 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* How it adds up */}
      <section id="how" className="scroll-mt-20 border-t border-line bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHead
            eyebrow="How it works"
            title="One ₱6,000 grocery run, split three ways."
            body="You pay with the family card and split it with Mama and Kuya. Here is what Kaban records, and what it deliberately doesn't."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { k: "Card outstanding", v: "+₱6,000", d: "The whole charge stays on the card. The bank doesn't care who ate what.", dark: true },
              { k: "Owed to you", v: "+₱4,000", d: "₱2,000 each from Mama and Kuya, tracked under People." },
              { k: "Mama pays ₱500", v: "−₱500", d: "Her balance drops and your wallet goes up. It isn't counted as income." },
              { k: "You pay the card", v: "−₱5,000", d: "Debit and card outstanding both drop, and your spending stays the same." },
            ].map((s, i) => (
              <Reveal key={s.k} delay={i * 0.08}>
                <div className={s.dark ? "h-full rounded-3xl bg-ink p-6 text-white shadow-float" : "h-full rounded-3xl border border-line bg-bg p-6"}>
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
            <p className="mt-6 flex items-start gap-3 rounded-2xl border border-line bg-pale/60 p-4 text-sm text-brand">
              <Scale className="mt-0.5 size-4 shrink-0" />
              Card payments, transfers, reimbursements and instalment schedules never inflate your spending. Amounts are stored in whole centavos and every
              balance is recalculated from the records, so totals always reconcile.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Security & sync */}
      <section id="security" className="scroll-mt-20 border-t border-line py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:items-start">
          <div>
            <SectionHead
              className="max-w-xl"
              eyebrow={cloudConfigured ? "Sync & security" : "Privacy"}
              title={cloudConfigured ? "Fast on your phone. Safe in the cloud, if you want it." : "Your money data stays on your device."}
              body={
                cloudConfigured
                  ? "Kaban saves to your device first, so it stays instant with or without signal. Sign in to back up and sync across devices; changes upload quietly in the background."
                  : "Kaban has no account wall and no bank logins. Records are stored in your browser on this device, and you can export a backup at any time."
              }
            />
            {cloudConfigured && (
              <Reveal>
                <div className="mt-8 rounded-3xl border border-line bg-white p-5 shadow-soft">
                  <ol className="grid gap-3 text-sm">
                    {[
                      { icon: Smartphone, t: "Saved on your device", d: "Instantly, even offline" },
                      { icon: ListChecks, t: "Queued for upload", d: "Every change is versioned" },
                      { icon: CloudUpload, t: "Synced to your account", d: "Then to your other devices" },
                    ].map(({ icon: Icon, t, d }, i) => (
                      <li key={t} className="flex items-center gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-pale text-brand">
                          <Icon className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{t}</p>
                          <p className="text-ink-3">{d}</p>
                        </div>
                        <span className="num text-xs font-semibold text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </Reveal>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {SECURITY.map(({ icon: Icon, t, d }, i) => (
              <Reveal key={t} delay={(i % 2) * 0.06}>
                <div className="h-full rounded-2xl border border-line bg-white p-5">
                  <Icon className="size-5 text-brand" />
                  <p className="mt-3 font-semibold">{t}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Install */}
      <section id="install" className="scroll-mt-20 bg-brand-deep py-20 text-white sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <p className="text-sm font-semibold tracking-wide text-mint uppercase">No app store required</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-[2.6rem] sm:leading-[1.1]">Install Kaban in under a minute.</h2>
            <p className="mt-4 text-lg text-white/75">
              Add it to your Home Screen on iPhone or Android, or install it on your computer. It opens full-screen like a native app and keeps working
              without internet.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <InstallButton />
            </div>
          </Reveal>
          <ol className="grid gap-3">
            {[
              { icon: Share, t: "Open Kaban in your browser", d: "On iPhone use Safari and tap Share. On Android, open the browser menu." },
              { icon: SquarePlus, t: "Add to Home Screen", d: "Choose Add to Home Screen (or Install app). Kaban appears next to your other apps." },
              { icon: Zap, t: "Optional: turn on quick add", d: "In Settings, choose “Open on the Add screen” so the icon starts a new transaction." },
            ].map(({ icon: Icon, t, d }, i) => (
              <Reveal key={t} delay={i * 0.08}>
                <li className="flex items-start gap-4 rounded-2xl bg-white/6 p-5 ring-1 ring-white/10">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-brand">
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <p className="font-semibold">{t}</p>
                    <p className="mt-0.5 text-sm text-white/70">{d}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHead className="max-w-md" eyebrow="FAQ" title="Questions, answered." body="The short version of how Kaban handles your money data." />
          <div className="divide-y divide-line rounded-3xl border border-line bg-white">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group px-5 sm:px-6 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium">
                  {q}
                  <Plus className="size-4 shrink-0 text-ink-3 transition group-open:rotate-45" />
                </summary>
                <p className="-mt-1 pb-5 text-ink-2">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-20 sm:px-6 sm:pb-24">
        <Reveal className="card-grain mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-ink px-6 py-14 text-center text-white sm:px-12 sm:py-16">
          <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl">Know what&apos;s on the card before the statement does.</h2>
          <p className="mx-auto mt-4 max-w-xl text-white/70">Start in seconds with your own numbers, or explore with sample data first.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <OpenAppButton variant="light" />
            {cloudConfigured && (
              <Link href="/signup" className="inline-flex min-h-12 items-center justify-center rounded-2xl px-5 font-medium text-white/80 ring-1 ring-white/20 hover:bg-white/10 hover:text-white">
                Create an account
              </Link>
            )}
          </div>
        </Reveal>
      </section>

      <InstallSheet />

      <footer className="border-t border-line bg-white pt-12 pb-[calc(2.5rem+var(--safe-bottom))]">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2.5">
              <LogoMark size={28} />
              <span className="font-semibold tracking-tight">Kaban</span>
            </Link>
            <p className="mt-3 max-w-sm text-sm text-ink-3">
              <i>Kaban</i> is Tagalog for coffer, as in <i>kaban ng bayan</i>. A free, offline-first money tracker for Filipino households.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold">Product</p>
            <ul className="mt-3 grid gap-2 text-sm text-ink-2">
              <li><a href="#features" className="hover:text-ink">Features</a></li>
              <li><a href="#how" className="hover:text-ink">How it works</a></li>
              <li><a href="#security" className="hover:text-ink">{cloudConfigured ? "Sync & security" : "Privacy"}</a></li>
              <li><a href="#faq" className="hover:text-ink">FAQ</a></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold">App</p>
            <ul className="mt-3 grid gap-2 text-sm text-ink-2">
              <li><Link href="/welcome" className="hover:text-ink">Get started</Link></li>
              {cloudConfigured && <li><Link href="/login" className="hover:text-ink">Sign in</Link></li>}
              {cloudConfigured && <li><Link href="/signup" className="hover:text-ink">Create an account</Link></li>}
              <li><a href="#install" className="hover:text-ink">Install</a></li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-10 flex max-w-6xl flex-col gap-2 border-t border-line px-4 pt-6 text-xs text-ink-3 sm:flex-row sm:justify-between sm:px-6">
          <span>Kaban · Amounts in PHP · Works offline</span>
          <span>Bank and wallet names belong to their owners. Kaban is not affiliated with any of them.</span>
        </div>
      </footer>
    </div>
  );
}
