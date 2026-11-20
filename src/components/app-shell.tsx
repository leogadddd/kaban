"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, ViewTransition, type ReactNode } from "react";
import {
  BarChart3,
  CalendarClock,
  HandCoins,
  History,
  Home,
  List,
  Plus,
  RefreshCw,
  Settings,
  Users,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { requestPersistence, useLedgerDatabase } from "@/lib/db";
import { startSync, useSyncState } from "@/lib/sync";
import { entryPath, isOnboarded, markOnboarded } from "@/lib/first-run";
import { AgreementGate } from "./agreement-gate";
import { DialogHost } from "./dialog";
import { UndoToaster } from "./undo-toast";
import { useLedger, useMeta } from "@/lib/hooks";
import { installNavDirection, notePath } from "@/lib/nav-direction";
import { LogoMark } from "@/lib/logo";
import { PrivacySync, PrivacyToggle } from "./privacy-toggle";
import { PullToRefresh } from "./pull-to-refresh";
import { SyncPill } from "./sync-pill";
import { Reminders } from "./reminders";
import { cx } from "./ui";
import { HapticLink } from "./haptic-button";
import { groupHrefs } from "./section-tabs";

/** Nested Settings pages (narrow single column, like Settings itself). */
export const SETTINGS_ROUTES = ["/settings/general", "/settings/notifications", "/settings/sync", "/settings/security", "/settings/security/password", "/settings/about", "/settings/quick-add", "/settings/delete-account"];

const FAMILY_ROUTES = ["/family", "/family/new", "/family/invite", "/family/join", "/family/members", "/family/settings"];

/** Bottom tabs. `match` lists the pages that light a tab up (its section tabs live on those pages). */
const NAV = [
  { href: "/home", label: "Home", icon: Home, match: ["/home"] },
  { href: "/accounts", label: "Accounts", icon: WalletCards, match: groupHrefs("accounts") },
  { href: "/add", label: "Add", icon: Plus, match: [] },
  { href: "/family", label: "Family", icon: UsersRound, match: FAMILY_ROUTES },
  { href: "/analytics", label: "Analytics", icon: BarChart3, match: ["/analytics"] },
] as const;

const MORE: { href: string; label: string; short?: string; icon: typeof Users }[] = [
  { href: "/activity", label: "Activity", icon: List },
  { href: "/people", label: "People", icon: Users },
  { href: "/owed", label: "Who Owes Me", short: "Owed to me", icon: HandCoins },
  { href: "/instalments", label: "Instalments", icon: CalendarClock },
  { href: "/payments", label: "Payment History", short: "Payments", icon: History },
  { href: "/sync", label: "Sync & Backup", short: "Backup", icon: RefreshCw },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** Where a signed-in account scheduled for deletion is held until it recovers or signs out. */
export const ACCOUNT_DELETED = "/account/deleted";
/** Sign-in flow: full-screen, no app chrome, reachable before onboarding (a new device signs in from Welcome). */
export const AUTH_ROUTES = ["/login", "/login/verify", "/signup", "/forgot-password", "/reset-password", ACCOUNT_DELETED];
/** Pages that render before the device has been set up. */
const UNGATED = ["/welcome", "/ready", ...AUTH_ROUTES];
const HIDE_NAV = ["/welcome", "/ready", "/add", "/accounts/new", ...AUTH_ROUTES];
/** Screens presented like modals: full screen on phones, a centered card on desktop. */
const MODAL_ROUTES = ["/add", "/accounts/new"];
/** Form-like pages that read better as a single column on desktop. */
const NARROW = [...UNGATED, "/add", "/accounts/new", "/people", "/owed/person", "/sync", "/settings", ...SETTINGS_ROUTES, "/payments", "/notifications", "/profile", "/profile/edit", ...FAMILY_ROUTES.slice(1)];
/** Read-only screens where pulling down from the top syncs with the cloud now (phones only). */
const PULL_TO_REFRESH = ["/home", "/accounts", "/accounts/view", "/activity", "/people", "/owed", "/owed/person", "/instalments", "/payments", "/analytics", "/family", "/family/members", "/notifications"];
/** Shortest time the launch splash stays up, counted from page load. */
const SPLASH_MIN_MS = 1000;
/** Public pages that render without the app chrome or the onboarding gate. */
const BARE = ["/", "/terms", "/privacy"];

/** Pages that are panes of one swipeable screen share a key, so swiping between them never remounts the screen. */
const ACCOUNT_PANES = groupHrefs("accounts");
const ACTIVITY_PANES = groupHrefs("activity");
const viewKey = (path: string) => (ACCOUNT_PANES.includes(path) ? "/accounts" : ACTIVITY_PANES.includes(path) ? "/activity" : path);

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const mode = useMeta<string>("mode");
  const database = useLedgerDatabase();
  const { phase, userId } = useSyncState();

  useEffect(() => {
    if (typeof mode === "string" || userId) markOnboarded();
  }, [mode, userId]);

  useEffect(() => {
    if (pathname === "/welcome" && database && userId) router.replace("/home");
    // Welcome is a first-run screen only; a returning, signed-out device signs in instead.
    else if (pathname === "/welcome" && mode === undefined && isOnboarded()) router.replace("/login");
    if (phase === "deleted") {
      if (pathname !== ACCOUNT_DELETED && !BARE.includes(pathname)) router.replace(ACCOUNT_DELETED);
      return;
    }
    if (UNGATED.includes(pathname) || BARE.includes(pathname)) return;
    if (phase === "mfa") router.replace("/login/verify");
    else if (mode === undefined) router.replace(entryPath());
  }, [database, mode, pathname, phase, router, userId]);

  useEffect(() => installNavDirection(), []);

  // One viewport measurement sizes both mobile form routes and sheets while the keyboard is up.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    let frame = 0;

    const update = () => {
      const layoutHeight = root.clientHeight;
      const top = Math.max(0, viewport.offsetTop);
      const height = viewport.height;
      const keyboardOpen = viewport.scale === 1 && layoutHeight - height > 80;
      root.style.setProperty("--visible-viewport-top", `${top}px`);
      root.style.setProperty("--visible-viewport-height", `${height}px`);
      root.style.setProperty("--visible-viewport-bottom", `${Math.max(0, layoutHeight - top - height)}px`);
      root.toggleAttribute("data-kb", keyboardOpen);

      if (!keyboardOpen) return;
      const field = document.activeElement;
      if (!(field instanceof HTMLElement) || !field.matches("input, textarea, [contenteditable]")) return;
      const scroller = field.closest<HTMLElement>("[data-viewport-scroll]");
      if (!scroller || scroller.scrollHeight <= scroller.clientHeight) return;

      const fieldRect = field.getBoundingClientRect();
      const scrollRect = scroller.getBoundingClientRect();
      const above = fieldRect.top - scrollRect.top - 8;
      const below = fieldRect.bottom - scrollRect.bottom + 8;
      // Keep the focused control in view without scrolling the document or moving the footer.
      if (above < 0) scroller.scrollTop += above;
      else if (below > 0) scroller.scrollTop += below;
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("resize", schedule);
    viewport.addEventListener("resize", schedule);
    viewport.addEventListener("scroll", schedule);
    document.addEventListener("focusin", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      viewport.removeEventListener("resize", schedule);
      viewport.removeEventListener("scroll", schedule);
      document.removeEventListener("focusin", schedule);
      root.style.removeProperty("--visible-viewport-top");
      root.style.removeProperty("--visible-viewport-height");
      root.style.removeProperty("--visible-viewport-bottom");
      root.removeAttribute("data-kb");
    };
  }, []);

  // iOS Safari ignores user-scalable=no; cancelling its gesture events blocks pinch-zoom there too.
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    const opts = { passive: false } as const;
    document.addEventListener("gesturestart", block, opts);
    document.addEventListener("gesturechange", block, opts);
    document.addEventListener("gestureend", block, opts);
    // Trackpad / ctrl+wheel zoom on desktop browsers
    const wheel = (e: WheelEvent) => e.ctrlKey && e.preventDefault();
    window.addEventListener("wheel", wheel, opts);
    return () => {
      document.removeEventListener("gesturestart", block);
      document.removeEventListener("gesturechange", block);
      document.removeEventListener("gestureend", block);
      window.removeEventListener("wheel", wheel);
    };
  }, []);

  useEffect(() => notePath(pathname), [pathname]);

  useEffect(() => {
    requestPersistence();
    startSync();
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        // Refresh every cached page once per deploy so offline never serves an old build.
        const build = process.env.NEXT_PUBLIC_BUILD_ID ?? "";
        let last: string | null = null;
        try {
          last = localStorage.getItem("kaban:shell-build");
        } catch {}
        if (last === build) return;
        reg.active?.postMessage("precache");
        try {
          localStorage.setItem("kaban:shell-build", build);
        } catch {}
      })
      .catch(() => {});
  }, []);

  const hideNav = HIDE_NAV.includes(pathname);
  const gated = !AUTH_ROUTES.includes(pathname) && (!database || mode === null || (pathname === "/welcome" && !!userId) || (mode === undefined && !UNGATED.includes(pathname)));
  const showSidebar = !UNGATED.includes(pathname) && !gated;
  const failed = phase === "error" && !database;

  if (BARE.includes(pathname)) return <>{children}</>;

  return (
    <div className={cx("min-h-dvh", showSidebar && "lg:pl-64")}>
      <LaunchSplash gated={gated} failed={failed} waitForLedger={pathname === "/home"} />
      <PrivacySync />
      {!gated && <Reminders />}
      {!gated && !UNGATED.includes(pathname) && <AgreementGate />}
      <DialogHost />
      <UndoToaster aboveNav={!hideNav} />
      {showSidebar && <Sidebar pathname={pathname} />}

      <main className={cx("mx-auto max-w-md lg:px-6", NARROW.includes(pathname) ? "lg:max-w-2xl" : "lg:max-w-6xl", !hideNav ? "pb-nav lg:pb-16" : "lg:pb-16")}>{gated ? (phase === "error" && !database ? <p role="alert" className="p-4">The ledger could not be opened. Reload Kaban to try again.</p> : null) : (
          // Keyed by path: each navigation exits the old page and enters the new one as a view transition.
          // Sign-in pages don't use the ledger, so switching it mid sign-in mustn't remount them as a blank form.
          <ViewTransition key={AUTH_ROUTES.includes(pathname) ? `auth:${pathname}` : `${database?.name ?? "auth"}:${viewKey(pathname)}`} enter="page-in" exit="page-out" default="none">
            {/* Opaque, full-height surface so a page never shows the previous one through it mid-transition. */}
            <div
              className={cx(
                "min-h-dvh bg-bg",
                // Desktop: modal-style routes (Add, New account) sit in a centered card instead of a full-height phone screen.
                MODAL_ROUTES.includes(pathname) && "form-viewport lg:my-8 lg:min-h-0 lg:overflow-hidden lg:rounded-[2rem] lg:border lg:border-line lg:bg-surface lg:shadow-soft",
              )}
            >
              <PullToRefresh enabled={PULL_TO_REFRESH.includes(pathname)}>{children}</PullToRefresh>
            </div>
          </ViewTransition>
        )}</main>

      {!hideNav && !gated && <BottomNav pathname={pathname} />}

    </div>
  );
}

