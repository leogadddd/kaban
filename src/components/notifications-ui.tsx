"use client";

import { Bell, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { HapticButton, HapticLink } from "@/components/haptic-button";
import { useIsDesktop, useMeta } from "@/lib/hooks";
import { inboxCount, useFamilies } from "@/lib/family";
import { useInbox } from "@/lib/inbox";
import { PENDING, type QuickEntry } from "@/lib/quick-add";
import { ClearNotifications, NotificationsList } from "./notifications-panel";
import { cx } from "./ui";

/** Quick adds and join requests waiting for this user, plus unread notifications, from this device's copy. */
export function useNotificationCount() {
  const pending = useMeta<QuickEntry[]>(PENDING)?.length ?? 0;
  const requests = inboxCount(useFamilies());
  // Join-request notifications are already counted as waiting requests.
  const unread = useInbox()?.filter((i) => !i.read && i.kind !== "join-request").length ?? 0;
  return pending + requests + unread;
}

export function CountBadge({ count, className }: { count: number; className?: string }) {
  if (!count) return null;
  return (
    <span className={cx("num grid h-5 min-w-5 place-items-center rounded-full bg-expense px-1.5 text-[0.68rem] leading-none font-semibold text-on-expense", className)}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

const btnCls = "relative grid size-10 place-items-center rounded-full text-ink-2 active:bg-pale lg:hover:bg-pale";

/** Phones: opens the Notifications page. Desktop: slides a panel in from the right. */
export function NotificationsButton({ wrapperClassName }: { wrapperClassName?: string }) {
  const count = useNotificationCount();
  const desktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const label = count ? `Notifications, ${count} new` : "Notifications";
  const inner = (
    <>
      <Bell className="size-5" />
      <CountBadge count={count} className="absolute -top-0.5 -right-0.5 ring-2 ring-bg" />
    </>
  );
  if (!desktop)
    return (
      <HapticLink href="/notifications" wrapperClassName={wrapperClassName} aria-label={label} className={btnCls}>
        {inner}
      </HapticLink>
    );
  return (
    <>
      <HapticButton type="button" onClick={() => setOpen(true)} wrapperClassName={wrapperClassName} aria-label={label} aria-expanded={open} className={btnCls}>
        {inner}
      </HapticButton>
      <NotificationsDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}

const noop = () => () => {};

function NotificationsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  useEffect(() => {
    if (!open) return;
    // A review sheet opened from the panel takes Escape first (it listens too and sits on top).
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !document.querySelector("[role=dialog][aria-label='Approve quick add']") && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Notifications">
          <motion.div className="absolute inset-0 bg-brand-deep/20" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col border-l border-line bg-bg shadow-float"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 34, stiffness: 360 }}
          >
            <header className="flex items-center gap-2 px-5 pt-6 pb-4">
              <h2 className="flex-1 text-xl font-semibold tracking-tight">Notifications</h2>
              <ClearNotifications />
              <HapticButton type="button" onClick={onClose} aria-label="Close" className="grid size-10 place-items-center rounded-full bg-pale hover:bg-brand/10">
                <X className="size-5" />
              </HapticButton>
            </header>
            <div className="flex-1 overflow-y-auto px-5 pb-6">
              <NotificationsList onNavigate={onClose} />
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
