"use client";

import { Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AuthScreen, CodeField } from "@/components/auth-ui";
import { Button } from "@/components/ui";
import { friendlyAuthError, signOut, useSyncState, verifySignInCode } from "@/lib/sync";

export default function VerifyPage() {
  const router = useRouter();
  const { userId, phase } = useSyncState();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  // Arrived without a half-finished sign-in (or already finished it): nothing to verify here.
  useEffect(() => {
    if (phase === "signed-out") router.replace("/login");
    else if (userId && phase !== "mfa") router.replace("/home");
  }, [userId, phase, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await verifySignInCode(code);
    } catch (err) {
      setError(friendlyAuthError(err));
      setCode("");
      setBusy(false);
    }
  }

  return (
    <AuthScreen
      title="Two-step verification"
      subtitle="Open your authenticator app and enter the 6-digit code for Kaban."
      back="/login"
      onBack={async () => {
        // Leaving the code step cancels the sign-in instead of keeping a half-signed session.
        await signOut();
        router.replace("/login");
      }}
      footer={
        <button
          type="button"
          className="min-h-10 font-medium text-brand"
          onClick={async () => {
            await signOut();
            router.replace("/login");
          }}
        >
          Use a different account
        </button>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-pale text-brand">
          <Smartphone className="size-6" />
        </div>
        <CodeField value={code} onChange={setCode} error={error} />
        <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Verify"}</Button>
      </form>
    </AuthScreen>
  );
}
