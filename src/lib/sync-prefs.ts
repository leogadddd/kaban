"use client";

import { useSyncExternalStore } from "react";

/** How often background sync runs. Device-only (localStorage); "Sync now" and pull-to-refresh always work. */
export interface SyncPrefs {
  /** Master switch for background sync. Off: only manual syncs. */
  auto: boolean;
  /** Minutes between background checks while the app is open. */
  intervalMin: number;
  /** Upload a change a moment after it's saved, instead of waiting for the next check. */
  uploadNow: boolean;
  /** Check for changes when the app is opened or brought back to the front. */
  onOpen: boolean;
}

export const SYNC_INTERVALS = [1, 5, 15, 30] as const;
const KEY = "kaban:sync-prefs";
const EVENT = "kaban-sync-prefs";
const DEFAULTS: SyncPrefs = { auto: true, intervalMin: 1, uploadNow: true, onOpen: true };

let raw: string | null | undefined;
let cached: SyncPrefs = DEFAULTS;

export function getSyncPrefs(): SyncPrefs {
  let next: string | null = null;
  try {
    next = localStorage.getItem(KEY);
  } catch {}
  if (next === raw) return cached;
  raw = next;
  try {
    const parsed = next ? (JSON.parse(next) as Partial<SyncPrefs>) : {};
    const intervalMin = SYNC_INTERVALS.includes(parsed.intervalMin as never) ? parsed.intervalMin! : DEFAULTS.intervalMin;
    cached = {
      auto: typeof parsed.auto === "boolean" ? parsed.auto : DEFAULTS.auto,
      uploadNow: typeof parsed.uploadNow === "boolean" ? parsed.uploadNow : DEFAULTS.uploadNow,
      onOpen: typeof parsed.onOpen === "boolean" ? parsed.onOpen : DEFAULTS.onOpen,
      intervalMin,
    };
  } catch {
    cached = DEFAULTS;
  }
  return cached;
}

export function setSyncPrefs(patch: Partial<SyncPrefs>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...getSyncPrefs(), ...patch }));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export function onSyncPrefsChange(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useSyncPrefs(): SyncPrefs {
  return useSyncExternalStore(onSyncPrefsChange, getSyncPrefs, () => DEFAULTS);
}
