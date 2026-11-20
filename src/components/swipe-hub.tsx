"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { SwipePager } from "@/components/swipe-pager";
import { Card, cx, Loading, PageHeader, Segmented } from "@/components/ui";
import { useIsDesktop } from "@/lib/hooks";
import type { Wallet } from "lucide-react";

export type HubPane = {
  href: string;
  /** Label in the segmented control. */
  tab: string;
  /** Page title on desktop, where each pane is its own sidebar entry. */
  title: string;
  /** Round button in the header while this pane is showing. */
  action?: ReactNode;
  content: ReactNode;
};

/**
 * Several routes shown as one swipeable screen under a bottom-nav tab (like Home's Money / Credit):
 * one header, a segmented control and a pager. Swiping or tapping rewrites the URL in place.
 */
export function SwipeHub({ title, panes, ready, back }: { title: string; panes: HubPane[]; ready: boolean; back?: string | true }) {
  const pathname = usePathname();
  const desktop = useIsDesktop();
  const indexFor = (path: string) => Math.max(0, panes.findIndex((p) => p.href === path));
  const [index, setIndex] = useState(() => indexFor(pathname));
  const [seenPath, setSeenPath] = useState(pathname);

  // Bottom-nav or sidebar navigation to one of the routes moves the pager.
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setIndex(indexFor(pathname));
  }

  function select(i: number) {
    setIndex(i);
    // Keep the address in step so reload, share and back land on the same pane, without a page transition.
    if (window.location.pathname !== panes[i].href) window.history.replaceState(window.history.state, "", panes[i].href);
  }

  const pane = panes[index];

  return (
    <>
      <PageHeader
        title={desktop ? pane.title : title}
        back={back}
        action={
          <AnimatePresence mode="popLayout" initial={false}>
            {pane.action && (
              <motion.span key={pane.href} className="grid" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.16 }}>
                {pane.action}
              </motion.span>
            )}
          </AnimatePresence>
        }
      />
      {!ready ? (
        <Loading />
      ) : desktop ? (
        <div className="px-4">{pane.content}</div>
      ) : (
        <>
          <div className="px-4 pb-4">
            <Segmented<string> value={pane.href} onChange={(href) => select(indexFor(href))} options={panes.map((p) => ({ value: p.href, label: p.tab }))} />
          </div>
          <SwipePager index={index} onIndexChange={select}>
            {panes.map((p) => (
              <div key={p.href}>{p.content}</div>
            ))}
          </SwipePager>
        </>
      )}
    </>
  );
}

/* ---------- Building blocks so every pane reads the same ---------- */

export function Tiles({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("grid grid-cols-2 gap-3", className)}>{children}</div>;
}

export function Tile({ label, children, dark }: { label: string; children: ReactNode; dark?: boolean }) {
  return (
    <Card className={dark ? "bg-night text-white dark:border-white/6" : "bg-pale"}>
      <p className={cx("text-xs", dark ? "text-white/60" : "text-ink-3")}>{label}</p>
      <div className="text-xl font-semibold">{children}</div>
    </Card>
  );
}

export function GroupTitle({ icon: Icon, children }: { icon: typeof Wallet; children: ReactNode }) {
  return (
    <h2 className="mb-2 flex items-center gap-1.5 px-1 text-sm font-semibold text-ink-2">
      <Icon className="size-4" /> {children}
    </h2>
  );
}

export function Row({ href, lead, title, sub, trail }: { href: string; lead: ReactNode; title: ReactNode; sub: ReactNode; trail?: ReactNode }) {
  return (
    <Link href={href} className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors active:bg-pale lg:hover:bg-pale">
      {lead}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{title}</p>
        <div className="truncate text-xs text-ink-3">{sub}</div>
      </div>
      {trail && <div className="shrink-0 text-right">{trail}</div>}
      <ChevronRight className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
    </Link>
  );
}
