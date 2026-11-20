/* eslint-disable @next/next/no-img-element -- tiny bundled PNGs; next/image adds nothing here */
import { HapticLink } from "@/components/haptic-button";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Bell,
  Check,
  CloudUpload,
  Download,
  EyeOff,
  HardDrive,
  KeyRound,
  ListChecks,
  LogOut,
  Moon,
  Plus,
  QrCode,
  Scale,
  Share,
  ShieldCheck,
  Smartphone,
  SquarePlus,
  Unplug,
  UserCheck,
  WifiOff,
  Zap,
} from "lucide-react";
import { ChestArt } from "@/components/chest-art";
import { InstallButton, InstallSheet } from "@/components/install";
import { CtaMascot, HeroSecondary, HeroStage, MascotGallery, MascotHero, OpenAppButton, Reveal } from "@/components/landing";
import { BANKS } from "@/lib/banks";
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
    a: "Yes. Kaban is free to use, with no trial and no ads. Cloud sync includes a generous per-account allowance that covers years of everyday records.",
  },
  {
    q: "Do I need an account?",
    a: cloudConfigured
      ? "No. Kaban works fully without one, and your records stay on your device. Create an account only if you want sync and backup across your phone, tablet and computer, or to use families and quick add."
      : "No. Kaban works fully without one, and your records stay on your device.",
  },
  {
    q: "Does Kaban connect to my bank?",
    a: "No. Kaban never asks for bank, card or e-wallet logins and can't move money. You record transactions yourself: pick the type, pick the account, enter the amount.",
  },
  {
    q: "What happens when I'm offline?",
    a: "Everything keeps working. Every screen and record is stored on your device, so you can add, edit and review transactions with no signal. Changes sync in the background once you're back online.",
  },
  ...(cloudConfigured
    ? [
        {
          q: "What can my family see?",
          a: "Only the accounts you choose to share, and only what you pick for each: the balance, or the balance with recent activity. They never see your other accounts, your notes or the people you track.",
        },
        {
          q: "Where is my data stored when I sync?",
          a: "In a private cloud space tied to your account. Access rules on the database only allow your account to read your records, and you can protect sign-in with an authenticator app. You can delete your cloud data at any time from Settings.",
        },
      ]
    : []),
  {
    q: "Can I export my data?",
    a: "Yes. Sync & backup exports a complete JSON backup you can keep anywhere and import again later. Imports merge by record, so nothing is duplicated.",
  },
  {
    q: "Who is the little chest?",
    a: "That's Kaban, our mascot. Kaban is Tagalog for coffer, as in kaban ng bayan. It lives on your Home screen, catches a coin when money comes in, and locks its lid when privacy mode hides your amounts.",
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
      "Personal finance tracking for cash, bank and e-wallet accounts",
      "Credit card billing cycles, utilisation and due dates",
      "Instalment and deferred purchase schedules",
      "Pay-later accounts such as Atome, SPayLater and LazPayLater",
      "Split expenses equally or by amount",
      "Who owes me and repayment tracking",
      "Payment due reminders",
      "Privacy mode that hides every amount",
      "Works offline",
      "Light and dark mode",
      ...(cloudConfigured
        ? ["Optional cloud sync across devices", "Two-factor sign-in", "Families with read-only shared accounts", "Quick add from iOS Shortcuts"]
        : []),
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  },
];

const SECURITY = [
  { icon: HardDrive, t: "Local-first by design", d: "Your device holds the working copy. The app never waits on the network to save or show a record." },
  { icon: Unplug, t: "No bank logins", d: "Kaban never asks for bank, card or e-wallet credentials and has no way to move your money." },
  ...(cloudConfigured
    ? [
        { icon: KeyRound, t: "Two-factor sign-in", d: "Protect your account with an authenticator app. Sync then requires the second factor too." },
        { icon: ShieldCheck, t: "Private by account", d: "Database access rules only let your account read your records. No one else's app can see them." },
        { icon: LogOut, t: "Separate ledgers", d: "Each signed-in account keeps its own records on the device, apart from your local-only ledger." },
      ]
    : []),
  { icon: Download, t: "Your data, portable", d: "Export a full backup at any time and import it on another device. No lock-in." },
];

