"use client";

import { animate, motion, useMotionValue, useMotionValueEvent, useTransform } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { syncNow } from "@/lib/sync";
import { ChestArt } from "./chest-art";
import { cx } from "./ui";

/** How far (px, after resistance) the page must be pulled before letting go refreshes. */
const THRESHOLD = 76;
/** Where the page rests while the refresh runs. */
const HOLD = 64;
const MAX = 128;
/** Keep the loading animation up long enough to read as "refreshed", even when sync is instant or local-only. */
const MIN_SPIN = 900;
/** How long the chest beams before tucking away again. */
const DONE_MS = 450;
const HAPTIC_MS = 8;

/**
 * Touch-only pull-to-refresh, Reddit style: drag down from the top and the page slides down to reveal
 * the Kaban mascot. Its lid lifts with the pull until its eyes peek out, it beams once you're past the
 * line, hops while the cloud sync runs, then smiles and tucks away. (The page keeps its native rubber-band scroll; only a downward pull from the very top is taken over here.)
 */
export function PullToRefresh({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const pull = useMotionValue(0);
  const [armed, setArmed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [done, setDone] = useState(false);
  const busy = useRef(false);
  const chest = useRef<SVGSVGElement>(null);

  const top = useTransform(pull, (p) => Math.max(0, p / 2 - 22));
  const opacity = useTransform(pull, [0, 24, 52], [0, 0.5, 1]);
  const scale = useTransform(pull, [0, THRESHOLD], [0.55, 1]);
  const tilt = useTransform(pull, [0, THRESHOLD, MAX], [-8, 0, 6]);

  // The lid follows the finger directly (SVG attributes, no re-render per frame).
  useMotionValueEvent(pull, "change", (p) => {
    // While the page is off its rest position, frosted headers skip their blur (see globals.css):
    // re-blurring them on every finger move is what costs frames, and at 85% opacity it's not missed.
    const root = document.documentElement;
    if (p > 0) root.dataset.pulling ??= "";
    else delete root.dataset.pulling;
    if (busy.current) return;
    const progress = Math.min(1, p / THRESHOLD);
    const lift = progress * progress * 13 + Math.max(0, p - THRESHOLD) * 0.06;
    chest.current?.querySelector(".kc-lid")?.setAttribute("transform", `translate(0 ${-lift.toFixed(2)}) rotate(${(progress * 3).toFixed(2)} 107 57)`);
  });

  useEffect(() => {
    if (!enabled) return;
    let startX = 0;
    let startY = 0;
    let tracking = false;
    let pulling = false;
    let wasArmed = false;
    let requestedVibration = false;

    const reset = () => {
      tracking = pulling = false;
      if (wasArmed) setArmed((wasArmed = false));
    };

    const onStart = (e: TouchEvent) => {
      if (busy.current || e.touches.length !== 1 || window.scrollY > 0) return;
      const target = e.target as Element | null;
      // Sheets/dialogs, the nav bar and anything inside its own scrolled box keep their own touches.
      if (target?.closest("[role=dialog], nav, [data-no-pull]") || document.querySelector("[role=dialog][aria-modal=true]")) return;
      for (let el = target; el && el !== document.body; el = el.parentElement) if (el.scrollTop > 0) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
      pulling = false;
      requestedVibration = false;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (!pulling) {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) return reset(); // horizontal swipe (Money/Credit pager)
        if (dy < -4 || window.scrollY > 0) return reset(); // scrolling the page instead
        // Claim a downward pull at the top on its first move, before the native bounce/refresh takes it.
        if (dy > 0 && dy >= Math.abs(dx) && e.cancelable) e.preventDefault();
        if (dy < 10) return;
        pulling = true;
        pull.stop(); // a spring-back still in flight would fight the finger
        startY = e.touches[0].clientY - pull.get() / 0.55; // pick up where the page is, without a jump
      }
      if (e.cancelable) e.preventDefault();
      const d = Math.max(0, e.touches[0].clientY - startY);
      // Rubber band: easy up to the line, heavier past it.
      const knee = THRESHOLD / 0.55;
      const p = Math.min(MAX, d < knee ? d * 0.55 : THRESHOLD + (d - knee) * 0.22);
      pull.set(p);
      const nowArmed = p >= THRESHOLD;
      if (nowArmed !== wasArmed) {
        wasArmed = nowArmed;
        setArmed(nowArmed);
        if (nowArmed) requestedVibration = navigator.vibrate?.(HAPTIC_MS) ?? false;
      }
    };

    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      const go = pulling && pull.get() >= THRESHOLD;
      reset();
      if (!go) {
        animate(pull, 0, { type: "spring", stiffness: 420, damping: 38 });
        return;
      }
      // A first pull can reach the threshold before the browser grants activation on touchend.
      if (e.type === "touchend" && !requestedVibration) navigator.vibrate?.(HAPTIC_MS);
      busy.current = true;
      chest.current?.querySelector(".kc-lid")?.removeAttribute("transform"); // hand the lid to the CSS loading animation
      setRefreshing(true);
      animate(pull, HOLD, { type: "spring", stiffness: 400, damping: 30 });
      const minSpin = new Promise((r) => setTimeout(r, MIN_SPIN));
      void Promise.all([syncNow().catch(() => false), minSpin])
        .then(() => {
          setRefreshing(false);
          setDone(true);
          // Hold the lid up so the smile shows.
          chest.current?.querySelector(".kc-lid")?.setAttribute("transform", "translate(0 -13) rotate(3 107 57)");
          return new Promise((r) => setTimeout(r, DONE_MS));
        })
        .then(() => {
          busy.current = false;
          animate(pull, 0, { type: "spring", stiffness: 360, damping: 34 }).then(() => setDone(false));
        });
    };

    // A non-passive touchmove makes every scroll wait on the main thread, so only hold it while the page
    // is at the top (the one place a pull can start). Scrolled down, touches go straight to the compositor.
    let blocking = false;
    const syncBlocking = () => {
      const atTop = window.scrollY <= 0;
      if (atTop === blocking) return;
      blocking = atTop;
      if (atTop) document.addEventListener("touchmove", onMove, { passive: false });
      else if (!pulling) document.removeEventListener("touchmove", onMove);
    };
    syncBlocking();
    window.addEventListener("scroll", syncBlocking, { passive: true });

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      delete document.documentElement.dataset.pulling;
      window.removeEventListener("scroll", syncBlocking);
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled, pull]);

  if (!enabled) return <>{children}</>;

  return (
    <>
      <motion.div
        role="status"
        aria-hidden={!refreshing}
        aria-label={refreshing ? "Refreshing" : undefined}
        style={{ y: top, opacity }}
        className="pointer-events-none fixed inset-x-0 top-[var(--safe-top)] flex justify-center lg:hidden"
      >
        <motion.div
          style={{ scale, rotate: refreshing || done ? 0 : tilt }}
          className={cx("grid size-13 place-items-center rounded-full bg-surface shadow-float ring-1 ring-line", armed && !refreshing && "ptr-pop")}
        >
          <ChestArt
            svgRef={chest}
            effects={false}
            eyes={done || (armed && !refreshing) ? "happy" : "open"}
            className={cx("mt-1 size-[38px]", refreshing && "ptr-hop ptr-busy")}
          />
        </motion.div>
      </motion.div>
      {/* Painted after the (non-z-indexed) indicator, so it covers it until pulled. The page slides down with the finger; at rest the transform is `none`, so fixed/sticky children behave normally. */}
      <motion.div style={{ y: pull }} className="relative min-h-dvh bg-bg">
        {children}
      </motion.div>
    </>
  );
}
