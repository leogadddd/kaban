"use client";

import Link from "next/link";
import { AlertTriangle, CloudCheck, CloudOff, HardDrive, KeyRound, RefreshCw } from "lucide-react";
import { cx } from "@/components/ui";
import { useOnline, usePendingCount } from "@/lib/hooks";
import { useSyncState } from "@/lib/sync";

/** Compact sync status (FR-007). Reflects the background sync worker; it never blocks the UI. */
export function SyncPill() {
  const online = useOnline();
  const pending = usePendingCount();
  const { phase } = useSyncState();
  const local = phase === "off" || phase === "signed-out";

  let icon = <HardDrive className="size-3.5 text-brand" />;
  let label = "Local only";
  let warn = false;
  if (!online) {
    icon = <CloudOff className="size-3.5 text-expense" />;
    label = "Offline";
  } else if (local) {
    /* defaults */
  } else if (phase === "mfa") {
    icon = <KeyRound className="size-3.5 text-gold" />;
    label = "Verify sign-in";
    warn = true;
  } else if (phase === "full") {
    icon = <AlertTriangle className="size-3.5 text-gold" />;
    label = "Cloud full";
    warn = true;
  } else if (phase === "error") {
    icon = <AlertTriangle className="size-3.5 text-expense" />;
    label = "Sync paused";
    warn = true;
  } else if (phase === "syncing" || pending > 0) {
    icon = <RefreshCw className={cx("size-3.5 text-brand", phase === "syncing" && "animate-spin")} />;
    label = "Syncing";
  } else {
    icon = <CloudCheck className="size-3.5 text-brand" />;
    label = "Synced";
  }

  return (
    <Link
      href="/sync"
      className={cx("flex min-h-10 items-center gap-1.5 rounded-full border bg-surface px-3 text-xs font-medium text-ink-2", warn ? "border-gold/50" : "border-line")}
      aria-label={`Sync status: ${label}`}
    >
      {icon}
      {label}
      {pending > 0 && (!online || !local) && <span className="num rounded-full bg-pale px-1.5 text-[0.65rem] text-brand">{pending}</span>}
    </Link>
  );
}
