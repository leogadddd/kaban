"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useLeaveWhenSignedIn } from "@/components/auth-redirect";
import { AuthScreen, EmailField, FormError, PasswordField } from "@/components/auth-ui";
import { Button } from "@/components/ui";
import { finishSignIn, friendlyAuthError, signIn } from "@/lib/sync";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  useLeaveWhenSignedIn();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const { mfa } = await signIn(email.trim(), password);
      if (mfa) {
        router.replace("/login/verify");
        return;
      }
      await finishSignIn();
      router.replace("/home");
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
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
      </form>
    </AuthScreen>
  );
}
