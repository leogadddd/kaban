"use client";

import { HapticButton, HapticLink } from "@/components/haptic-button";
import { AnimatePresence, motion, useInView } from "motion/react";
import { ArrowRight, CloudCheck, CreditCard, SquarePlus } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMeta } from "@/lib/hooks";
import { ChestArt } from "./chest-art";
import { InstallButton, requestInstall, shouldInstallFirst, useInstall } from "./install";
import { Mascot, type MascotAction } from "./mascot";
import { cx } from "./ui";

/**
 * Primary CTA. Desktop or already-installed: opens the app ("Get started" / "Open Kaban").
 * Phones that haven't installed yet: goes straight into saving Kaban to the Home Screen.
 */
export function OpenAppButton({ className, children, variant = "primary" }: { className?: string; children?: ReactNode; variant?: "primary" | "light" }) {
  const mode = useMeta<string>("mode");
  const install = useInstall();
  const started = typeof mode === "string";
  const installFirst = shouldInstallFirst(install);
  const cls = cx(
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 font-medium transition active:scale-[0.98]",
    variant === "primary" ? "bg-brand text-white shadow-float hover:bg-brand-deep" : "bg-white text-brand hover:bg-pale",
    className,
  );
  if (installFirst)
    return (
      <HapticButton type="button" onClick={() => requestInstall()} className={cls}>
        {children ?? "Get the app"}
        <SquarePlus className="size-4" />
      </HapticButton>
    );
  return (
    <HapticLink href={started ? "/home" : "/welcome"} className={cls}>
      {children ?? (started ? "Open Kaban" : "Get started — it's free")}
      <ArrowRight className="size-4" />
    </HapticLink>
  );
}

/** Hero secondary action: on phones (where the main button installs) offer the browser; elsewhere offer installing. */
export function HeroSecondary() {
  const mode = useMeta<string>("mode");
  const install = useInstall();
  if (shouldInstallFirst(install))
    return (
      <HapticLink href={typeof mode === "string" ? "/home" : "/welcome"} className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-line bg-white px-5 font-medium text-ink hover:bg-pale">
        Use in browser instead
      </HapticLink>
    );
  return <InstallButton variant="outline" />;
}

/** Reveal-on-scroll wrapper. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.6, delay, ease: [0.2, 0.8, 0.2, 1] }}>
      {children}
    </motion.div>
  );
}

const peso = (minor: number) => {
  const v = Math.abs(minor) / 100;
  return `₱${Math.floor(v).toLocaleString("en-PH")}`;
};

/** What happens in the hero, on a loop: the balance moves and Kaban reacts like it does in the app. Deltas sum to zero. */
const EVENTS: { action: MascotAction; title: string; detail: string; amount: string; delta: number; tone: "in" | "out" | "win" }[] = [
  { action: "coin-in", title: "Salary arrived", detail: "BDO Savings", amount: "+₱32,000.00", delta: 3_200_000, tone: "in" },
  { action: "coin-out", title: "Meralco bill", detail: "Paid from GCash", amount: "−₱3,480.00", delta: -348_000, tone: "out" },
  { action: "coin-in", title: "Mama paid you back", detail: "Who Owes Me", amount: "+₱500.00", delta: 50_000, tone: "in" },
  { action: "celebrate", title: "BPI card paid in full", detail: "From BDO Savings · nothing left due", amount: "−₱29,020.00", delta: -2_902_000, tone: "win" },
  // On the credit card, so available funds don't move; two thirds of it is owed back.
  { action: "coin-out", title: "S&R groceries", detail: "BPI card · split 3 ways", amount: "−₱6,000.00", delta: 0, tone: "out" },
];

