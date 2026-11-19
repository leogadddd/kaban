"use client";

import { animate, motion, useMotionValue, useMotionValueEvent, useTransform } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { syncNow } from "@/lib/sync";
import { cx } from "./ui";

/** How far (px, after resistance) the page must be pulled before letting go refreshes. */
const THRESHOLD = 76;
/** Where the page rests while the refresh runs. */
const HOLD = 64;
const MAX = 128;
/** Keep the loading animation up long enough to read as "refreshed", even when sync is instant or local-only. */
const MIN_SPIN = 900;
const RING = 2 * Math.PI * 21;
const HAPTIC_MS = 8;

/**
 * Touch-only pull-to-refresh, Reddit style: drag down from the top and the page slides down to reveal
 * the Kaban coffer. Its lid opens and a ring fills as you pull; let go past the line and the coffer hops
 * while the cloud sync runs. (The page keeps its native rubber-band scroll; only a downward pull from the very top is taken over here.)
 */
export function PullToRefresh({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const pull = useMotionValue(0);
  const [armed, setArmed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const busy = useRef(false);
  const lid = useRef<SVGPathElement>(null);
  const ring = useRef<SVGCircleElement>(null);

  const top = useTransform(pull, (p) => Math.max(0, p / 2 - 22));
  const opacity = useTransform(pull, [0, 24, 52], [0, 0.5, 1]);
  const scale = useTransform(pull, [0, THRESHOLD], [0.55, 1]);
  const tilt = useTransform(pull, [0, THRESHOLD, MAX], [-8, 0, 6]);

  // Lid and ring follow the finger directly (SVG attributes, no re-render per frame).
  useMotionValueEvent(pull, "change", (p) => {
    if (busy.current) return;
    const progress = Math.min(1, p / THRESHOLD);
    lid.current?.setAttribute("transform", `rotate(${-progress * 34} 14 30)`);
    ring.current?.setAttribute("stroke-dashoffset", String(RING * (1 - progress)));
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
      lid.current?.removeAttribute("transform"); // hand the lid to the CSS loading animation
      setRefreshing(true);
      animate(pull, HOLD, { type: "spring", stiffness: 400, damping: 30 });
      const minSpin = new Promise((r) => setTimeout(r, MIN_SPIN));
      void Promise.all([syncNow().catch(() => false), minSpin]).then(() => {
        setRefreshing(false);
        busy.current = false;
        animate(pull, 0, { type: "spring", stiffness: 360, damping: 34 });
      });
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
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
        <motion.div style={{ scale, rotate: refreshing ? 0 : tilt }} className={cx("relative size-11", armed && !refreshing && "ptr-pop")}>
          <svg viewBox="0 0 44 44" className={cx("absolute inset-0 size-11 -rotate-90 text-brand-2", refreshing && "ptr-ring-spin")} aria-hidden="true">
            <circle cx="22" cy="22" r="21" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2" />
            <circle
              ref={ring}
              cx="22"
              cy="22"
              r="21"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={refreshing ? `${RING * 0.28} ${RING}` : RING}
              strokeDashoffset={refreshing ? 0 : RING}
            />
          </svg>
          <svg viewBox="0 0 64 64" className={cx("absolute inset-[5px] size-[34px]", refreshing && "ptr-hop")} aria-hidden="true">
            <rect width="64" height="64" rx="16" fill="#176B4D" />
            <path ref={lid} className={cx(refreshing && "ptr-lid")} d="M14 28c0-6.6 5.4-12 12-12h12c6.6 0 12 5.4 12 12v2H14v-2Z" fill="#E8F4EC" opacity="0.65" />
            <rect x="14" y="30" width="36" height="20" rx="5" fill="#E8F4EC" />
            <g className={cx(refreshing && "ptr-leaf")}>
              <path d="M32 26c-4.5 3.2-5.5 8.4-2 12.4 1 1.1 2.6 1.1 4 0 3.5-4 2.5-9.2-2-12.4Z" fill="#2D936C" stroke="#176B4D" strokeWidth="1.6" />
              <path d="M32 31v8" stroke="#176B4D" strokeWidth="1.6" strokeLinecap="round" />
            </g>
          </svg>
        </motion.div>
      </motion.div>
      {/* Painted after the (non-z-indexed) indicator, so it covers it until pulled. The page slides down with the finger; at rest the transform is `none`, so fixed/sticky children behave normally. */}
      <motion.div style={{ y: pull }} className="relative min-h-dvh bg-bg">
        {children}
      </motion.div>
    </>
  );
}
