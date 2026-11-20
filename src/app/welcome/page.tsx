"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronLeft, LogIn, ShieldAlert, UserPlus } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { HapticButton } from "@/components/haptic-button";
import { Button, cx } from "@/components/ui";
import { CLOUD_BENEFITS } from "@/components/cloud-benefits";
import { LogoMark } from "@/lib/logo";
import { isActiveDatabase, useLedgerDatabase } from "@/lib/db";
import { acceptAgreement } from "@/lib/legal";
import { setMeta } from "@/lib/repo";
import { cloudConfigured } from "@/lib/supabase";

type Step = "intro" | "account" | "local";


export default function WelcomePage() {
  const [step, setStep] = useState<Step>("intro");
  const [dir, setDir] = useState(1);

  function go(next: Step, d = 1) {
    setDir(d);
    setStep(next);
  }

  return (
    // Exactly one screen tall, no scrolling: each step flexes to fill whatever height is left.
    <div className="pt-safe relative flex h-dvh flex-col overflow-hidden px-5 pb-[max(var(--safe-bottom),1rem)]">
      <AnimatePresence mode="wait" initial={false} custom={dir}>
        <motion.div
          key={step}
          custom={dir}
          className="flex min-h-0 flex-1 flex-col"
          initial={{ opacity: 0, x: 24 * dir }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 * dir }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {step === "intro" && <Intro onContinue={() => go(cloudConfigured ? "account" : "local")} />}
          {step === "account" && <AccountChoice onBack={() => go("intro", -1)} onSkip={() => go("local")} />}
          {step === "local" && <LocalConsent onBack={() => go(cloudConfigured ? "account" : "intro", -1)} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <HapticButton
      type="button"
      onClick={onClick}
      wrapperClassName="-ml-2 mt-2 self-start"
      className="grid size-11 place-items-center rounded-full active:bg-pale lg:hover:bg-pale"
      aria-label="Back"
    >
      <ChevronLeft className="size-6" />
    </HapticButton>
  );
}

function StepDots({ active, total }: { active: number; total: number }) {
  return (
    <div className="flex justify-center gap-1.5" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cx("h-1.5 rounded-full transition-all", i === active ? "w-5 bg-brand" : "w-1.5 bg-line")} />
      ))}
    </div>
  );
}

/* ---------- Step 1: welcome ---------- */