/** Phone mock with the dashboard, and the mascot beside it reacting to each new entry. Illustrative only. */
export function HeroStage() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-80px" });
  const [step, setStep] = useState(-1);
  const [balance, setBalance] = useState(11_474_600);
  const [act, setAct] = useState<{ action: MascotAction; key: number }>({ action: "peek", key: 0 });

  useEffect(() => {
    if (!inView) return;
    const t = setTimeout(() => {
      const next = (step + 1) % EVENTS.length;
      const e = EVENTS[next];
      setStep(next);
      setBalance((b) => b + e.delta);
      setAct((a) => ({ action: e.action, key: a.key + 1 }));
    }, step < 0 ? 1600 : 4200);
    return () => clearTimeout(t);
  }, [inView, step]);

  const event = step >= 0 ? EVENTS[step] : null;
  const cents = String(balance % 100).padStart(2, "0");

  return (
    <div ref={ref} className="relative mx-auto h-[36rem] w-full max-w-[28rem]" aria-hidden="true">
      <div className="absolute inset-x-8 top-6 -z-10 h-[28rem] rounded-full bg-brand-2/25 blur-3xl" />
      <motion.div
        className="absolute top-0 right-4 bottom-10 left-16 overflow-hidden rounded-[2.6rem] border-[10px] border-ink bg-bg shadow-float sm:left-20"
        initial={{ opacity: 0, y: 40, rotate: 2 }}
        animate={{ opacity: 1, y: 0, rotate: 2 }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
      >
        <div className="mx-auto mt-2 h-5 w-24 rounded-full bg-ink" />
        <div className="px-4 pt-4">
          <p className="text-[0.6rem] text-ink-3">Available funds · cash & debit</p>
          <motion.p key={balance} initial={{ y: 6, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} className="num text-3xl font-semibold tracking-tighter">
            {peso(balance)}
            <span className="text-lg opacity-50">.{cents}</span>
          </motion.p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-ink p-2.5 text-white">
              <p className="text-[0.55rem] text-white/60">Credit outstanding</p>
              <p className="num text-sm font-semibold">₱47,940.50</p>
            </div>
            <div className="rounded-2xl bg-brand-2 p-2.5 text-white">
              <p className="text-[0.55rem] text-white/75">Owed to me</p>
              <p className="num text-sm font-semibold">₱4,000.00</p>
            </div>
          </div>
          <div className="relative mt-4 h-[11.5rem]">
            {[
              { c: "#1F2D27", t: 0, s: 0.9, l: "BPI Credit Card", v: "₱47,940.50" },
              { c: "#176B4D", t: 22, s: 0.95, l: "BDO Savings", v: "₱139,851.00" },
              { c: "#2D936C", t: 44, s: 1, l: "GCash", v: "₱6,895.00" },
            ].map((k, i) => (
              <motion.div
                key={k.l}
                className="card-grain absolute inset-x-0 h-32 rounded-[1.4rem] p-3.5 text-white shadow-float"
                style={{ background: `linear-gradient(140deg, ${k.c}, color-mix(in oklab, ${k.c} 70%, black))`, top: k.t, scale: k.s }}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.12, type: "spring", stiffness: 160, damping: 18 }}
              >
                <p className="text-[0.6rem] text-white/70">{k.l}</p>
                <p className="num mt-8 text-xl font-semibold">{k.v}</p>
              </motion.div>
            ))}
          </div>
          <div className="relative h-24 overflow-hidden">
            <AnimatePresence initial={false}>
              {event && (
                <motion.div
                  key={step}
                  className="absolute inset-x-0 top-0 flex items-center justify-between rounded-2xl bg-white p-2.5 shadow-soft"
                  initial={{ opacity: 0, y: -16, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 30 }}
                  transition={{ type: "spring", stiffness: 260, damping: 24 }}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[0.7rem] font-medium">{event.title}</p>
                    <p className="truncate text-[0.55rem] text-ink-3">{event.detail}</p>
                  </div>
                  <p className={cx("num shrink-0 pl-2 text-[0.7rem] font-semibold", event.tone === "in" ? "text-income" : event.tone === "win" ? "text-brand-2" : "")}>{event.amount}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Kaban, the mascot, reacting to each entry */}
      <motion.div
        className="absolute bottom-0 -left-1 w-36 sm:-left-4 sm:w-44"
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 140, damping: 16 }}
      >
        <AnimatePresence mode="popLayout">
          {event && (
            <motion.div
              key={step}
              className={cx(
                "absolute bottom-3 left-[82%] z-10 rounded-2xl rounded-bl-md px-3 py-2 text-xs font-semibold whitespace-nowrap shadow-float",
                event.tone === "out" ? "bg-ink text-white" : "bg-white text-ink",
              )}
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
            >
              <span className={cx("num", event.tone === "in" ? "text-income" : event.tone === "out" ? "text-mint" : "text-brand-2")}>{event.amount}</span>{" "}
              <span className={event.tone === "out" ? "text-white/70" : "text-ink-2"}>{event.tone === "in" ? "in the chest" : event.tone === "out" ? "spent" : "Nice!"}</span>
            </motion.div>
          )}
        </AnimatePresence>
        <Mascot action={act.action} playKey={act.key} onDone={() => setAct((a) => ({ action: "idle", key: a.key }))} className="block h-auto w-full" />
      </motion.div>

      <motion.div className="absolute top-[13rem] -right-1 rounded-2xl bg-white p-3 shadow-float sm:-right-6" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 }}>
        <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-pale text-brand"><CreditCard className="size-4" /></span>
          <div>
            <p className="text-[0.65rem] text-ink-3">Next due · Dec 5</p>
            <p className="num text-sm font-semibold">₱7,250.00</p>
          </div>
        </motion.div>
      </motion.div>

      <motion.div className="absolute top-3 right-10 rounded-2xl bg-white p-2.5 shadow-float" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1 }}>
        <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 6, delay: 2, repeat: Infinity, ease: "easeInOut" }} className="flex items-center gap-2">
          <CloudCheck className="size-4 text-brand-2" />
          <p className="text-[0.7rem] font-medium">Synced just now</p>
        </motion.div>
      </motion.div>
    </div>
  );
}

