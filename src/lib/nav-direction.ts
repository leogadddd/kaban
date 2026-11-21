"use client";

// Decides how a page change should animate, iOS-style:
//   forward / back  – push and pop between levels (list → detail)
//   up / down       – present and dismiss modal screens (Add, New account)
//   tab             – soft crossfade between bottom-nav tabs
// The direction is written to <html data-nav> right before Next.js starts the navigation;
// CSS in globals.css picks the matching ::view-transition animation.

export type NavDirection = "forward" | "back" | "up" | "down" | "tab";

const TABS = ["/home", "/accounts", "/people", "/owed", "/activity", "/payments", "/instalments", "/family", "/analytics"];
const MODALS = ["/add", "/accounts/new", "/welcome"];
const MORE = ["/sync", "/settings"];
const PAYDAY_SETTINGS = "/settings/payday";

function depth(path: string): number {
  if (TABS.includes(path)) return 1;
  if (MORE.includes(path)) return 2;
  return path.split("/").filter(Boolean).length + 1;
}

export function navDirection(from: string, to: string): NavDirection | null {
  if (from === to) return null;
  if (MODALS.includes(to)) return "up";
  if (MODALS.includes(from)) return "down";
  // Payday is a detail screen when opened from Settings or Safe to Spend.
  if (to === PAYDAY_SETTINGS) return "forward";
  if (from === PAYDAY_SETTINGS && to === "/tools/safe-to-spend") return "back";
  if (TABS.includes(from) && TABS.includes(to)) return "tab";
  const a = depth(from);
  const b = depth(to);
  if (b > a) return "forward";
  if (b < a) return "back";
  return "tab";
}

let lastPath = "";
let clearTimer: ReturnType<typeof setTimeout> | undefined;

export function setNavDirection(dir: NavDirection | null) {
  const root = document.documentElement;
  if (dir) root.dataset.nav = dir;
  else delete root.dataset.nav;
  // Clear afterwards so an untagged navigation (e.g. router.replace) falls back to a plain fade. The clock
  // restarts when the new page commits (notePath), so a navigation that waits on a slow or dead network
  // still animates in its direction; the long backstop only covers a tap that never navigates.
  scheduleClear(dir ? 5000 : 0);
}

function scheduleClear(ms: number) {
  clearTimeout(clearTimer);
  if (ms) clearTimer = setTimeout(() => delete document.documentElement.dataset.nav, ms);
}

/** Track the current path; call from the app shell whenever it changes. */
export function notePath(path: string) {
  const moved = lastPath !== "" && path !== lastPath;
  lastPath = path;
  // The page just committed: its transition is starting now, so give it the usual window to finish.
  if (moved && document.documentElement.dataset.nav) scheduleClear(900);
}

/** Install listeners once: link taps (capture phase, before Next.js handles them) and history pops. */
export function installNavDirection() {
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a || a.target === "_blank" || a.origin !== location.origin) return;
    // Sidebar / tab-bar items are peers, not a hierarchy: crossfade instead of pushing.
    const peer = a.closest("[data-nav-peer]") && !MODALS.includes(a.pathname);
    setNavDirection(peer && a.pathname !== location.pathname ? "tab" : navDirection(location.pathname, a.pathname));
  };
  const onPop = () => setNavDirection(navDirection(lastPath, location.pathname));
  document.addEventListener("click", onClick, true);
  window.addEventListener("popstate", onPop);
  return () => {
    document.removeEventListener("click", onClick, true);
    window.removeEventListener("popstate", onPop);
  };
}

/**
 * Animate a history pop (router.back). Next.js applies popstate outside a React transition, so
 * <ViewTransition> can't see it; instead we snapshot the whole page ourselves and wait for the
 * new route to commit before letting the browser capture the "after" state.
 */
export function animatedBack(go: () => void, dir: "back" | "down" = "back") {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!document.startViewTransition || reduce) return go();
  const root = document.documentElement;
  const before = location.href;
  root.dataset.vtRoot = dir;
  const t = document.startViewTransition(
    () =>
      new Promise<void>((resolve) => {
        go();
        const start = performance.now();
        // Timers, not rAF: rendering is suspended while the update callback is pending.
        const wait = () => {
          if (location.href !== before || performance.now() - start > 700) setTimeout(resolve, 40); // let React commit the new route
          else setTimeout(wait, 16);
        };
        wait();
      }),
  );
  t.finished.finally(() => delete root.dataset.vtRoot);
}
