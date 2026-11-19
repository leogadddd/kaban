"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, ViewTransition, type ReactNode } from "react";
import {
  BarChart3,
  CalendarClock,
  HandCoins,
  History,
  Home,
  LayoutGrid,
  List,
  Plus,
  RefreshCw,
  Settings,
  Users,
  WalletCards,
} from "lucide-react";
import { requestPersistence } from "@/lib/db";
import { startSync } from "@/lib/sync";
import { DialogHost } from "./dialog";
import { getMeta } from "@/lib/repo";
import { useMeta } from "@/lib/hooks";
import { installNavDirection, notePath } from "@/lib/nav-direction";
import { LogoMark } from "@/lib/logo";
import { PrivacySync, PrivacyToggle } from "./privacy-toggle";
import { SyncPill } from "./sync-pill";
import { cx, Sheet } from "./ui";

const NAV = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/accounts", label: "Accounts", icon: WalletCards },
  { href: "/add", label: "Add", icon: Plus },
  { href: "/activity", label: "Activity", icon: List },
] as const;

const MORE: { href: string; label: string; short?: string; icon: typeof Users }[] = [
  { href: "/people", label: "People", icon: Users },
  { href: "/owed", label: "Who Owes Me", short: "Owed to me", icon: HandCoins },
  { href: "/instalments", label: "Instalments", icon: CalendarClock },
  { href: "/payments", label: "Payment History", short: "Payments", icon: History },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/sync", label: "Sync & Backup", short: "Backup", icon: RefreshCw },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** Sign-in flow: full-screen, no app chrome, reachable before onboarding (a new device signs in from Welcome). */
export const AUTH_ROUTES = ["/login", "/login/verify", "/signup", "/forgot-password", "/reset-password"];
/** Pages that render before the device has been set up. */
const UNGATED = ["/welcome", ...AUTH_ROUTES];
const HIDE_NAV = ["/welcome", "/add", "/accounts/new", ...AUTH_ROUTES];
/** Screens presented like modals: full screen on phones, a centered card on desktop. */
const MODAL_ROUTES = ["/add", "/accounts/new"];
/** Form-like pages that read better as a single column on desktop. */
const NARROW = [...UNGATED, "/add", "/accounts/new", "/people", "/owed/person", "/sync", "/settings", "/payments"];
/** Public pages that render without the app chrome or the onboarding gate. */
const BARE = ["/"];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const mode = useMeta<string>("mode");
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (mode === undefined && !UNGATED.includes(pathname) && !BARE.includes(pathname)) router.replace("/welcome");
  }, [mode, pathname, router]);

  useEffect(() => installNavDirection(), []);

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

  // Quick add: a fresh launch of the installed app lands on /home (start_url); jump to Add when enabled.
  // sessionStorage marks the launch so this only happens once, not on every visit to Home.
  useEffect(() => {
    if (mode === null || mode === undefined) return;
    let launched = false;
    try {
      launched = sessionStorage.getItem("kaban:launched") === "1";
      sessionStorage.setItem("kaban:launched", "1");
    } catch {}
    if (launched || pathname !== "/home") return;
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!standalone) return;
    Promise.all([getMeta<boolean>("launchToAdd"), getMeta<string>("launchAccount")]).then(([on, acc]) => {
      if (on) router.replace(acc ? `/add?account=${encodeURIComponent(acc)}` : "/add");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
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
  const gated = mode === null || (mode === undefined && !UNGATED.includes(pathname));
  const showSidebar = !UNGATED.includes(pathname) && !gated;

  if (BARE.includes(pathname)) return <>{children}</>;

  return (
    <div className={cx("min-h-dvh", showSidebar && "lg:pl-64")}>
      <PrivacySync />
      <DialogHost />
      {showSidebar && <Sidebar pathname={pathname} />}

      <main className={cx("mx-auto max-w-md lg:px-6", NARROW.includes(pathname) ? "lg:max-w-2xl" : "lg:max-w-6xl", !hideNav ? "pb-nav lg:pb-16" : "lg:pb-16")}>{gated ? null : (
          // Keyed by path: each navigation exits the old page and enters the new one as a view transition.
          <ViewTransition key={pathname} enter="page-in" exit="page-out" default="none">
            {/* Opaque, full-height surface so a page never shows the previous one through it mid-transition. */}
            <div
              className={cx(
                "min-h-dvh bg-bg",
                // Desktop: modal-style routes (Add, New account) sit in a centered card instead of a full-height phone screen.
                MODAL_ROUTES.includes(pathname) && "lg:my-8 lg:min-h-0 lg:overflow-hidden lg:rounded-[2rem] lg:border lg:border-line lg:bg-white lg:shadow-soft",
              )}
            >
              {children}
            </div>
          </ViewTransition>
        )}</main>

      {!hideNav && !gated && <BottomNav pathname={pathname} onMore={() => setMoreOpen(true)} />}

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <nav className="grid grid-cols-3 gap-2 pb-2">
          {MORE.map(({ href, label, short, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMoreOpen(false)}
              className={cx(
                "flex min-h-24 flex-col items-center justify-center gap-2 rounded-3xl border border-line bg-white p-3 text-center text-sm font-medium active:scale-95",
                pathname.startsWith(href) && "border-brand-2 bg-pale",
              )}
            >
              <span className="grid size-10 place-items-center rounded-2xl bg-pale text-brand">
                <Icon className="size-5" />
              </span>
              <span className="whitespace-nowrap">{short ?? label}</span>
            </Link>
          ))}
        </nav>
      </Sheet>
    </div>
  );
}

function BottomNav({ pathname, onMore }: { pathname: string; onMore: () => void }) {
  const isActive = (href: string) => pathname.startsWith(href);
  const moreActive = MORE.some((m) => pathname.startsWith(m.href));
  return (
    <nav aria-label="Primary" style={{ viewTransitionName: "bottom-nav" }} className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md px-3 lg:hidden pb-[max(var(--safe-bottom),0.75rem)]">
      <div className="flex items-center justify-between rounded-[1.75rem] bg-ink/95 px-2 py-2 text-white shadow-float backdrop-blur-xl">
        {NAV.map(({ href, label, icon: Icon }) => {
          if (href === "/add")
            return (
              <Link key={href} href="/add" aria-label="Add transaction" className="-my-1 grid size-14 place-items-center rounded-[1.35rem] bg-brand-2 text-white shadow-float active:scale-95">
                <Icon className="size-7" strokeWidth={2.4} />
              </Link>
            );
          const active = isActive(href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className="relative flex min-h-12 min-w-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[0.68rem] font-medium">
              {active && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-2xl bg-white/10" transition={{ type: "spring", bounce: 0.25, duration: 0.45 }} />}
              <Icon className={cx("relative size-5", active ? "text-mint" : "text-white/60")} />
              <span className={cx("relative", active ? "text-white" : "text-white/60")}>{label}</span>
            </Link>
          );
        })}
        <button onClick={onMore} aria-label="More" className="relative flex min-h-12 min-w-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[0.68rem] font-medium">
          {moreActive && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-2xl bg-white/10" />}
          <LayoutGrid className={cx("relative size-5", moreActive ? "text-mint" : "text-white/60")} />
          <span className={cx("relative", moreActive ? "text-white" : "text-white/60")}>More</span>
        </button>
      </div>
    </nav>
  );
}

/** Desktop navigation: everything from the bottom bar and the More drawer in one column. */
function Sidebar({ pathname }: { pathname: string }) {
  const items = [...NAV.filter((n) => n.href !== "/add"), ...MORE];
  return (
    <aside data-nav-peer style={{ viewTransitionName: "sidebar" }} className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-white/70 px-4 py-6 backdrop-blur-xl lg:flex" aria-label="Primary">
      <Link href="/home" className="mb-6 flex items-center gap-2.5 px-2">
        <LogoMark size={34} />
        <span className="text-lg font-semibold tracking-tight">Kaban</span>
      </Link>
      <Link href="/add" className="mb-5 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-brand-2 font-medium text-white shadow-float active:scale-[0.98]">
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
                {active && <motion.span layoutId="side-pill" className="absolute inset-0 rounded-xl bg-pale" transition={{ type: "spring", bounce: 0.2, duration: 0.4 }} />}
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
