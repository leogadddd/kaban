"use client";

import { useEffect } from "react";
import { useLedger } from "@/lib/hooks";
import { checkCardDueReminders, useNotifyPermission, useNotifyPrefs } from "@/lib/notify";

/** Checks for due-date reminders when the app opens or returns to the front. Renders nothing. */
export function Reminders() {
  const { ready, accounts } = useLedger();
  const prefs = useNotifyPrefs();
  const permission = useNotifyPermission();

  useEffect(() => {
    if (!ready || !prefs.cardDue || permission !== "granted") return;
    void checkCardDueReminders(accounts);
    const onVisible = () => document.visibilityState === "visible" && void checkCardDueReminders(accounts);
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [ready, accounts, prefs, permission]);

  return null;
}
