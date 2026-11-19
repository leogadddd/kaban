"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { Cloud, HardDrive, ShieldAlert, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui";
import { loadDemoData } from "@/lib/demo";
import { LogoMark } from "@/lib/logo";
import { setMeta } from "@/lib/repo";

export default function WelcomePage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function start(demo: boolean) {
    setBusy(true);
    await setMeta("mode", "local");
    await setMeta("startedAt", Date.now());
    if (demo) await loadDemoData();
    router.replace(demo ? "/home" : "/accounts/new?first=1");
  }

  return (
    <div className="pt-safe flex min-h-dvh flex-col px-5 pb-[calc(1.5rem+var(--safe-bottom))]">
      <div className="relative mt-6 flex-1">
        {/* Floating stacked cards hero */}
        <div className="relative mx-auto h-64 max-w-xs">
          {[
            { c: "#1F2D27", r: -8, y: 0, label: "Family Card", v: "₱18,440" },
            { c: "#176B4D", r: 4, y: 54, label: "Savings", v: "₱68,250" },
            { c: "#2D936C", r: -2, y: 108, label: "Wallet", v: "₱4,500" },
          ].map((k, i) => (
            <motion.div
              key={k.label}
              className="card-grain absolute inset-x-4 h-32 rounded-[1.6rem] p-4 text-white shadow-float"
              style={{ background: k.c, top: k.y }}
              initial={{ opacity: 0, y: 40, rotate: 0 }}
              animate={{ opacity: 1, y: 0, rotate: k.r }}
              transition={{ delay: 0.1 + i * 0.12, type: "spring", stiffness: 180, damping: 18 }}
            >
              <p className="text-xs text-white/70">{k.label}</p>
              <p className="num mt-1 text-2xl font-semibold">{k.v}</p>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="mt-6">
          <div className="flex items-center gap-2">
            <LogoMark size={32} />
            <span className="text-lg font-semibold tracking-tight">Kaban</span>
          </div>
          <h1 className="mt-3 text-[2.2rem] leading-[1.05] font-semibold tracking-tight">
            Every peso on the family card, accounted for.
          </h1>
          <p className="mt-3 text-ink-2">Track cash, debit and shared credit — who bought what, what&apos;s owed to the bank, and who still owes you. Works fully offline.</p>
        </motion.div>
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex gap-3 rounded-2xl bg-gold/10 p-3 text-sm text-ink-2">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-gold" />
          <p>
            <b className="text-ink">Local mode keeps data only on this device.</b> Clearing Safari data or losing the phone erases it — export backups from Sync & Backup.
          </p>
        </div>
        <Button className="w-full" onClick={() => start(false)} disabled={busy}>
          <HardDrive className="size-4" /> Start on this device
        </Button>
        <Button variant="secondary" className="w-full" onClick={() => start(true)} disabled={busy}>
          <Sparkles className="size-4" /> Explore with sample data
        </Button>
        <p className="flex items-center justify-center gap-1.5 pt-1 text-xs text-ink-3">
          <Cloud className="size-3.5" /> Cloud backup & sign-in are optional and can be enabled later.
        </p>
      </div>
    </div>
  );
}
