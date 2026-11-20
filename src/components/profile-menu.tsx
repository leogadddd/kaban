"use client";

import { ChevronRight, CircleUserRound, List, LogIn, RefreshCw, Settings, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { navDirection, setNavDirection } from "@/lib/nav-direction";
import { cloudConfigured } from "@/lib/supabase";
import { useSyncState } from "@/lib/sync";
import { useProfile } from "@/lib/family";
import { PersonAvatar } from "./family-ui";
import { HapticButton } from "./haptic-button";
import { Sheet } from "./ui";

// Marks the opening page's own history entry, so only returning to that entry (swipe or Back) reopens the sheet.
const FLAG = "kabanProfileOpen";
const restoreOnReturn = () => typeof window !== "undefined" && !!(window.history.state as Record<string, unknown> | null)?.[FLAG];

/** Top-right avatar on every phone header: account status plus the less-used pages (Activity, Sync & Backup, Settings). */
export function ProfileButton({ wrapperClassName }: { wrapperClassName?: string } = {}) {
  const router = useRouter();
  // Coming back (swipe or Back) from a page opened here: the sheet is still open, matching the
  // snapshot the phone shows during the back gesture. Any other arrival starts closed.
  const [open, setOpen] = useState(restoreOnReturn);
  // Clear the mark once shown, so a later Back to this entry after closing the sheet stays closed.
  useEffect(() => {
    if (!open && restoreOnReturn()) window.history.replaceState({ ...window.history.state, [FLAG]: false }, "");
  }, [open]);

  // Set while navigating away, so the page transition fades the sheet out instead of cutting it.
  const [leaving, setLeaving] = useState(false);

  function openPage(href: string) {
    if (href === window.location.pathname) return setOpen(false);
    window.history.replaceState({ ...window.history.state, [FLAG]: true }, "");
    // Name the sheet before the transition snapshots the old page; this page unmounts with it.
    flushSync(() => setLeaving(true));
    setNavDirection(navDirection(window.location.pathname, href));
    router.push(href);
  }
  const { email, userId } = useSyncState();
  const profile = useProfile();
  const name = profile?.display_name?.trim();

  const rows = [
    { href: "/activity", label: "Activity", icon: List },
    { href: "/sync", label: "Sync & Backup", icon: RefreshCw },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <>
      <HapticButton
        type="button"
        onClick={() => setOpen(true)}
        wrapperClassName={wrapperClassName}
        aria-label="Profile and settings"
        className="grid size-10 place-items-center overflow-hidden rounded-full bg-pale font-semibold text-brand ring-1 ring-line"
      >
        {userId ? <PersonAvatar name={name || email} avatar={profile?.avatar} size={40} /> : <CircleUserRound className="size-5" />}
      </HapticButton>

      <Sheet open={open} onClose={() => setOpen(false)} title="You" appear={false} transitionName={leaving ? "profile-sheet" : undefined}>
        <div className="space-y-4 pb-2">
          <HapticButton
            type="button"
            onClick={() => openPage("/profile")}
            wrapperClassName="grid"
            className="flex w-full items-center gap-3 rounded-3xl border border-line bg-surface p-4 text-left active:bg-pale"
          >
            {userId ? <PersonAvatar name={name || email} avatar={profile?.avatar} size={48} /> : (
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-pale text-brand"><CircleUserRound className="size-6" /></span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{userId ? name || email || "Signed in" : "On this device"}</p>
              <p className="truncate text-sm text-ink-3">{userId ? (name ? email : "View profile") : "Not backed up to the cloud"}</p>
            </div>
            <ChevronRight className="size-4 text-ink-3" />
          </HapticButton>

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
