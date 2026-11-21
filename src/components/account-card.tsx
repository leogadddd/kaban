"use client";

import { HapticButton } from "@/components/haptic-button";
import { AnimatePresence, motion, type PanInfo } from "motion/react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CreditCard, Landmark, Wallet } from "lucide-react";
import { useState, type CSSProperties } from "react";
import type { AccountBalance } from "@/lib/finance";
import { bankFor } from "@/lib/banks";
import { formatMoney } from "@/lib/money";
import { useMoney } from "@/lib/privacy";
import { BankLogo } from "./bank-logo";
import { ArchivedBadge, cx } from "./ui";

const TYPE_META = {
  cash: { label: "Cash", icon: Wallet },
  debit: { label: "Debit", icon: Landmark },
  credit: { label: "Credit card", icon: CreditCard },
};

export function AccountCard({ b, className }: { b: AccountBalance; className?: string }) {
  const a = b.account;
  const meta = TYPE_META[a.type];
  const Icon = meta.icon;
  const bank = a.type === "cash" ? undefined : bankFor(a);
  const style: CSSProperties & { "--account-color": string } = { "--account-color": a.color };
  const credit = a.type === "credit";
  const util = b.utilisation ?? 0;
  const { fmt, hidden } = useMoney();
  const s = formatMoney(b.balance);
  const dot = s.lastIndexOf(".");
  return (
    <div
      className={cx("flex h-48 flex-col justify-between overflow-hidden rounded-[var(--radius-card)] border border-line p-5 shadow-soft", a.archived ? "border-dashed bg-pale/50 text-ink-2" : "account-card-tinted bg-surface", className)}
      style={style}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium">{bank?.kind === "paylater" ? "Pay later" : meta.label}{a.issuer ? ` · ${a.issuer}` : ""}{a.archived && <ArchivedBadge />}</p>
          <p className="text-lg font-semibold tracking-tight">{a.name}</p>
        </div>
        {bank ? (
          <BankLogo bank={bank} size={40} className={cx("shadow-sm", a.archived && "opacity-50")} />
        ) : (
          <span className={cx("grid size-10 place-items-center rounded-2xl", a.archived && "opacity-50")} style={{ background: "color-mix(in srgb, var(--account-color) 28%, var(--color-surface))" }}>
            <Icon className="size-5" />
          </span>
        )}
      </div>
      <div>
        <p className="text-xs font-medium tracking-wide uppercase opacity-70">{credit ? "Outstanding" : "Balance"}</p>
        <p className="num amount text-[2.1rem] leading-none font-semibold" aria-label={hidden ? "Balance hidden" : s}>
          {hidden ? (
            <>
              ₱<span className="tracking-[0.12em] opacity-70">••••••</span>
            </>
          ) : (
            <>
              {s.slice(0, dot)}
              <span className="text-xl opacity-60">{s.slice(dot)}</span>
            </>
          )}
        </p>
        {credit ? (
          <div className="mt-3 flex items-center gap-3 text-xs">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/20">
              <div className="h-full rounded-full bg-ink" style={{ width: `${Math.min(100, util)}%` }} />
            </div>
            <span className="num amount opacity-80">{fmt(b.available ?? 0, { compact: true })} left</span>
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
  const n = items.length;
  if (n === 0) return null;
  const i = ((index % n) + n) % n;

  const go = (d: number) => {
    setIndex((v) => v + d);
  };
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -70 || info.velocity.x < -500) go(1);
    else if (info.offset.x > 70 || info.velocity.x > 500) go(-1);
  };

  const behind = Math.min(2, n - 1);
  const PEEK = 14;
  // One deck: every visible card keeps its key (account id) and only moves up/down and scales to its
  // new depth, so cards never slide sideways. Next sends the front card to the back; previous pulls
  // the back card to the front.
  const visible = items
    .map((b, k) => ({ b, depth: (k - i + n) % n }))
    .filter((c) => c.depth <= behind)
    .sort((a, b) => b.depth - a.depth);
  const at = (depth: number) => ({ x: 0, y: -depth * PEEK, scale: 1 - depth * 0.06, opacity: depth === 0 ? 1 : 1 - depth * 0.25, rotate: 0 });
  return (
    <div>
      <div className="relative" style={{ height: `calc(12rem + ${behind * PEEK}px)` }}>
        <AnimatePresence initial={false}>
          {visible.map(({ b, depth }) => {
            const front = depth === 0;
            return (
              <motion.div
                key={b.account.id}
                className={cx("absolute inset-x-0", front && "touch-pan-y")}
                style={{ top: behind * PEEK, zIndex: 20 - depth }}
                initial={{ ...at(behind + 1), opacity: 0 }}
                animate={at(depth)}
                exit={{ ...at(behind + 1), opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 32 }}
                drag={front && n > 1 ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.7}
                onDragEnd={front ? onDragEnd : undefined}
                aria-hidden={!front || undefined}
                inert={!front || undefined}
              >
                {front && linkTo ? (
                  <Link href={`/accounts/view?id=${b.account.id}`} draggable={false} aria-label={`Open ${b.account.name}`}>
                    <AccountCard b={b} />
                  </Link>
                ) : (
                  <AccountCard b={b} />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      {n > 1 && (
        <div className="mt-3 flex items-center justify-between px-1">
          <HapticButton onClick={() => go(-1)} className="grid size-11 place-items-center rounded-full border border-line bg-surface active:scale-95" aria-label="Previous account">
            <ChevronLeft className="size-5" />
          </HapticButton>
          <div className="flex gap-1.5" aria-label={`Account ${i + 1} of ${n}`}>
            {items.map((it, k) => (
              <span key={it.account.id} className={cx("h-1.5 rounded-full transition-all", k === i ? "w-5 bg-brand" : "w-1.5 bg-line")} />
            ))}
          </div>
          <HapticButton onClick={() => go(1)} className="grid size-11 place-items-center rounded-full border border-line bg-surface active:scale-95" aria-label="Next account">
            <ChevronRight className="size-5" />
          </HapticButton>
        </div>
      )}
    </div>
  );
}
