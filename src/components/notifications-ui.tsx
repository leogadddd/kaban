"use client";

import { Bell } from "lucide-react";
import { HapticLink } from "@/components/haptic-button";
import { useInbox } from "@/lib/inbox";
import { useMeta } from "@/lib/hooks";
import { PENDING, type QuickEntry } from "@/lib/quick-add";
import { cx } from "./ui";

/** Quick adds waiting for approval plus unread notifications, from this device's copy. */
export function useNotificationCount() {
  const pending = useMeta<QuickEntry[]>(PENDING)?.length ?? 0;
  const unread = useInbox()?.filter((i) => !i.read).length ?? 0;
  return pending + unread;
}

export function CountBadge({ count, className }: { count: number; className?: string }) {
  if (!count) return null;
  return (
    <span className={cx("num grid h-5 min-w-5 place-items-center rounded-full bg-expense px-1.5 text-[0.68rem] leading-none font-semibold text-white", className)}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function NotificationsButton({ wrapperClassName }: { wrapperClassName?: string }) {
  const count = useNotificationCount();
  return (
    <HapticLink
      href="/notifications"
      wrapperClassName={wrapperClassName}
      aria-label={count ? `Notifications, ${count} new` : "Notifications"}
      className="relative grid size-10 place-items-center rounded-full text-ink-2 active:bg-pale lg:hover:bg-pale"
    >
      <Bell className="size-5" />
      <CountBadge count={count} className="absolute -top-0.5 -right-0.5 ring-2 ring-bg" />
    </HapticLink>
  );
}
