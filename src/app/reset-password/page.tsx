"use client";

import { HapticLink } from "@/components/haptic-button";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AuthScreen, FormError, PasswordField } from "@/components/auth-ui";
import { Button } from "@/components/ui";
import { friendlyAuthError, setNewPassword, useSyncState } from "@/lib/sync";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { userId, recovering, phase } = useSyncState();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [expired, setExpired] = useState(false);
  const ready = recovering && !!userId;

  // The reset link signs the user in via the URL; if no session shows up, the link was used or expired.
  useEffect(() => {
    if (ready) return;
    const t = setTimeout(() => setExpired(true), 4000);
    return () => clearTimeout(t);
  }, [ready]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    if (password.length < 8) return setError("Use at least 8 characters for your password.");
    if (password !== confirm) return setError("The passwords don't match.");
    setBusy(true);
    try {
      await setNewPassword(password);
      router.replace(phase === "mfa" ? "/login/verify" : "/home");
    } catch (err) {
      setError(friendlyAuthError(err));
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <AuthScreen
        title={expired ? "Link expired" : "Checking your link…"}
        subtitle={expired ? "This reset link has already been used or is too old. Request a new one." : undefined}
        back="/login"
      >
        {expired && (
          <HapticLink href="/forgot-password" replace wrapperClassName="w-full" className="flex min-h-12 items-center justify-center rounded-2xl bg-brand font-medium text-on-brand shadow-soft">
            Send a new link
          </HapticLink>
        )}
      </AuthScreen>
    );
  }

  return (
    <AuthScreen title="Choose a new password" subtitle="You'll use it to sign in on all your devices." back="/login">
      <form onSubmit={submit} className="space-y-4">
        <PasswordField label="New password" value={password} onChange={setPassword} autoComplete="new-password" hint="At least 8 characters." />
        <PasswordField label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        <FormError>{error}</FormError>
        <Button type="submit" wrapperClassName="w-full" disabled={busy}>{busy ? "Saving…" : "Save password"}</Button>
      </form>
    </AuthScreen>
  );
}
