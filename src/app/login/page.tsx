"use client";

import { HardDrive } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useLeaveWhenSignedIn } from "@/components/auth-redirect";
import { AuthScreen, EmailField, FormError, PasswordField } from "@/components/auth-ui";
import { Button } from "@/components/ui";
import { resetOnboarded } from "@/lib/first-run";
import { useMeta } from "@/lib/hooks";
import { friendlyAuthError, signIn } from "@/lib/sync";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const router = useRouter();
  useLeaveWhenSignedIn();
  // The device's own (no-account) ledger, if one was started before.
  const localMode = useMeta<string>("mode");

  function continueLocally() {
    if (typeof localMode === "string") {
      router.replace("/home");
      return;
    }
    // Welcome is a first-run screen; clear the flag so the shell doesn't bounce it back here.
    resetOnboarded();
    router.replace("/welcome");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const { needsCode } = await signIn(email.trim(), password);
      // Password accepted: the code is its own step, before Kaban opens the account.
      if (needsCode) router.replace("/login/verify");
    } catch (err) {
      setError(friendlyAuthError(err));
      setBusy(false);
    }
  }

  return (
    <AuthScreen
      title="Welcome back"
      subtitle="Sign in to sync Kaban across your devices."
      footer={
        <>
          New to Kaban? <Link href="/signup" replace className="font-medium text-brand">Create an account</Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <EmailField value={email} onChange={setEmail} autoFocus />
        <PasswordField
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          action={<Link href="/forgot-password" className="font-medium text-brand">Forgot?</Link>}
        />
        <FormError>{error}</FormError>
        <Button type="submit" wrapperClassName="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs text-ink-3" aria-hidden="true">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>
      <Button type="button" variant="secondary" wrapperClassName="w-full" onClick={continueLocally}>
        <HardDrive className="size-4" /> Use without an account
      </Button>
    </AuthScreen>
  );
}