/** One logo per institution for the strip (pay-later products that share a parent's logo appear once). */
const LOGOS = BANKS.filter((b, i, all) => b.logo && all.findIndex((x) => x.logo === b.logo) === i);

function SectionHead({ eyebrow, title, body, className, dark }: { eyebrow: string; title: string; body?: string; className?: string; dark?: boolean }) {
  return (
    <Reveal className={className ?? "max-w-2xl"}>
      <p className={dark ? "text-sm font-semibold tracking-wide text-mint uppercase" : "text-sm font-semibold tracking-wide text-brand-2 uppercase"}>{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-[2.6rem] sm:leading-[1.1]">{title}</h2>
      {body && <p className={dark ? "mt-4 text-lg text-pretty text-white/75" : "mt-4 text-lg text-pretty text-ink-2"}>{body}</p>}
    </Reveal>
  );
}

function Tile({ className, children, title, body, dark }: { className?: string; children?: React.ReactNode; title: string; body: string; dark?: boolean }) {
  return (
    <article
      className={`flex h-full flex-col overflow-hidden rounded-3xl p-6 sm:p-7 ${dark ? "card-grain bg-ink text-white" : "border border-line bg-white"} ${className ?? ""}`}
    >
      {children && <div className="mb-6 flex min-h-36 flex-1 items-center">{children}</div>}
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className={dark ? "mt-1.5 text-sm leading-relaxed text-white/70" : "mt-1.5 text-sm leading-relaxed text-ink-2"}>{body}</p>
    </article>
  );
}

/* ---------- Feature tile visuals (static, illustrative) ---------- */

function CardVisual() {
  return (
    <div className="grid w-full gap-3 sm:grid-cols-[1.1fr_1fr] sm:items-center">
      <div className="card-grain relative h-36 rounded-[1.4rem] bg-[linear-gradient(140deg,#1F2D27,#0f1915)] p-4 text-white shadow-float">
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/70">BPI Rewards</p>
          <img src="/banks/bpi.png" alt="" className="size-7 rounded-lg bg-white object-contain p-0.5" />
        </div>
        <p className="num mt-6 text-2xl font-semibold">₱18,440.00</p>
        <p className="text-[0.7rem] text-white/60">of ₱80,000 limit</p>
        <div className="absolute inset-x-4 bottom-4 h-1.5 overflow-hidden rounded-full bg-white/15">
          <div className="h-full w-[23%] rounded-full bg-mint" />
        </div>
      </div>
      <ul className="grid gap-2 text-sm">
        {[
          ["Statement", "Nov 28"],
          ["Payment due", "Dec 15"],
          ["Utilisation", "23%"],
          ["This cycle", "₱6,210.00"],
        ].map(([k, v]) => (
          <li key={k} className="flex items-center justify-between rounded-xl bg-bg px-3 py-2">
            <span className="text-ink-3">{k}</span>
            <span className="num font-semibold">{v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InstalmentVisual() {
  return (
    <div className="w-full rounded-2xl bg-bg p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium">Refrigerator · 6×</p>
        <p className="num text-sm font-semibold">₱4,000/mo</p>
      </div>
      <div className="mt-4 grid grid-cols-6 gap-1.5">
        {["Dec", "Jan", "Feb", "Mar", "Apr", "May"].map((m, i) => (
          <div key={m} className="text-center">
            <div className={`h-9 rounded-lg ${i < 2 ? "bg-brand-2" : i === 2 ? "bg-brand-2/30 ring-2 ring-brand-2" : "bg-line"}`} />
            <p className="mt-1 text-[0.65rem] text-ink-3">{m}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-3">Each portion lands on the right statement.</p>
    </div>
  );
}

function OwedVisual() {
  return (
    <ul className="grid w-full gap-2">
      {[
        { n: "Ana", c: "#2D936C", v: "₱2,000.00", s: "Groceries split" },
        { n: "Ben", c: "#C9A227", v: "₱1,500.00", s: "Paid ₱500 so far" },
        { n: "Mama", c: "#176B4D", v: "Settled", s: "Concert tickets" },
      ].map((p) => (
        <li key={p.n} className="flex items-center gap-3 rounded-2xl bg-bg p-2.5">
          <span className="grid size-9 place-items-center rounded-full text-sm font-semibold text-white" style={{ background: p.c }}>
            {p.n[0]}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{p.n}</p>
            <p className="truncate text-xs text-ink-3">{p.s}</p>
          </div>
          <p className={`num text-sm font-semibold ${p.v === "Settled" ? "text-brand-2" : ""}`}>{p.v}</p>
        </li>
      ))}
    </ul>
  );
}

function ChartVisual() {
  const bars = [62, 48, 74, 40, 86, 58];
  return (
    <div className="flex h-36 w-full items-end gap-2">
      {bars.map((h, i) => (
        <div key={i} className="flex h-full flex-1 flex-col justify-end gap-1">
          <div className="rounded-md bg-mint" style={{ height: `${h * 0.55}%` }} />
          <div className="rounded-md bg-brand-2" style={{ height: `${h * 0.45}%` }} />
        </div>
      ))}
    </div>
  );
}

function PrivacyVisual() {
  return (
    <div className="flex w-full items-center gap-4">
      <ChestArt locked effects={false} className="h-24 w-[6.4rem] shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-white/60">Available funds</p>
        <p className="num text-3xl font-semibold tracking-tight">₱•••••</p>
        <p className="mt-1 text-xs text-white/60">Even the number of digits is hidden.</p>
      </div>
    </div>
  );
}

function QuickAddVisual() {
  return (
    <div className="grid w-full gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
      <div className="rounded-2xl bg-[linear-gradient(135deg,#5B5BD6,#8E4EC6)] p-4 text-white shadow-float">
        <Zap className="size-5" />
        <p className="mt-6 text-sm font-semibold">Log a coffee</p>
        <p className="text-xs text-white/75">Shortcuts · ₱180</p>
      </div>
      <span className="hidden text-ink-3 sm:block">→</span>
      <div className="rounded-2xl bg-bg p-4">
        <p className="text-xs font-semibold tracking-wide text-brand-2 uppercase">Waiting for you</p>
        <p className="mt-2 text-sm font-medium">Coffee · GCash</p>
        <p className="num text-sm text-ink-2">−₱180.00</p>
        <div className="mt-3 flex gap-2 text-xs font-medium">
          <span className="rounded-lg bg-brand px-2.5 py-1 text-white">Approve</span>
          <span className="rounded-lg bg-line px-2.5 py-1 text-ink-2">Reject</span>
        </div>
      </div>
    </div>
  );
}

const SMALL = [
  { icon: WifiOff, t: "Works offline", d: "Every screen, every record, no signal needed." },
  { icon: Bell, t: "Due date reminders", d: "A heads-up before each card payment is due." },
  { icon: Moon, t: "Light and dark", d: "A soft charcoal theme, or follow your phone." },
  { icon: Download, t: "Export anytime", d: "A full backup you can keep and import again." },
];

export default function Landing() {
  return (
    <div className="theme-light overflow-x-clip bg-bg text-ink">
      <script
        type="application/ld+json"
        // JSON-LD must be raw; content is static and escaped against </script> injection.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c") }}
      />
      {/* Nav */}
      <header className="pt-safe sticky top-0 z-40 border-b border-line/70 bg-bg/85 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark size={32} />
            <span className="text-lg font-semibold tracking-tight">Kaban</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-ink-2 md:flex" aria-label="Sections">
            <a href="#features" className="hover:text-ink">Features</a>
            <a href="#kaban" className="hover:text-ink">Meet Kaban</a>
            {cloudConfigured && <a href="#families" className="hover:text-ink">Families</a>}
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
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[44rem] bg-[radial-gradient(60%_50%_at_70%_20%,rgb(45_147_108/0.18),transparent),radial-gradient(30%_30%_at_15%_80%,rgb(201_162_39/0.12),transparent)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-12 pb-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-20 lg:pb-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink-2">
              <span className="size-1.5 rounded-full bg-brand-2" />
              {cloudConfigured ? "New: families, quick add from Shortcuts, and a mascot" : "Free · Offline-first · Built for the Philippines"}
            </p>
            <h1 className="mt-6 text-[2.6rem] leading-[1.04] font-semibold tracking-tighter text-balance sm:text-6xl lg:text-[4.1rem]">
              Every peso, <span className="text-brand-2">accounted for.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-pretty text-ink-2">
              Kaban is a personal finance tracker built for the Philippines. Cash, banks, e-wallets, credit cards and pay-later plans in one place, with billing
              cycles, instalments, split bills and exactly who still owes you. And a little chest that cheers you on.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <OpenAppButton className="sm:min-w-56" />
              <HeroSecondary />
            </div>
            <ul className="mt-8 grid gap-x-6 gap-y-2 text-sm text-ink-2 sm:flex sm:flex-wrap">
              <li className="flex items-center gap-2"><Check className="size-4 text-brand-2" /> Free, no sign-up required</li>
              <li className="flex items-center gap-2"><Check className="size-4 text-brand-2" /> Works offline</li>
              <li className="flex items-center gap-2"><Check className="size-4 text-brand-2" /> Never asks for bank logins</li>
            </ul>
          </div>
          <HeroStage />
        </div>
      </section>

      {/* Supported institutions */}
      <section className="border-y border-line bg-white py-8">
        <p className="px-4 text-center text-sm text-ink-3">Set up accounts for the banks, e-wallets and pay-later services you already use</p>
        <div className="logo-marquee mt-5 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]">
          <ul className="logo-track flex w-max gap-3">
            {[...LOGOS, ...LOGOS].map((b, i) => (
              <li key={`${b.id}-${i}`} aria-hidden={i >= LOGOS.length} className="flex shrink-0 items-center gap-2.5 rounded-2xl border border-line bg-bg py-2 pr-4 pl-2">
                <img src={b.logo} alt="" width={32} height={32} className="size-8 rounded-lg bg-white object-contain" />
                <span className="text-sm font-semibold tracking-tight text-ink-2">{b.short}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHead
            eyebrow="Features"
            title="Everything your money needs. Nothing it doesn't."
            body="Built around how money actually moves in the Philippines: credit cards with billing cycles, purchases on instalment, e-wallets, and money lent to friends."
          />
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            <Reveal className="lg:col-span-2">
              <Tile title="Credit cards, the way banks bill them" body="Outstanding balance, available limit, utilisation, statement and due dates for every card you carry.">
                <CardVisual />
              </Tile>
            </Reveal>
            <Reveal delay={0.06}>
              <Tile title="Instalments and pay-later" body="Bill a purchase normally, defer it, or spread it over 3–36 months. Atome, SPayLater and LazPayLater work the same way.">
                <InstalmentVisual />
              </Tile>
            </Reveal>
            <Reveal>
              <Tile title="Split bills, see who owes you" body="Split a charge equally or by amount. Each share becomes a balance you can settle in full or in parts.">
                <OwedVisual />
              </Tile>
            </Reveal>
            <Reveal delay={0.06}>
              <Tile title="Clear analytics" body="Income against expenses, spending by category and card utilisation over time, with a table for exact figures.">
                <ChartVisual />
              </Tile>
            </Reveal>
            <Reveal delay={0.12}>
              <Tile dark title="Privacy mode" body="One tap masks every amount on screen, so you can open Kaban in public. Kaban locks its lid too.">
                <PrivacyVisual />
              </Tile>
            </Reveal>
            {cloudConfigured && (
              <Reveal className="lg:col-span-2">
                <Tile title="Quick add from Shortcuts" body="Log a purchase from iOS Shortcuts or an automation without opening the app. Nothing lands in your records until you approve it.">
                  <QuickAddVisual />
                </Tile>
              </Reveal>
            )}
            <Reveal delay={0.06} className={cloudConfigured ? "" : "lg:col-span-3"}>
              <div className={`grid h-full gap-px overflow-hidden rounded-3xl border border-line bg-line ${cloudConfigured ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4"}`}>
                {SMALL.map(({ icon: Icon, t, d }) => (
                  <div key={t} className="bg-white p-5">
                    <Icon className="size-5 text-brand" />
                    <p className="mt-3 text-sm font-semibold">{t}</p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-3">{d}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Meet Kaban */}
      <section id="kaban" className="relative scroll-mt-20 overflow-hidden bg-brand-deep py-20 text-white sm:py-28">
        <div className="pointer-events-none absolute -top-40 -right-40 size-[36rem] rounded-full bg-brand-2/25 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl gap-14 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="text-center lg:text-left">
            <SectionHead
              dark
              className="mx-auto max-w-xl lg:mx-0"
              eyebrow="Meet Kaban"
              title="Your money has a guardian now."
              body="Kaban is Tagalog for coffer, as in kaban ng bayan. Our chest lives on your Home screen, keeps an eye on your balance and reacts to every peso that comes and goes. No mouth, all feelings: you'll see its eyes when it lifts the lid."
            />
            <Reveal className="mt-10">
              <MascotHero />
            </Reveal>
          </div>
          <MascotGallery />
        </div>
      </section>

      {/* Families */}
      {cloudConfigured && (
        <section id="families" className="scroll-mt-20 py-20 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
            <div>
              <SectionHead
                className="max-w-xl"
                eyebrow="Families"
                title="Share what you choose. Keep the rest yours."
                body="Create a family, invite people with a QR code, and share selected accounts with them. They see a read-only view; your ledger stays on your device."
              />
              <Reveal>
                <ul className="mt-8 grid gap-4 text-sm">
                  {[
                    { icon: QrCode, t: "Invite with a QR code or link", d: "No email needed. Every join request waits for an admin to approve it." },
                    { icon: EyeOff, t: "Balance only, or with activity", d: "Pick per account what the family sees. Notes and people are never shared." },
                    { icon: UserCheck, t: "Members can add, you approve", d: "Let family log entries to a shared account. Each one arrives for you to keep or reject." },
                  ].map(({ icon: Icon, t, d }) => (
                    <li key={t} className="flex gap-4">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-pale text-brand">
                        <Icon className="size-5" />
                      </span>
                      <div>
                        <p className="font-semibold">{t}</p>
                        <p className="mt-0.5 text-ink-2">{d}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
            <Reveal delay={0.1}>
              <div className="relative mx-auto max-w-md">
                <div className="rounded-[2rem] border border-line bg-white p-5 shadow-float">
                  <div className="flex items-center gap-3">
                    <span className="grid size-12 place-items-center rounded-2xl bg-pale text-2xl">🏠</span>
                    <div className="flex-1">
                      <p className="font-semibold">Dela Cruz family</p>
                      <p className="text-sm text-ink-3">4 members</p>
                    </div>
                    <div className="flex -space-x-2">
                      {["#2D936C", "#C9A227", "#176B4D", "#E56B6F"].map((c, i) => (
                        <span key={c} className="grid size-8 place-items-center rounded-full text-xs font-semibold text-white ring-2 ring-white" style={{ background: c }}>
                          {"MJAL"[i]}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="card-grain mt-5 rounded-[1.4rem] bg-[linear-gradient(140deg,#2D936C,#176B4D)] p-4 text-white">
                    <div className="flex items-center justify-between text-xs text-white/75">
                      <span>Household wallet · shared by Mama</span>
                      <span className="rounded-full bg-white/15 px-2 py-0.5">Read-only</span>
                    </div>
                    <p className="num mt-6 text-2xl font-semibold">₱12,400.00</p>
                  </div>
                  <ul className="mt-4 grid gap-2 text-sm">
                    {[
                      ["Rice and groceries", "Added by Jun", "−₱1,850.00"],
                      ["Water bill", "Mama", "−₱640.00"],
                    ].map(([a, b, c]) => (
                      <li key={a} className="flex items-center justify-between rounded-2xl bg-bg px-3 py-2.5">
                        <div>
                          <p className="font-medium">{a}</p>
                          <p className="text-xs text-ink-3">{b}</p>
                        </div>
                        <p className="num font-semibold">{c}</p>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="absolute -right-2 -bottom-6 rounded-2xl bg-ink p-3 text-white shadow-float sm:-right-8">
                  <p className="text-xs text-white/60">Join request</p>
                  <p className="text-sm font-semibold">Lola wants to join</p>
                  <div className="mt-2 flex gap-1.5 text-xs font-medium">
                    <span className="rounded-lg bg-mint px-2 py-0.5 text-brand-deep">Approve</span>
                    <span className="rounded-lg bg-white/10 px-2 py-0.5">Decline</span>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* How it adds up */}
      <section id="how" className="scroll-mt-20 border-t border-line bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHead
            eyebrow="How it works"
            title="One ₱6,000 grocery run, split three ways."
            body="You pay with your credit card and split it with two housemates, Ana and Ben. Here is what Kaban records, and what it deliberately doesn't."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { k: "Card outstanding", v: "+₱6,000", d: "The whole charge stays on the card. The bank doesn't care who ate what.", dark: true },
              { k: "Owed to you", v: "+₱4,000", d: "₱2,000 each from Ana and Ben, tracked under People." },
              { k: "Ana pays ₱500", v: "−₱500", d: "Her balance drops and your wallet goes up. It isn't counted as income." },
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
            <Reveal>
              <p className="mt-6 text-sm text-ink-2">
                Read exactly what we store and why in our <Link href="/privacy" className="font-medium text-brand hover:underline">Privacy Policy</Link>.
              </p>
            </Reveal>
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
              { icon: Smartphone, t: "Open it from your Home Screen", d: "It runs full screen, works offline, and follows your light or dark setting." },
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
          <CtaMascot />
          <h2 className="mx-auto mt-6 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl">Know where every peso went, and what&apos;s due next.</h2>
          <p className="mx-auto mt-4 max-w-xl text-white/70">Start in seconds with your own numbers. No sign-up required.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <OpenAppButton variant="light" />
            {cloudConfigured && (
              <HapticLink href="/signup" className="inline-flex min-h-12 items-center justify-center rounded-2xl px-5 font-medium text-white/80 ring-1 ring-white/20 hover:bg-white/10 hover:text-white">
                Create an account
              </HapticLink>
            )}
          </div>
        </Reveal>
      </section>

      <InstallSheet />

      <footer className="border-t border-line bg-white pt-12 pb-[calc(2.5rem+var(--safe-bottom))]">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2.5">
              <LogoMark size={28} />
              <span className="font-semibold tracking-tight">Kaban</span>
            </Link>
            <p className="mt-3 max-w-sm text-sm text-ink-3">
              <i>Kaban</i> is Tagalog for coffer, as in <i>kaban ng bayan</i>. A free, offline-first personal finance tracker.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold">Product</p>
            <ul className="mt-3 grid gap-2 text-sm text-ink-2">
              <li><a href="#features" className="hover:text-ink">Features</a></li>
              <li><a href="#kaban" className="hover:text-ink">Meet Kaban</a></li>
              {cloudConfigured && <li><a href="#families" className="hover:text-ink">Families</a></li>}
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
          <div>
            <p className="text-sm font-semibold">Legal</p>
            <ul className="mt-3 grid gap-2 text-sm text-ink-2">
              <li><Link href="/terms" className="hover:text-ink">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-ink">Privacy Policy</Link></li>
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
