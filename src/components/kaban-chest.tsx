"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

// Fixed palette (same as the logo) so the chest reads as an illustration in both themes.
const WOOD = "#176B4D";
const WOOD_LIGHT = "#2D936C";
const WOOD_DEEP = "#0F3D2E";
const GOLD = "var(--color-gold)";
const GLOW = "#F6D365";

type Coin = { id: number; x: number; peak: number; delay: number; spin: number };

let coinSeq = 0;
function makeCoins(n: number): Coin[] {
  return Array.from({ length: n }, (_, i) => ({
    id: ++coinSeq,
    x: (i - (n - 1) / 2) * 13 + (Math.random() - 0.5) * 6,
    peak: 30 + Math.random() * 16,
    delay: 0.12 + i * 0.05,
    spin: (Math.random() - 0.5) * 360,
  }));
}

/**
 * The Kaban coffer next to Available funds. Peeks open now and then, pops coins
 * when the balance changes or when tapped, and stays locked while amounts are hidden.
 */
export function KabanChest({ amount, hidden, className }: { amount: number; hidden: boolean; className?: string }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [coins, setCoins] = useState<Coin[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const prev = useRef<number | null>(null);

  const burst = useCallback(
    (n = 4) => {
      if (reduce || hidden) return;
      clearTimeout(timer.current);
      setOpen(true);
      setCoins(makeCoins(n));
      timer.current = setTimeout(() => {
        setOpen(false);
        setCoins([]);
      }, 1100);
    },
    [reduce, hidden],
  );

  // First paint and every balance change get a little coin pop.
  useEffect(() => {
    const first = prev.current === null;
    if (!first && prev.current === amount) return;
    prev.current = amount;
    const t = setTimeout(() => burst(first ? 3 : 5), first ? 650 : 120);
    return () => clearTimeout(t);
  }, [amount, burst]);

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (hidden) {
      clearTimeout(timer.current);
      setOpen(false);
      setCoins([]);
    }
  }, [hidden]);

  const idle = !reduce && !hidden && !open;

  return (
    <button
      type="button"
      aria-label={hidden ? "Kaban chest, locked" : "Kaban chest"}
      onClick={() => {
        navigator.vibrate?.(hidden ? 6 : [8, 30, 12]);
        burst(6);
      }}
      className={`relative shrink-0 touch-manipulation select-none outline-none [-webkit-tap-highlight-color:transparent] active:scale-95 transition-transform ${className ?? ""}`}
    >
      <motion.svg
        viewBox="0 0 120 112"
        className="block h-full w-full overflow-visible"
        aria-hidden="true"
        animate={reduce ? undefined : { y: [0, -2.5, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Ground shadow */}
        <motion.ellipse
          cx="60"
          cy="104"
          rx="40"
          ry="5"
          fill={WOOD_DEEP}
          opacity="0.16"
          animate={reduce ? undefined : { rx: [40, 37, 40] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Sparkles */}
        {!reduce &&
          !hidden &&
          [
            { x: 12, y: 26, d: 0, s: 1 },
            { x: 106, y: 18, d: 1.3, s: 0.8 },
            { x: 100, y: 62, d: 2.4, s: 0.6 },
          ].map((p, i) => (
            <motion.path
              key={i}
              d={`M${p.x} ${p.y - 5 * p.s}Q${p.x} ${p.y} ${p.x + 5 * p.s} ${p.y}Q${p.x} ${p.y} ${p.x} ${p.y + 5 * p.s}Q${p.x} ${p.y} ${p.x - 5 * p.s} ${p.y}Q${p.x} ${p.y} ${p.x} ${p.y - 5 * p.s}Z`}
              fill={GOLD}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: [0, 1, 0], scale: [0.4, 1, 0.4], rotate: [0, 45, 90] }}
              transition={{ duration: 1.6, delay: p.d, repeat: Infinity, repeatDelay: 2.2, ease: "easeInOut" }}
            />
          ))}

        {/* Inner glow, visible when the lid lifts */}
        <motion.ellipse
          cx="60"
          cy="52"
          rx="36"
          ry="9"
          fill={GLOW}
          style={{ filter: "blur(3px)" }}
          animate={{ opacity: open ? 0.95 : 0 }}
          transition={{ duration: 0.25 }}
        />

        {/* Coins (behind the lid, in front of the glow) */}
        <AnimatePresence>
          {coins.map((c) => (
            <motion.g
              key={c.id}
              initial={{ x: 60, y: 54, opacity: 0, scale: 0.6 }}
              animate={{
                x: [60, 60 + c.x * 0.6, 60 + c.x],
                y: [54, 54 - c.peak, 54 - c.peak * 0.55],
                opacity: [0, 1, 1, 0],
                scale: [0.6, 1, 0.9],
                rotate: [0, c.spin],
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.85, delay: c.delay, ease: [0.22, 1, 0.36, 1], opacity: { duration: 0.85, delay: c.delay, times: [0, 0.15, 0.7, 1] } }}
            >
              <ellipse cx="0" cy="0" rx="6.5" ry="6.5" fill={GOLD} />
              <ellipse cx="0" cy="0" rx="4.3" ry="4.3" fill="none" stroke={WOOD_DEEP} strokeOpacity="0.25" strokeWidth="1.2" />
              <path d="M-1.6 -2.6h2.2a1.6 1.6 0 0 1 0 3.2h-2.2M-1.6 -2.6v5.4M-3 -0.9h5.4" stroke={WOOD_DEEP} strokeOpacity="0.45" strokeWidth="1" fill="none" strokeLinecap="round" />
            </motion.g>
          ))}
        </AnimatePresence>

        {/* Body */}
        <rect x="18" y="52" width="84" height="46" rx="8" fill={WOOD} />
        <path d="M22 66h76M22 81h76" stroke={WOOD_DEEP} strokeOpacity="0.35" strokeWidth="1.5" />
        <rect x="18" y="90" width="84" height="8" rx="4" fill={WOOD_DEEP} opacity="0.35" />
        <rect x="29" y="52" width="7" height="46" fill={GOLD} />
        <rect x="84" y="52" width="7" height="46" fill={GOLD} />
        <path d="M29 52h7v46h-7z" fill={WOOD_DEEP} opacity="0.12" />

        {/* Lid: outer group peeks on idle, inner group swings open on a burst */}
        <motion.g
          style={{ transformBox: "fill-box", transformOrigin: "100% 100%" }}
          animate={idle ? { rotate: [0, 0, -7, 0, -4, 0], y: [0, 0, -2, 0, -1, 0] } : { rotate: 0, y: 0 }}
          transition={idle ? { duration: 1.4, times: [0, 0.3, 0.5, 0.65, 0.8, 1], repeat: Infinity, repeatDelay: 5.5, delay: 2.5 } : { duration: 0.2 }}
        >
          <motion.g
            style={{ transformBox: "fill-box", transformOrigin: "100% 100%" }}
            animate={open ? { rotate: -24, y: -6 } : { rotate: 0, y: 0 }}
            transition={open ? { type: "spring", stiffness: 420, damping: 14 } : { type: "spring", stiffness: 380, damping: 22 }}
          >
            <path d="M15 55V45c0-12 19-19 45-19s45 7 45 19v10H15Z" fill={WOOD_LIGHT} />
            <path d="M24 34c8-4 20-6 36-6" stroke="#fff" strokeOpacity="0.28" strokeWidth="3" strokeLinecap="round" fill="none" />
            <path d="M29 30.5c2-0.5 4.6-1 7-1.3V55h-7V30.5ZM84 29.2c2.4 0.3 5 0.8 7 1.3V55h-7V29.2Z" fill={GOLD} />
            <rect x="13" y="50" width="94" height="7" rx="3.5" fill={WOOD_DEEP} />
          </motion.g>
        </motion.g>

        {/* Clasp with the leaf from the logo, or a padlock while hidden */}
        <rect x="50" y="52" width="20" height="22" rx="5" fill={GOLD} />
        <rect x="50" y="52" width="20" height="22" rx="5" fill="none" stroke={WOOD_DEEP} strokeOpacity="0.25" strokeWidth="1.2" />
        <AnimatePresence mode="wait" initial={false}>
          {hidden ? (
            <motion.g key="lock" initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: 0.18 }}>
              <path d="M56 61v-3a4 4 0 0 1 8 0v3" stroke={WOOD_DEEP} strokeWidth="2" fill="none" strokeLinecap="round" />
              <rect x="54" y="60.5" width="12" height="9" rx="2" fill={WOOD_DEEP} />
              <circle cx="60" cy="65" r="1.4" fill={GOLD} />
            </motion.g>
          ) : (
            <motion.g key="leaf" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} transition={{ duration: 0.18 }} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
              <path d="M60 56c-3.4 2.4-4.1 6.3-1.5 9.3 0.8 0.8 2 0.8 3 0 2.6-3 1.9-6.9-1.5-9.3Z" fill={WOOD_LIGHT} stroke={WOOD_DEEP} strokeWidth="1.2" />
              <path d="M60 59.5v6.5" stroke={WOOD_DEEP} strokeWidth="1.2" strokeLinecap="round" />
            </motion.g>
          )}
        </AnimatePresence>
      </motion.svg>
    </button>
  );
}