/** On Home, keep the launch splash up through the first local ledger read. */
function LaunchSplash({ gated, failed, waitForLedger }: { gated: boolean; failed: boolean; waitForLedger: boolean }) {
  const { ready } = useLedger();
  const waiting = gated || (waitForLedger && !ready);

  useEffect(() => {
    const root = document.documentElement;
    if (!root.hasAttribute("data-splash") || root.hasAttribute("data-ready") || (waiting && !failed)) return;
    const t = setTimeout(() => root.setAttribute("data-ready", ""), Math.max(0, SPLASH_MIN_MS - performance.now()));
    return () => clearTimeout(t);
  }, [waiting, failed]);

  return null;
}

function BottomNav({ pathname }: { pathname: string }) {
  const isActive = (match: readonly string[]) => match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
  return (
    <nav aria-label="Primary" style={{ viewTransitionName: "bottom-nav" }} className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md px-3 lg:hidden pb-[max(var(--safe-bottom),0.75rem)]">
      {/* Dark mode: fade the page out behind the bar so it doesn't sit on same-toned cards. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-6 bottom-0 -z-10 hidden bg-gradient-to-t from-bg via-bg/85 to-transparent dark:block" />
      {/* Five equal slots so every highlight is the same size and centred in its slot. */}
      <div className="grid grid-cols-5 items-center rounded-[1.75rem] border border-line bg-surface p-1.5 shadow-float">
        {NAV.map(({ href, label, icon: Icon, match }) => {
          if (href === "/add")
            return (
              <div key={href} className="grid place-items-center">
                <HapticLink href={href} aria-label="Add transaction" className="grid size-14 place-items-center rounded-[1.35rem] bg-brand text-on-brand shadow-soft active:scale-95">
                  <Icon className="size-7" strokeWidth={2.4} />
                </HapticLink>
              </div>
            );
          return <NavItem key={href} href={href} label={label} icon={Icon} active={isActive(match)} />;
        })}
      </div>
    </nav>
  );
}

function NavItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof Users; active: boolean }) {
  const cls = "relative mx-auto flex h-14 w-full max-w-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-[1.25rem] text-[0.68rem] font-medium";
  const tone = active ? "text-brand" : "text-ink-2";
  const inner = (
    <>
      {active && (
        <motion.span
          layoutId="nav-pill"
          className="absolute inset-0 rounded-[1.25rem] bg-brand/10"
          transition={{ type: "spring", bounce: 0.25, duration: 0.45 }}
        />
      )}
      <Icon className="relative size-5" />
      <span className="relative whitespace-nowrap">{label}</span>
    </>
  );
  return (
    <div className="px-0.5">
      <HapticLink href={href} aria-current={active ? "page" : undefined} wrapperClassName="grid" className={cx(cls, tone)}>{inner}</HapticLink>
    </div>
  );
}

/** Desktop navigation: everything from the bottom bar and the More drawer in one column. */
function Sidebar({ pathname }: { pathname: string }) {
  const items = [...NAV.filter((n) => n.href !== "/add"), ...MORE];
  return (
    <aside data-nav-peer style={{ viewTransitionName: "sidebar" }} className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface px-4 py-6 lg:flex" aria-label="Primary">
      <Link href="/home" className="mb-6 flex items-center gap-2.5 px-2">
        <LogoMark size={34} />
        <span className="text-lg font-semibold tracking-tight">Kaban</span>
      </Link>
      <Link href="/add" className="mb-5 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-brand font-medium text-on-brand shadow-float active:scale-[0.98]">
        <Plus className="size-5" strokeWidth={2.4} /> Add transaction
      </Link>
      <nav className="flex-1 space-y-0.5 overflow-y-auto">
        {items.map(({ href, label, icon: Icon }, i) => {
          const active = pathname.startsWith(href);
          return (
            <div key={href}>
              {i === NAV.length - 1 && <p className="mt-5 mb-1 px-3 text-[0.68rem] font-semibold tracking-wide text-ink-3 uppercase">More</p>}
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx("relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors", active ? "text-brand" : "text-ink-2 hover:bg-pale")}
              >
                {active && <motion.span layoutId="side-pill" className="absolute inset-0 rounded-xl bg-brand/10" transition={{ type: "spring", bounce: 0.2, duration: 0.4 }} />}
                <Icon className="relative size-[1.1rem]" />
                <span className="relative">{label}</span>
              </Link>
            </div>
          );
        })}
      </nav>
      <div className="flex items-center gap-2 px-1 pt-4">
        <SyncPill />
        <PrivacyToggle />
      </div>
    </aside>
  );
}
