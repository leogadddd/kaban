"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { Check, FileText, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { useLedgerDatabase } from "@/lib/db";
import { acceptAgreement, agreedBefore, applySignupAgreement, isCurrent, LEGAL_UPDATED, useAgreement } from "@/lib/legal";
import { useSyncState } from "@/lib/sync";
import { Mascot } from "./mascot";
import { Button, cx } from "./ui";

/**
 * Blocks the app until this ledger has agreed to the current Terms and Privacy Policy. Existing users
 * (who agreed to an earlier version, or never saw the checkbox) are asked on their next open.
 * Signed in: waits for the first sync, which pulls an acceptance made on another device.
 */
export function AgreementGate() {
  const db = useLedgerDatabase();
  const agreement = useAgreement();
  const { userId, phase, lastSyncedAt } = useSyncState();
  const [returning, setReturning] = useState<boolean>();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);

  const missing = agreement !== null && !isCurrent(agreement);
  // A signed-in device asks only after it has heard from the server (or can't reach it).
  const settled = !userId || lastSyncedAt !== undefined || phase === "offline" || phase === "error" || phase === "full";

  useEffect(() => {
    if (!db || !missing) return;
    let live = true;
    void (async () => {
      if (await applySignupAgreement(db)) return;
      const before = await agreedBefore(db);
      if (live) setReturning(before);
    })();
    return () => {
      live = false;
    };
  }, [db, missing]);

  const open = !!db && missing && settled && returning !== undefined;

  async function agree() {
    if (!db || !checked) return;
    setBusy(true);
    try {
      await acceptAgreement(db);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="agreement"
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 backdrop-blur-[2px] sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="agreement-title"
            className="w-full max-w-md rounded-t-[2rem] bg-surface px-5 pt-6 pb-[max(var(--safe-bottom),1.25rem)] shadow-float sm:rounded-[2rem] sm:p-7"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
          >
            <div className="flex items-end gap-4">
              <Mascot action="talk" className="h-20 w-[5.4rem] shrink-0" />
              <div className="min-w-0 pb-1">
                <p className="text-xs font-semibold tracking-wide text-brand-2 uppercase">{returning ? `Updated ${LEGAL_UPDATED}` : "Before you continue"}</p>
                <h2 id="agreement-title" className="mt-1 text-[1.45rem] leading-tight font-semibold tracking-tight">
                  {returning ? "We've updated our Terms and Privacy Policy" : "Review our Terms and Privacy Policy"}
                </h2>
              </div>
            </div>
            <p className="mt-4 text-[0.95rem] text-ink-2">
              {returning
                ? "They now explain in plain language what Kaban stores, where it lives when you sync, and what you can expect from us. Please take a look and agree to keep using Kaban."
                : "They explain what Kaban stores, where it lives when you sync, and what you can expect from us. Please agree to keep using Kaban."}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                { href: "/terms", icon: FileText, label: "Terms of Service" },
                { href: "/privacy", icon: Shield, label: "Privacy Policy" },
              ].map(({ href, icon: Icon, label }) => (
                <Link key={href} href={href} className="flex min-h-12 items-center gap-2 rounded-2xl border border-line bg-bg px-3 text-sm font-medium active:bg-pale lg:hover:bg-pale">
                  <Icon className="size-4 shrink-0 text-brand" />
                  {label}
                </Link>
              ))}
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl bg-pale/70 p-3.5 text-sm text-ink-2">
              <span className="relative mt-0.5 grid size-5 shrink-0 place-items-center">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                  className="peer size-5 appearance-none rounded-md border-2 border-line bg-field checked:border-brand checked:bg-brand"
                />
                <Check className="pointer-events-none absolute size-3.5 text-on-brand opacity-0 peer-checked:opacity-100" strokeWidth={3} />
              </span>
              <span>I have read and agree to the Terms of Service and the Privacy Policy. I&apos;m 13 or older, and if I&apos;m under 18, my parent or guardian agrees too.</span>
            </label>

            <Button wrapperClassName="mt-4 w-full" className={cx(!checked && "opacity-60")} onClick={agree} disabled={!checked || busy}>
              {busy ? "Saving…" : "Agree and continue"}
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
