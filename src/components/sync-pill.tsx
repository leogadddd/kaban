"use client";

import Link from "next/link";
import { CloudOff, HardDrive } from "lucide-react";
import { useOnline, usePendingCount } from "@/lib/hooks";

/** Compact sync status (FR-007). Kaban runs local-only until a sync server is connected. */
export function SyncPill() {
  const online = useOnline();
  const pending = usePendingCount();
  return (
    <Link href="/sync" className="flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-xs font-medium text-ink-2" aria-label="Sync status">
      {online ? <HardDrive className="size-3.5 text-brand" /> : <CloudOff className="size-3.5 text-expense" />}
      {online ? "Local only" : "Offline"}
      {pending > 0 && !online && <span className="num rounded-full bg-pale px-1.5 text-[0.65rem] text-brand">{pending}</span>}
    </Link>
  );
}
