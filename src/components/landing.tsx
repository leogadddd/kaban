"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { ArrowRight, CreditCard, HandCoins, SquarePlus, TrendingDown } from "lucide-react";
import type { ReactNode } from "react";
import { useMeta } from "@/lib/hooks";
import { InstallButton, requestInstall, shouldInstallFirst, useInstall } from "./install";
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
      <button type="button" onClick={() => requestInstall()} className={cls}>
        {children ?? "Get the app"}
        <SquarePlus className="size-4" />
      </button>
    );
  return (
    <Link href={started ? "/home" : "/welcome"} className={cls}>
      {children ?? (started ? "Open Kaban" : "Get started — it's free")}
      <ArrowRight className="size-4" />
    </Link>
  );
}

const float = (delay: number, y = 10) => ({
  animate: { y: [0, -y, 0] },
  transition: { duration: 6, repeat: Infinity, ease: "easeInOut" as const, delay },
});

/** Phone mock with the stacked-card dashboard, plus floating detail tiles. Illustrative only. */
export function HeroVisual() {
  return (
    <div className="relative mx-auto h-[34rem] w-full max-w-[26rem]" aria-hidden="true">
      <div className="absolute inset-x-8 top-6 -z-10 h-[28rem] rounded-full bg-brand-2/25 blur-3xl" />
      <motion.div
        className="absolute inset-x-10 top-0 bottom-4 overflow-hidden rounded-[2.6rem] border-[10px] border-ink bg-bg shadow-float"
        initial={{ opacity: 0, y: 40, rotate: -2 }}
        animate={{ opacity: 1, y: 0, rotate: -2 }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
      >
        <div className="mx-auto mt-2 h-5 w-24 rounded-full bg-ink" />
        <div className="px-4 pt-4">
          <p className="text-[0.6rem] text-ink-3">Available funds · cash & debit</p>
          <p className="num text-3xl font-semibold tracking-tighter">
            ₱146,746<span className="text-lg opacity-50">.00</span>
          </p>
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
              { c: "#1F2D27", t: 0, s: 0.9, l: "Family Card", v: "₱47,940.50" },
              { c: "#176B4D", t: 22, s: 0.95, l: "Savings", v: "₱139,851.00" },
              { c: "#2D936C", t: 44, s: 1, l: "Wallet", v: "₱6,895.00" },
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
          <div className="space-y-2">
            {[
              ["S&R groceries", "Split 3 ways", "−₱6,000.00"],
              ["Refrigerator", "6× instalment", "−₱24,000.00"],
            ].map(([a, b, c]) => (
              <div key={a} className="flex items-center justify-between rounded-2xl bg-white p-2.5 shadow-soft">
                <div>
                  <p className="text-[0.7rem] font-medium">{a}</p>
                  <p className="text-[0.55rem] text-ink-3">{b}</p>
                </div>
                <p className="num text-[0.7rem] font-semibold">{c}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      <motion.div className="absolute top-[15.5rem] -left-2 hidden rounded-2xl sm:block bg-white p-3 shadow-float sm:-left-8" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 }}>
        <motion.div {...float(0)} className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-pale text-brand"><CreditCard className="size-4" /></span>
          <div>
            <p className="text-[0.65rem] text-ink-3">Next due · Dec 5</p>
            <p className="num text-sm font-semibold">₱7,250.00</p>
          </div>
        </motion.div>
      </motion.div>

      <motion.div className="absolute right-0 bottom-2 rounded-2xl bg-ink p-3 text-white shadow-float sm:-right-6" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.85 }}>
        <motion.div {...float(1.2, 8)} className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-white/10 text-mint"><HandCoins className="size-4" /></span>
          <div>
            <p className="text-[0.65rem] text-white/60">Mama paid back</p>
            <p className="num text-sm font-semibold text-mint">+₱500.00</p>
          </div>
        </motion.div>
      </motion.div>

      <motion.div className="absolute right-6 top-2 rounded-2xl bg-white p-2.5 shadow-float" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1 }}>
        <motion.div {...float(2.1, 6)} className="flex items-center gap-2">
          <TrendingDown className="size-4 text-brand-2" />
          <p className="text-[0.7rem] font-medium">40% utilised</p>
        </motion.div>
      </motion.div>
    </div>
  );
}

/** Reveal-on-scroll wrapper. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.6, delay, ease: [0.2, 0.8, 0.2, 1] }}>
      {children}
    </motion.div>
  );
}

/** Hero secondary action: on phones (where the main button installs) offer the browser; elsewhere offer installing. */
export function HeroSecondary() {
  const mode = useMeta<string>("mode");
  const install = useInstall();
  if (shouldInstallFirst(install))
    return (
      <Link href={typeof mode === "string" ? "/home" : "/welcome"} className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-line bg-white px-5 font-medium text-ink hover:bg-pale">
        Use in browser instead
      </Link>
    );
  return <InstallButton variant="outline" />;
}