function Intro({ onContinue }: { onContinue: () => void }) {
  return (
    <>
      {/* Floating stacked cards hero */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <div className="relative h-[13rem] w-full max-w-xs origin-center [@media(max-height:740px)]:scale-[0.82] [@media(max-height:640px)]:scale-[0.66]">
          {[
            { c: "#1F2D27", r: -8, y: 0, label: "Credit Card", v: "₱18,440" },
            { c: "#176B4D", r: 4, y: 44, label: "Savings", v: "₱68,250" },
            { c: "#2D936C", r: -2, y: 88, label: "Wallet", v: "₱4,500" },
          ].map((k, i) => (
            <motion.div
              key={k.label}
              className="account-card-tinted absolute inset-x-4 h-28 rounded-[1.6rem] border border-line bg-surface p-4 shadow-soft"
              style={{ "--account-color": k.c, top: k.y } as CSSProperties}
              initial={{ opacity: 0, y: 40, rotate: 0 }}
              animate={{ opacity: 1, y: 0, rotate: k.r }}
              transition={{ delay: 0.1 + i * 0.12, type: "spring", stiffness: 180, damping: 18 }}
            >
              <p className="text-xs text-ink-2">{k.label}</p>
              <p className="num mt-1 text-2xl font-semibold">{k.v}</p>
            </motion.div>
          ))}
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="shrink-0">
        <div className="flex items-center gap-2">
          <LogoMark size={28} />
          <span className="font-semibold tracking-tight">Kaban</span>
        </div>
        <h1 className="mt-2.5 text-[2rem] leading-[1.05] font-semibold tracking-tight [@media(max-height:640px)]:text-[1.7rem]">
          Every peso, accounted for.
        </h1>
        <p className="mt-2 text-[0.95rem] text-ink-2">Track cash, bank and e-wallet accounts, credit cards and who owes you. Works fully offline.</p>
      </motion.div>

      <div className="mt-6 shrink-0 space-y-4">
        <Button wrapperClassName="w-full" onClick={onContinue}>
          Continue <ArrowRight className="size-4" />
        </Button>
        <StepDots active={0} total={cloudConfigured ? 3 : 2} />
      </div>
    </>
  );
}

/* ---------- Step 2: create an account, sign in, or skip ---------- */

function AccountChoice({ onBack, onSkip }: { onBack: () => void; onSkip: () => void }) {
  const router = useRouter();
  return (
    <>
      <BackButton onClick={onBack} />
      <div className="mt-4 min-h-0 flex-1">
        <span className="grid size-12 place-items-center rounded-2xl bg-pale text-brand">
          <UserPlus className="size-6" />
        </span>
        <h1 className="mt-5 text-[1.9rem] leading-tight font-semibold tracking-tight">Keep your records safe</h1>
        <p className="mt-1.5 text-[0.95rem] text-ink-2">A free account is optional, but it means you never lose your data.</p>

        <ul className="mt-6 space-y-4 [@media(max-height:640px)]:mt-4 [@media(max-height:640px)]:space-y-3">
          {CLOUD_BENEFITS.map(({ icon: Icon, t, d }, i) => (
            <motion.li
              key={t}
              className="flex gap-3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + i * 0.07 }}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface text-brand ring-1 ring-line">
                <Icon className="size-4.5" />
              </span>
              <div>
                <p className="font-medium">{t}</p>
                <p className="text-sm text-ink-3 [@media(max-height:640px)]:hidden">{d}</p>
              </div>
            </motion.li>
          ))}
        </ul>
      </div>

      <div className="mt-5 shrink-0 space-y-2.5">
        <Button wrapperClassName="w-full" onClick={() => router.push("/signup")}>
          <UserPlus className="size-4" /> Create an account
        </Button>
        <Button variant="secondary" wrapperClassName="w-full" onClick={() => router.push("/login")}>
          <LogIn className="size-4" /> I have an account
        </Button>
        <Button variant="ghost" wrapperClassName="w-full" className="min-h-10 text-sm" onClick={onSkip}>
          Skip for now
        </Button>
        <StepDots active={1} total={3} />
      </div>
    </>
  );
}

/* ---------- Step 3: local-only notice + terms ---------- */

function LocalConsent({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const db = useLedgerDatabase();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function start() {
    if (!db || !agreed) return;
    setBusy(true);
    const now = Date.now();
    await acceptAgreement(db, now);
    await setMeta("mode", "local", db);
    await setMeta("startedAt", now, db);
    if (!isActiveDatabase(db)) return;
    router.replace("/ready");
  }

  return (
    <>
      <BackButton onClick={onBack} />
      <div className="mt-4 min-h-0 flex-1">
        <span className="grid size-12 place-items-center rounded-2xl bg-gold/15 text-gold">
          <ShieldAlert className="size-6" />
        </span>
        <h1 className="mt-5 text-[1.9rem] leading-tight font-semibold tracking-tight">Your data stays on this device</h1>
        <p className="mt-1.5 text-[0.95rem] text-ink-2">Without an account, Kaban keeps everything in this browser only.</p>

        <div className="mt-6 space-y-3 rounded-2xl bg-gold/10 p-4 text-sm text-ink-2">
          <p>
            <b className="text-ink">Clearing Safari data or losing the phone erases it.</b> Export backups regularly from Sync & Backup.
          </p>
          {cloudConfigured && <p>You can create an account later from Settings, and your records will be added to it.</p>}
        </div>
      </div>

      <div className="mt-5 shrink-0 space-y-3">
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface p-3.5 text-sm text-ink-2">
          <span className="relative mt-0.5 grid size-5 shrink-0 place-items-center">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="peer size-5 appearance-none rounded-md border-2 border-line bg-field checked:border-brand checked:bg-brand"
            />
            <Check className="pointer-events-none absolute size-3.5 text-on-brand opacity-0 peer-checked:opacity-100" strokeWidth={3} />
          </span>
          <span>
            I agree to the{" "}
            <Link href="/terms" className="font-medium text-brand underline-offset-2 hover:underline">Terms of Service</Link> and{" "}
            <Link href="/privacy" className="font-medium text-brand underline-offset-2 hover:underline">Privacy Policy</Link>. I&apos;m 13 or older, and if
            I&apos;m under 18, my parent or guardian agrees too.
          </span>
        </label>
        <Button wrapperClassName="w-full" onClick={start} disabled={!agreed || busy || !db}>
          Continue <ArrowRight className="size-4" />
        </Button>
        <StepDots active={cloudConfigured ? 2 : 1} total={cloudConfigured ? 3 : 2} />
      </div>
    </>
  );
}
