"use client";

import { HapticButton } from "@/components/haptic-button";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef } from "react";

const COLORS = ["var(--color-brand)", "var(--color-brand-2)", "var(--color-income)", "var(--color-gold)", "var(--color-mint)", "var(--color-expense)"];

type Piece = { x: number; y: number; rot: number; delay: number; w: number; h: number; color: string; round: boolean; dur: number };

function makePieces(n: number): Piece[] {
  return Array.from({ length: n }, (_, i) => {
    // Burst outward in a full circle, biased upward, then fall with gravity.
    const angle = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const dist = 110 + Math.random() * 120;
    return {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist * 0.8 - 40,
      rot: (Math.random() - 0.5) * 720,
      delay: 0.32 + Math.random() * 0.08,
      w: 6 + Math.random() * 5,
      h: 8 + Math.random() * 8,
      color: COLORS[i % COLORS.length],
      round: i % 4 === 0,
      dur: 1.4 + Math.random() * 0.6,
    };
  });
}

/** Full-screen "saved" celebration: ring pops in, check draws itself, confetti bursts. */
export function SaveSuccess({ title, amount, subtitle, onDone }: { title: string; amount?: string; subtitle?: string; onDone: () => void }) {
  const reduce = useReducedMotion();
  const pieces = useMemo(() => makePieces(36), []);
  const playedHaptic = useRef(false);

  useEffect(() => {
    if (playedHaptic.current) return;
    playedHaptic.current = true;
    if (!reduce) navigator.vibrate?.([10, 45, 24]);
  }, [reduce]);

  const ease = [0.22, 1, 0.36, 1] as const;

  return (
    <HapticButton
      type="button"
      wrapperClassName="grid"
      aria-label="Go to Home"
      onClick={onDone}
      className="relative grid min-h-dvh place-items-center overflow-hidden lg:min-h-96"
    >
      <p className="sr-only" role="status">Transaction saved</p>
      <div className="flex flex-col items-center">
        <div className="relative grid size-28 place-items-center">
          {/* Ripples */}
          {!reduce &&
            [0, 1].map((i) => (
              <motion.span
                key={i}
                aria-hidden="true"
                className="absolute inset-0 rounded-full border-2 border-income"
                initial={{ scale: 0.6, opacity: 0.6 }}
                animate={{ scale: 2.1 + i * 0.4, opacity: 0 }}
                transition={{ duration: 1.1, delay: 0.3 + i * 0.18, ease: "easeOut" }}
              />
            ))}

          {/* Confetti */}
          {!reduce &&
            pieces.map((p, i) => (
              <motion.span
                key={i}
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2"
                style={{ width: p.w, height: p.round ? p.w : p.h, marginLeft: -p.w / 2, marginTop: -p.h / 2, background: p.color, borderRadius: p.round ? 999 : 2 }}
                initial={{ x: 0, y: 0, rotate: 0, opacity: 0, scale: 0.4 }}
                animate={{
                  x: [0, p.x, p.x * 1.15],
                  y: [0, p.y, p.y + 260],
                  rotate: [0, p.rot * 0.5, p.rot],
                  opacity: [1, 1, 0],
                  scale: [0.4, 1, 0.9],
                }}
                transition={{ duration: p.dur, delay: p.delay, times: [0, 0.3, 1], ease: ["easeOut", "easeIn"] }}
              />
            ))}

          {/* Filled disc */}
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-income shadow-lg shadow-income/30"
            initial={reduce ? false : { scale: 0 }}
            animate={{ scale: [0, 1.12, 1] }}
            transition={{ duration: 0.5, ease, times: [0, 0.7, 1] }}
          />

          {/* Self-drawing check */}
          <svg viewBox="0 0 52 52" className="relative size-14 text-on-brand" aria-hidden="true">
            <motion.path
              d="M14 27 l8 8 l16 -18"
              fill="none"
              stroke="currentColor"
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.4, delay: 0.32, ease: "easeOut" }}
            />
          </svg>
        </div>

        <motion.div
          className="mt-8 text-center"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.55, ease }}
        >
          <p className="text-xl font-bold text-ink">{title}</p>
          {amount && <p className="mt-1 text-3xl font-extrabold tabular-nums tracking-tight text-ink">{amount}</p>}
          {subtitle && <p className="mt-1 max-w-64 truncate text-sm text-ink-2">{subtitle}</p>}
        </motion.div>

        <motion.p
          className="mt-10 text-xs text-ink-3"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.5 }}
        >
          Tap anywhere to continue
        </motion.p>
      </div>
    </HapticButton>
  );
}
