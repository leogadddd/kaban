"use client";

import { useSyncExternalStore } from "react";
import { formatMoney } from "./money";

// In-memory mirror of the stored privacy setting so every amount can read it synchronously
// (no per-component database query). PrivacySync in the app shell keeps it up to date.
let on = false;
const subs = new Set<() => void>();

export function setPrivacyOn(v: boolean) {
  if (v === on) return;
  on = v;
  subs.forEach((f) => f());
}

export function usePrivacyOn(): boolean {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => on,
    () => false,
  );
}

const DOTS = "••••••";

/**
 * Masked amount: always the same length, so the number of digits doesn't leak.
 * The sign is kept when asked for (money in vs out), the value never is.
 */
export function maskMoney(minor: number, opts?: { sign?: boolean; compact?: boolean }): string {
  const sign = minor < 0 ? "−" : opts?.sign && minor > 0 ? "+" : "";
  return `${sign}₱${opts?.compact ? "••••" : DOTS}`;
}

/** formatMoney that respects privacy mode. */
export function useMoney() {
  const hidden = usePrivacyOn();
  return {
    hidden,
    fmt: (minor: number, opts?: { sign?: boolean; compact?: boolean }) => (hidden ? maskMoney(minor, opts) : formatMoney(minor, opts)),
  };
}
