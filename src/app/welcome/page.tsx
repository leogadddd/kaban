"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { Cloud, HardDrive, ShieldAlert, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui";
import { loadDemoData } from "@/lib/demo";
import { LogoMark } from "@/lib/logo";
import { isActiveDatabase, useLedgerDatabase } from "@/lib/db";
import { setMeta } from "@/lib/repo";
import { cloudConfigured } from "@/lib/supabase";

export default function WelcomePage() {
  const router = useRouter();
  const db = useLedgerDatabase();
  const [busy, setBusy] = useState(false);

  async function start(demo: boolean) {
    if (!db) return;
    setBusy(true);
    await setMeta("mode", "local", db);
    await setMeta("startedAt", Date.now(), db);
    if (demo) await loadDemoData(db);
    if (!isActiveDatabase(db)) return;
    router.replace(demo ? "/home" : "/accounts/new?first=1");
  }

  return (
    // Exactly one screen tall, no scrolling: the hero flexes to fill whatever height is left.
    <div className="pt-safe flex h-dvh flex-col overflow-hidden px-5 pb-[max(var(--safe-bottom),1rem)]">
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
              className="card-grain absolute inset-x-4 h-28 rounded-[1.6rem] p-4 text-white shadow-float"
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
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="shrink-0">
        <div className="flex items-center gap-2">
          <LogoMark size={28} />
          <span className="font-semibold tracking-tight">Kaban</span>
        </div>
        <h1 className="mt-2.5 text-[2rem] leading-[1.05] font-semibold tracking-tight [@media(max-height:640px)]:text-[1.7rem]">
          Every peso, accounted for.
        </h1>
        <p className="mt-2 text-[0.95rem] text-ink-2 [@media(max-height:640px)]:hidden">Track cash, bank and e-wallet accounts, credit cards and who owes you. Works fully offline.</p>
      </motion.div>

      <div className="mt-5 shrink-0 space-y-2.5">
        <div className="flex gap-2.5 rounded-2xl bg-gold/10 p-3 text-xs text-ink-2">
          <ShieldAlert className="size-4 shrink-0 text-gold" />
          <p>
            <b className="text-ink">Data stays on this device.</b> Clearing Safari data or losing the phone erases it, so export backups from Sync & Backup.
          </p>
        </div>
        <Button className="w-full" onClick={() => start(false)} disabled={busy}>
          <HardDrive className="size-4" /> Start on this device
        </Button>
        <Button variant="secondary" className="w-full" onClick={() => start(true)} disabled={busy}>
          <Sparkles className="size-4" /> Explore with sample data
        </Button>
        {cloudConfigured ? (
          <Button
            variant="ghost"
            className="min-h-10 w-full text-sm"
            disabled={busy}
            onClick={() => router.push("/login")}
          >
            <Cloud className="size-4" /> I have an account — sign in
          </Button>
        ) : (
          <p className="flex items-center justify-center gap-1.5 text-[0.7rem] text-ink-3 [@media(max-height:700px)]:hidden">
            <Cloud className="size-3.5" /> Cloud backup is optional and can be turned on later.
          </p>
        )}
      </div>
    </div>
  );
}
