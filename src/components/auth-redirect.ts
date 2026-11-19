"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSyncState } from "@/lib/sync";

/**
 * Once a session is fully signed in (second factor done, if any), leave the auth flow for the app.
 * Also catches the email-confirmation link, which lands on /login with a fresh session in the URL.
 */
export function useLeaveWhenSignedIn(to = "/home") {
  const router = useRouter();
  const { userId, phase } = useSyncState();
  useEffect(() => {
    if (!userId) return;
    if (phase === "mfa") {
      router.replace("/login/verify");
      return;
    }
    router.replace(to);
  }, [userId, phase, router, to]);
}
