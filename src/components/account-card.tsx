"use client";

import { AnimatePresence, motion, type PanInfo } from "motion/react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CreditCard, Landmark, Wallet } from "lucide-react";
import { useState } from "react";
import type { AccountBalance } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { cx } from "./ui";

const TYPE_META = {
  cash: { label: "Cash", icon: Wallet },
  debit: { label: "Debit", icon: Landmark },
  credit: { label: "Credit card", icon: CreditCard },
};

function textOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.62 ? "#17241D" : "#FFFFFF";
}

export function AccountCard({ b, className }: { b: AccountBalance; className?: string }) {
  const a = b.account;
  const meta = TYPE_META[a.type];
  const Icon = meta.icon;
  const fg = textOn(a.color);
  const credit = a.type === "credit";
  const util = b.utilisation ?? 0;
  const s = formatMoney(b.balance);
  const dot = s.lastIndexOf(".");
  return (
    <div
      className={cx("card-grain relative flex h-48 flex-col justify-between overflow-hidden rounded-[var(--radius-card)] p-5 shadow-float", className)}
      style={{ background: `linear-gradient(140deg, ${a.color}, color-mix(in oklab, ${a.color} 70%, black))`, color: fg }}
    >
      <div className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full opacity-20" style={{ background: fg }} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-sm font-medium opacity-75">{meta.label}{a.issuer ? ` · ${a.issuer}` : ""}</p>
          <p className="text-lg font-semibold tracking-tight">{a.name}</p>
        </div>
        <span className="grid size-10 place-items-center rounded-2xl" style={{ background: `color-mix(in oklab, ${fg} 16%, transparent)` }}>
          <Icon className="size-5" />
        </span>
      </div>
      <div className="relative">
        <p className="text-xs font-medium tracking-wide uppercase opacity-70">{credit ? "Outstanding" : "Balance"}</p>
        <p className="num text-[2.1rem] leading-none font-semibold">
          {s.slice(0, dot)}
          <span className="text-xl opacity-60">{s.slice(dot)}</span>
        </p>
        {credit ? (
          <div className="mt-3 flex items-center gap-3 text-xs">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: `color-mix(in oklab, ${fg} 22%, transparent)` }}>
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, util)}%`, background: fg }} />
            </div>
            <span className="num opacity-80">{formatMoney(b.available ?? 0, { compact: true })} left</span>
            {a.last4 && <span className="num opacity-80">•••• {a.last4}</span>}
          </div>
        ) : (
          a.last4 && <p className="num mt-3 text-xs opacity-75">•••• {a.last4}</p>
        )}
      </div>
    </div>
  );
}

/** Horizontally swipeable stack of account cards, with buttons and dots for non-gesture navigation. */
export function CardStack({ items, linkTo = true }: { items: AccountBalance[]; linkTo?: boolean }) {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const n = items.length;
  if (n === 0) return null;
  const i = ((index % n) + n) % n;

  const go = (d: number) => {
    setDir(d);
    setIndex((v) => v + d);
  };
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -70 || info.velocity.x < -500) go(1);
    else if (info.offset.x > 70 || info.velocity.x > 500) go(-1);
  };

  const behind = Math.min(2, n - 1);
  return (
    <div>
      <div className="relative" style={{ paddingTop: behind * 14 }}>
        {/* peeking cards behind */}
        {Array.from({ length: behind }, (_, k) => {
          const depth = behind - k;
          const item = items[(i + depth) % n];
          return (
            <motion.div
              key={`behind-${item.account.id}-${depth}`}
              className="absolute inset-x-0"
              style={{ top: (behind - depth) * 14, zIndex: 10 - depth }}
              initial={false}
              animate={{ scale: 1 - depth * 0.06, opacity: 1 - depth * 0.25 }}
              aria-hidden="true"
            >
              <AccountCard b={item} />
            </motion.div>
          );
        })}
        <div className="relative z-20">
          <AnimatePresence initial={false} custom={dir} mode="popLayout">
            <motion.div
              key={items[i].account.id + ":" + index}
              custom={dir}
              variants={{
                enter: (d: number) => ({ x: d > 0 ? 60 : -60, opacity: 0, scale: 0.96 }),
                center: { x: 0, opacity: 1, scale: 1 },
                exit: (d: number) => ({ x: d > 0 ? -260 : 260, opacity: 0, rotate: d > 0 ? -6 : 6 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              drag={n > 1 ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.7}
              onDragEnd={onDragEnd}
              whileTap={{ cursor: "grabbing" }}
              className="touch-pan-y"
            >
              {linkTo ? (
                <Link href={`/accounts/view?id=${items[i].account.id}`} draggable={false} aria-label={`Open ${items[i].account.name}`}>
                  <AccountCard b={items[i]} />
                </Link>
              ) : (
                <AccountCard b={items[i]} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      {n > 1 && (
        <div className="mt-3 flex items-center justify-between px-1">
          <button onClick={() => go(-1)} className="grid size-11 place-items-center rounded-full border border-line bg-white active:scale-95" aria-label="Previous account">
            <ChevronLeft className="size-5" />
          </button>
          <div className="flex gap-1.5" aria-label={`Account ${i + 1} of ${n}`}>
            {items.map((it, k) => (
              <span key={it.account.id} className={cx("h-1.5 rounded-full transition-all", k === i ? "w-5 bg-brand" : "w-1.5 bg-line")} />
            ))}
          </div>
          <button onClick={() => go(1)} className="grid size-11 place-items-center rounded-full border border-line bg-white active:scale-95" aria-label="Next account">
            <ChevronRight className="size-5" />
          </button>
        </div>
      )}
    </div>
  );
}
