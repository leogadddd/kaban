"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  CalendarClock,
  CloudOff,
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
import { useMeta, useOnline } from "@/lib/hooks";
import { cx, Sheet } from "./ui";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/accounts", label: "Accounts", icon: WalletCards },
  { href: "/add", label: "Add", icon: Plus },
  { href: "/activity", label: "Activity", icon: List },
] as const;

const MORE = [
  { href: "/people", label: "People", icon: Users },
  { href: "/owed", label: "Who Owes Me", icon: HandCoins },
  { href: "/instalments", label: "Instalments", icon: CalendarClock },
  { href: "/payments", label: "Payment History", icon: History },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/sync", label: "Sync & Backup", icon: RefreshCw },
  { href: "/settings", label: "Settings", icon: Settings },
];

const HIDE_NAV = ["/welcome", "/add", "/accounts/new"];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const mode = useMeta<string>("mode");
  const online = useOnline();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (mode === undefined && pathname !== "/welcome") router.replace("/welcome");
  }, [mode, pathname, router]);

  useEffect(() => {
    requestPersistence();
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
  const gated = mode === null || (mode === undefined && pathname !== "/welcome");

  return (
    <div className="mx-auto min-h-dvh max-w-md">
      <AnimatePresence>
        {!online && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            className="pointer-events-none fixed inset-x-0 top-[max(var(--safe-top),0.5rem)] z-40 flex justify-center"
            role="status"
          >
            <span className="flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-white shadow-float">
              <CloudOff className="size-3.5" /> Offline — everything still saves on this device
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <main className={cx(!hideNav && "pb-nav")}>{gated ? null : children}</main>

      {!hideNav && !gated && <BottomNav pathname={pathname} onMore={() => setMoreOpen(true)} />}

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <nav className="grid grid-cols-3 gap-2 pb-2">
          {MORE.map(({ href, label, icon: Icon }) => (
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
              {label}
            </Link>
          ))}
        </nav>
      </Sheet>
    </div>
  );
}

function BottomNav({ pathname, onMore }: { pathname: string; onMore: () => void }) {
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const moreActive = MORE.some((m) => pathname.startsWith(m.href));
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md px-3 pb-[max(var(--safe-bottom),0.75rem)]">
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
