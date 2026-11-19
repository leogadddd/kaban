"use client";

import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui";
import { useSyncState } from "@/lib/sync";

/** Last onboarding screen: a warm hello before setting up the first account. */
export default function ReadyPage() {
  const router = useRouter();
  const { userId } = useSyncState();
  const reduce = useReducedMotion();
  const buzzed = useRef(false);

  useEffect(() => {
    if (buzzed.current || reduce) return;
    buzzed.current = true;
    navigator.vibrate?.([8, 40, 16]);
  }, [reduce]);

  return (
    <div className="pt-safe flex h-dvh flex-col overflow-hidden px-5 pb-[max(var(--safe-bottom),1rem)]">
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 mx-auto size-80 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(45_147_108/0.28),transparent)]" />
        <CofferIllustration reduce={!!reduce} />
      </div>

      <motion.div
        className="shrink-0 text-center"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="text-sm font-semibold tracking-wide text-brand uppercase">Mabuhay!</p>
        <h1 className="mt-2 text-[2rem] leading-[1.05] font-semibold tracking-tight text-balance [@media(max-height:640px)]:text-[1.7rem]">
          Welcome to Kaban
        </h1>
        <p className="mx-auto mt-2.5 max-w-xs text-[0.95rem] text-pretty text-ink-2">
          {userId ? "Your account is ready and syncing." : "You're all set."} Let&apos;s add your first account, so every peso has a home.
        </p>
      </motion.div>

      <motion.div className="mt-7 shrink-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.75 }}>
        <Button wrapperClassName="w-full" onClick={() => router.replace("/accounts/new?first=1")}>
          Let&apos;s get started <ArrowRight className="size-4" />
        </Button>
      </motion.div>
    </div>
  );
}

/** An open coffer with coins and cards rising out of it, drawn in the brand palette. */
function CofferIllustration({ reduce }: { reduce: boolean }) {
  const float = (delay: number, dist = 6) =>
    reduce ? {} : { animate: { y: [0, -dist, 0] }, transition: { duration: 3.2, delay, repeat: Infinity, ease: "easeInOut" as const } };

  return (
    <motion.svg
      viewBox="0 0 280 260"
      className="h-auto w-full max-w-[17rem] [@media(max-height:700px)]:max-w-[13rem]"
      aria-hidden="true"
      initial={reduce ? false : { opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 160, damping: 18 }}
    >
      {/* Ground shadow */}
      <ellipse cx="140" cy="236" rx="92" ry="10" fill="var(--color-ink)" opacity="0.12" />

      {/* Cards rising out of the coffer */}
      <motion.g {...float(0.2, 5)}>
        <g transform="rotate(-14 104 108)">
          <rect x="62" y="80" width="84" height="54" rx="10" fill="#1F2D27" />
          <rect x="72" y="92" width="22" height="7" rx="3.5" fill="#fff" opacity="0.35" />
          <rect x="72" y="114" width="40" height="7" rx="3.5" fill="#fff" opacity="0.7" />
        </g>
      </motion.g>
      <motion.g {...float(0.6, 7)}>
        <g transform="rotate(10 176 98)">
          <rect x="132" y="70" width="88" height="56" rx="10" fill="#2D936C" />
          <rect x="142" y="82" width="26" height="7" rx="3.5" fill="#fff" opacity="0.45" />
          <rect x="142" y="104" width="44" height="7" rx="3.5" fill="#fff" opacity="0.85" />
          <circle cx="204" cy="86" r="6" fill="#C9A227" opacity="0.9" />
        </g>
      </motion.g>

      {/* Coins */}
      {[
        { cx: 58, cy: 64, r: 13, d: 0 },
        { cx: 226, cy: 40, r: 10, d: 0.9 },
        { cx: 140, cy: 38, r: 15, d: 0.4 },
      ].map((c, i) => (
        <motion.g key={i} {...float(c.d, 8)}>
          <circle cx={c.cx} cy={c.cy} r={c.r} fill="#C9A227" />
          <circle cx={c.cx} cy={c.cy} r={c.r - 3.5} fill="none" stroke="#E4C35E" strokeWidth="2" />
          <text x={c.cx} y={c.cy + c.r * 0.36} textAnchor="middle" fontSize={c.r} fontWeight="700" fill="#8A6D12">
            ₱
          </text>
        </motion.g>
      ))}

      {/* Sparkles */}
      {[
        { x: 30, y: 120, s: 1, d: 0.3 },
        { x: 246, y: 128, s: 0.8, d: 1.1 },
        { x: 196, y: 22, s: 0.6, d: 0.7 },
      ].map((p, i) => (
        <motion.path
          key={i}
          d="M0-9C1-3 3-1 9 0 3 1 1 3 0 9-1 3-3 1-9 0-3-1-1-3 0-9Z"
          fill="var(--color-brand)"
          transform={`translate(${p.x} ${p.y}) scale(${p.s})`}
          initial={{ opacity: 0 }}
          animate={reduce ? { opacity: 0.8 } : { opacity: [0, 1, 0.3, 1] }}
          transition={reduce ? undefined : { duration: 2.6, delay: p.d, repeat: Infinity, repeatType: "mirror" }}
        />
      ))}

      {/* Coffer body */}
      <path d="M58 150h164v58a20 20 0 0 1-20 20H78a20 20 0 0 1-20-20v-58Z" fill="#176B4D" />
      <rect x="58" y="150" width="164" height="14" fill="#0F3D2E" opacity="0.35" />
      <rect x="84" y="164" width="8" height="64" fill="#0F3D2E" opacity="0.25" />
      <rect x="188" y="164" width="8" height="64" fill="#0F3D2E" opacity="0.25" />
      {/* Open lid, tipped back */}
      <path d="M62 150c0-22 16-40 36-40h84c20 0 36 18 36 40H62Z" fill="#2D936C" opacity="0.55" transform="rotate(-6 140 150)" />
      {/* Front rim */}
      <rect x="50" y="142" width="180" height="16" rx="8" fill="#2D936C" />
      {/* Leaf clasp */}
      <path d="M140 170c-9 6-11 17-4 25 2 2 6 2 8 0 7-8 5-19-4-25Z" fill="#E8F4EC" />
      <path d="M140 180v14" stroke="#176B4D" strokeWidth="2.4" strokeLinecap="round" />
    </motion.svg>
  );
}