/** Kaban's reactions, as they appear in the app. Each one plays when it scrolls in, and again on tap. */
const MOODS: { action: MascotAction; name: string; when: string }[] = [
  { action: "peek", name: "Peek", when: "Says hello every time you open Kaban." },
  { action: "coin-in", name: "Coin in", when: "Catches the coin when your balance goes up." },
  { action: "coin-out", name: "Coin out", when: "Lets one go when you spend." },
  { action: "celebrate", name: "Celebrate", when: "Tap it on Home. It's always happy to see you." },
  { action: "locked", name: "Locked", when: "Privacy mode is on: every amount is hidden." },
  { action: "nope", name: "Nope", when: "Tap while it's locked. No peeking." },
];

function MoodCard({ action, name, when, index }: (typeof MOODS)[number] & { index: number }) {
  const ref = useRef<HTMLButtonElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [key, setKey] = useState(0);
  return (
    <Reveal delay={(index % 3) * 0.06}>
      <button
        ref={ref}
        type="button"
        onClick={() => setKey((k) => k + 1)}
        onMouseEnter={() => setKey((k) => k + 1)}
        className="group flex h-full w-full flex-col items-center rounded-3xl bg-white/6 p-5 text-center ring-1 ring-white/10 transition hover:bg-white/10"
        aria-label={`Play ${name}`}
      >
        <div className="grid h-28 w-full place-items-center">
          {inView ? <Mascot action={action} playKey={key} className="h-24 w-[6.4rem]" /> : <ChestArt effects={false} className="h-24 w-[6.4rem]" />}
        </div>
        <p className="mt-3 font-semibold text-white">{name}</p>
        <p className="mt-1 text-sm text-white/65">{when}</p>
      </button>
    </Reveal>
  );
}

export function MascotGallery() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
      {MOODS.map((m, i) => (
        <MoodCard key={m.action} {...m} index={i} />
      ))}
    </div>
  );
}

/** The big mascot in the "Meet Kaban" intro: tap to celebrate. */
export function MascotHero() {
  const [act, setAct] = useState<{ action: MascotAction; key: number }>({ action: "idle", key: 0 });
  return (
    <button
      type="button"
      aria-label="Make Kaban celebrate"
      onClick={() => setAct((a) => ({ action: "celebrate", key: a.key + 1 }))}
      className="relative mx-auto block w-56 touch-manipulation outline-none sm:w-72 [-webkit-tap-highlight-color:transparent]"
    >
      <span className="absolute inset-6 -z-10 rounded-full bg-gold/25 blur-3xl" />
      <Mascot action={act.action} playKey={act.key} onDone={() => setAct((a) => ({ action: "idle", key: a.key }))} className="block h-auto w-full" />
      <span className="mt-4 inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80 ring-1 ring-white/15">Tap me</span>
    </button>
  );
}

/** Small sleeping/celebrating mascot for the closing call to action. */
export function CtaMascot() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const [key, setKey] = useState(0);
  return (
    <div ref={ref} className="mx-auto w-28 sm:w-32" onMouseEnter={() => setKey((k) => k + 1)}>
      {inView ? <Mascot action={key ? "celebrate" : "hop"} playKey={key} className="block h-auto w-full" /> : <ChestArt effects={false} className="block h-auto w-full" />}
    </div>
  );
}
