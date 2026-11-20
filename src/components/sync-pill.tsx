"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, CloudCheck, CloudOff, HardDrive, KeyRound, RefreshCw } from "lucide-react";
import { cx } from "@/components/ui";
import { useOnline, usePendingCount } from "@/lib/hooks";
import { useSyncState } from "@/lib/sync";

export type SyncTone = "local" | "ok" | "busy" | "warn" | "bad";

/** One reading of the background sync for every indicator (pill, profile ring). */
export function useSyncStatus() {
  const online = useOnline();
  const pending = usePendingCount();
  const { phase } = useSyncState();
  const local = phase === "off" || phase === "signed-out";
  let tone: SyncTone = "ok";
  let label = "Synced";
  if (!online) [tone, label] = ["bad", "Offline"];
  else if (local) [tone, label] = ["local", "Local only"];
  else if (phase === "mfa") [tone, label] = ["warn", "Verify sign-in"];
  else if (phase === "full") [tone, label] = ["warn", "Cloud full"];
  else if (phase === "error") [tone, label] = ["bad", "Sync paused"];
  else if (phase === "syncing" || pending > 0) [tone, label] = ["busy", "Syncing"];
  return { tone, label, spinning: phase === "syncing" && online, pending, showPending: pending > 0 && (!online || !local) };
}

/** Compact sync status (FR-007). Reflects the background sync worker; it never blocks the UI. */
export function SyncPill() {
  const { tone, label, spinning, pending, showPending } = useSyncStatus();
  const ICONS: Record<SyncTone, ReactNode> = {
    local: <HardDrive className="size-3.5 text-brand" />,
    ok: <CloudCheck className="size-3.5 text-brand" />,
    busy: <RefreshCw className={cx("size-3.5 text-brand", spinning && "animate-spin")} />,
    warn: label === "Verify sign-in" ? <KeyRound className="size-3.5 text-gold" /> : <AlertTriangle className="size-3.5 text-gold" />,
    bad: label === "Offline" ? <CloudOff className="size-3.5 text-expense" /> : <AlertTriangle className="size-3.5 text-expense" />,
  };
  const warn = tone === "warn" || label === "Sync paused";

  return (
    <Link
      href="/sync"
      className={cx("flex min-h-10 items-center gap-1.5 rounded-full border bg-surface px-3 text-xs font-medium text-ink-2", warn ? "border-gold/50" : "border-line")}
      aria-label={`Sync status: ${label}`}
    >
      {ICONS[tone]}
      {label}
      {showPending && <span className="num rounded-full bg-pale px-1.5 text-[0.65rem] text-brand">{pending}</span>}
    </Link>
  );
}
