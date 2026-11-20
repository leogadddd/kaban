"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { RotateCcw } from "lucide-react";
import { FormError } from "@/components/auth-ui";
import { Mascot } from "@/components/mascot";
import { Button } from "@/components/ui";
import { LogoMark } from "@/lib/logo";
import { friendlyAuthError, recoverAccount, signOut, useSyncState } from "@/lib/sync";

const DAY = 86_400_000;
// The clock, read only in the browser: the page is prerendered. Minute precision keeps the snapshot stable.
const noop = () => () => {};
const minuteNow = () => Math.floor(Date.now() / 60_000);

/** A signed-in account inside its 30-day deletion grace period: recover it, or leave it to be erased. */
export default function AccountDeletedPage() {
  const router = useRouter();
  const { phase, email, deletion } = useSyncState();
  const [busy, setBusy] = useState<"recover" | "leave">();
  const [error, setError] = useState<string>();
  const now = useSyncExternalStore(noop, minuteNow, () => 0) * 60_000;

  // Not (or no longer) scheduled for deletion: nothing to do here.
  useEffect(() => {
    if (phase !== "deleted" && phase !== "starting" && !busy) router.replace("/home");
  }, [phase, busy, router]);

  if (phase !== "deleted" || !deletion) return null;

  const purge = new Date(deletion.purgeAfter);
  const daysLeft = Math.max(0, Math.ceil((purge.getTime() - now) / DAY));
  const date = purge.toLocaleDateString("en-PH", { day: "numeric", month: "long", year: "numeric" });

  async function recover() {
    setBusy("recover");
    setError(undefined);
    try {
      await recoverAccount();
      router.replace("/home");
    } catch (e) {
      setError(friendlyAuthError(e));
      setBusy(undefined);
    }
  }

  async function leave() {
    setBusy("leave");
    await signOut();
    router.replace("/");
  }

  return (
    <div className="pt-safe flex min-h-dvh flex-col px-5 pb-[max(var(--safe-bottom),1.25rem)] lg:justify-center lg:py-12">
      <div className="lg:rounded-[2rem] lg:border lg:border-line lg:bg-surface lg:p-8 lg:shadow-soft">
        <div className="mt-4 flex items-center gap-2 lg:mt-0">
          <LogoMark size={28} />
          <span className="font-semibold tracking-tight">Kaban</span>
        </div>

        <Mascot action="worried" className="mx-auto mt-8 block h-28 w-[7.5rem]" />

        <h1 className="mt-6 text-center text-[1.9rem] leading-tight font-semibold tracking-tight">Your account is set to be deleted</h1>
        <p className="mt-2 text-center text-[0.95rem] text-ink-2">
          {email ? <b className="text-ink">{email}</b> : "This account"} and everything in it will be erased for good on <b className="text-ink">{date}</b>
          {daysLeft > 0 ? ` (${daysLeft} ${daysLeft === 1 ? "day" : "days"} left)` : " (any moment now)"}. Until then, you can bring it all back.
        </p>

        <ul className="mt-6 space-y-2 rounded-2xl bg-pale/70 p-4 text-sm text-ink-2">
          <li>Recovering restores your records, profile and families exactly as they were.</li>
          <li>Quick add tokens were turned off when you asked to delete. Make new ones in Settings after recovering.</li>
          <li>Nothing syncs from your devices while deletion is pending.</li>
        </ul>

        <div className="mt-6 space-y-2.5">
          <Button wrapperClassName="w-full" className="w-full" onClick={recover} disabled={!!busy}>
            <RotateCcw className="size-4" /> {busy === "recover" ? "Recovering…" : "Recover my account"}
          </Button>
          <Button variant="ghost" wrapperClassName="w-full" className="w-full" onClick={leave} disabled={!!busy}>
            {busy === "leave" ? "Signing out…" : "Keep it deleted and sign out"}
          </Button>
          <FormError>{error}</FormError>
        </div>

        <p className="mt-6 text-center text-xs text-ink-3">
          See how we handle deletion in our <Link href="/privacy#retention" className="font-medium text-brand">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
