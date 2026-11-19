"use client";

import { ChevronRight, CircleUserRound, LogIn, RefreshCw, Settings, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cloudConfigured } from "@/lib/supabase";
import { useSyncState } from "@/lib/sync";
import { HapticButton } from "./haptic-button";
import { Sheet } from "./ui";

/** Top-right avatar on Home: account status plus the less-used pages (Sync & Backup, Settings). */
export function ProfileButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Let the sheet finish sliding away before leaving Home. Otherwise the browser's snapshot of this page
  // (what an iOS/Android back-swipe shows) still has the sheet open, and it flashes on the way back.
  function openPage(href: string) {
    setOpen(false);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => router.push(href), reduce ? 0 : 340);
  }
  const { email, userId } = useSyncState();
  const initial = email?.[0]?.toUpperCase();

  const rows = [
    { href: "/sync", label: "Sync & Backup", icon: RefreshCw },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <>
      <HapticButton
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Profile and settings"
        className="grid size-10 place-items-center rounded-full bg-pale font-semibold text-brand ring-1 ring-line"
      >
        {userId && initial ? initial : <CircleUserRound className="size-5" />}
      </HapticButton>

      <Sheet open={open} onClose={() => setOpen(false)} title="You">
        <div className="space-y-4 pb-2">
          <div className="flex items-center gap-3 rounded-3xl border border-line bg-surface p-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-pale text-lg font-semibold text-brand">
              {userId && initial ? initial : <CircleUserRound className="size-6" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{userId ? email ?? "Signed in" : "On this device"}</p>
              <p className="text-sm text-ink-3">{userId ? "Backed up and syncing" : "Not backed up to the cloud"}</p>
            </div>
          </div>

          {!userId && cloudConfigured && (
            <div className="grid grid-cols-2 gap-2">
              <HapticButton type="button" onClick={() => openPage("/signup")} wrapperClassName="grid" className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-brand font-medium text-on-brand">
                <UserPlus className="size-4" /> Create account
              </HapticButton>
              <HapticButton type="button" onClick={() => openPage("/login")} wrapperClassName="grid" className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-pale font-medium text-brand">
                <LogIn className="size-4" /> Sign in
              </HapticButton>
            </div>
          )}

          <nav className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
            {rows.map(({ href, label, icon: Icon }) => (
              <HapticButton type="button" key={href} onClick={() => openPage(href)} wrapperClassName="grid" className="flex min-h-14 w-full items-center gap-3 px-4 text-left font-medium active:bg-pale">
                <span className="grid size-9 place-items-center rounded-xl bg-pale text-brand">
                  <Icon className="size-4.5" />
                </span>
                <span className="flex-1">{label}</span>
                <ChevronRight className="size-4 text-ink-3" />
              </HapticButton>
            ))}
          </nav>
        </div>
      </Sheet>
    </>
  );
}
