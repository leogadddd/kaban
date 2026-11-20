"use client";

import { useSyncExternalStore } from "react";
import { cycleInfo } from "./billing";
import { fromISO, todayISO } from "./dates";
import type { Account } from "./types";

// Local notifications only: Kaban has no push server, so reminders are checked on this device when the
// app is opened (or brought back to the front) and shown through the service worker when there is one.
// iPhone/iPad only allow web notifications for apps added to the Home Screen (iOS 16.4+).

export type NotifySupport = "ok" | "needs-install" | "unsupported";
export type NotifyPermission = NotificationPermission | "unsupported";

const PREFS_KEY = "kaban:notify";
const SENT_KEY = "kaban:notify-sent";
const EVENT = "kaban-notify";

export interface NotifyPrefs {
  /** Remind before a credit card payment is due. */
  cardDue: boolean;
  /** How many days ahead to start reminding. */
  daysBefore: number;
}

const DEFAULTS: NotifyPrefs = { cardDue: false, daysBefore: 3 };
export const REMIND_DAYS = [1, 3, 5, 7] as const;

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function standalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

export function notifySupport(): NotifySupport {
  if (typeof window === "undefined") return "unsupported";
  if (!("Notification" in window)) return isIOS() && !standalone() ? "needs-install" : "unsupported";
  return "ok";
}

function readPermission(): NotifyPermission {
  return typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported";
}

let rawPrefs: string | null | undefined;
let prefs: NotifyPrefs = DEFAULTS;

export function getNotifyPrefs(): NotifyPrefs {
  let next: string | null = null;
  try {
    next = localStorage.getItem(PREFS_KEY);
  } catch {}
  if (next === rawPrefs) return prefs;
  rawPrefs = next;
  try {
    const p = next ? (JSON.parse(next) as Partial<NotifyPrefs>) : {};
    prefs = {
      cardDue: typeof p.cardDue === "boolean" ? p.cardDue : DEFAULTS.cardDue,
      daysBefore: REMIND_DAYS.includes(p.daysBefore as never) ? p.daysBefore! : DEFAULTS.daysBefore,
    };
  } catch {
    prefs = DEFAULTS;
  }
  return prefs;
}

export function setNotifyPrefs(patch: Partial<NotifyPrefs>) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...getNotifyPrefs(), ...patch }));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  window.addEventListener("focus", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
    window.removeEventListener("focus", cb);
  };
}

export const useNotifyPrefs = () => useSyncExternalStore(subscribe, getNotifyPrefs, () => DEFAULTS);
export const useNotifyPermission = () => useSyncExternalStore(subscribe, readPermission, () => "default" as NotifyPermission);

export async function requestNotifyPermission(): Promise<NotifyPermission> {
  if (!("Notification" in window)) return "unsupported";
  const result = await Notification.requestPermission();
  window.dispatchEvent(new Event(EVENT));
  return result;
}

/** Show a notification. Android Chrome only allows it through a service worker; desktop accepts either. */
export async function showNotification(title: string, body: string, tag?: string) {
  if (readPermission() !== "granted") return false;
  const options: NotificationOptions = { body, tag, icon: "/icon-192.png", badge: "/icon-192.png" };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, options);
      return true;
    }
  } catch {}
  try {
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}

function sentSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SENT_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

/**
 * Remind about credit card payments due within the chosen window, once per card per due date.
 * Amounts are never put in the notification: it can show on a locked screen.
 */
export async function checkCardDueReminders(accounts: Account[]) {
  const p = getNotifyPrefs();
  if (!p.cardDue || readPermission() !== "granted") return;
  const today = todayISO();
  const sent = sentSet();
  for (const a of accounts) {
    if (a.archived || a.type !== "credit" || !a.closingDay) continue;
    const due = cycleInfo(a, today).upcomingDue;
    const days = Math.round((fromISO(due).getTime() - fromISO(today).getTime()) / 86_400_000);
    if (days < 0 || days > p.daysBefore) continue;
    const key = `${a.id}:${due}`;
    if (sent.has(key)) continue;
    const when = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
    if (await showNotification(`${a.name} payment due ${when}`, "Open Kaban to see what to pay.", key)) sent.add(key);
  }
  try {
    // Keep the list short: only recent keys matter.
    localStorage.setItem(SENT_KEY, JSON.stringify([...sent].slice(-100)));
  } catch {}
}
