"use client";

import { useEffect } from "react";
import { useLedgerDatabase } from "@/lib/db";
import { useLedger } from "@/lib/hooks";
import { noteCardsDue } from "@/lib/inbox";
import { checkCardDueReminders, useNotifyPermission, useNotifyPrefs } from "@/lib/notify";

/**
 * Checks due dates when the app opens or returns to the front: always into the Notifications tab, and as
 * a system notification too when payment reminders are on and allowed. Renders nothing.
 */
export function Reminders() {
  const db = useLedgerDatabase();
  const { ready, accounts } = useLedger();
  const prefs = useNotifyPrefs();
  const permission = useNotifyPermission();

  useEffect(() => {
    if (!ready || !db) return;
    const check = () => {
      void noteCardsDue(db, accounts, prefs.daysBefore).catch(() => {});
      if (prefs.cardDue && permission === "granted") void checkCardDueReminders(accounts);
    };
    check();
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [ready, db, accounts, prefs, permission]);

  return null;
}
