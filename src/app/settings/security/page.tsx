"use client";

import { KeyRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { FormError, PasswordField } from "@/components/auth-ui";
import { SettingsAction, SettingsGroup } from "@/components/settings-ui";
import { TwoFactorCard } from "@/components/two-factor";
import { Button, Card, PageHeader } from "@/components/ui";
import { friendlyAuthError, setNewPassword, useSyncState } from "@/lib/sync";

export default function SecurityPage() {
  const sync = useSyncState();
  const signedIn = !!sync.userId && sync.phase !== "mfa";

  return (
    <>
      <PageHeader title="Security" back="/settings" privacy={false} />
      <div className="space-y-6 px-4 pb-6">
        {signedIn ? (
          <>
            <TwoFactorCard />
            <ChangePassword />
          </>
        ) : (
          <p className="rounded-2xl bg-pale p-3 text-sm text-ink-2">Sign in to manage two-factor sign-in and your password.</p>
        )}
      </div>
    </>
  );
}

function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await setNewPassword(password);
      setPassword("");
      setOpen(false);
      setDone(true);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  if (!open)
    return (
      <SettingsGroup footer={done ? "Password updated." : undefined}>
        <SettingsAction onClick={() => { setOpen(true); setDone(false); }} icon={KeyRound} label="Change password" />
      </SettingsGroup>
    );

  return (
    <Card>
      <form onSubmit={submit} className="space-y-4">
        <p className="flex items-center gap-2 font-semibold"><KeyRound className="size-4 text-brand" /> Change password</p>
        <PasswordField label="New password" value={password} onChange={setPassword} autoComplete="new-password" />
        <FormError>{error}</FormError>
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" disabled={busy || password.length < 8}>{busy ? "Saving…" : "Save"}</Button>
        </div>
      </form>
    </Card>
  );
}
