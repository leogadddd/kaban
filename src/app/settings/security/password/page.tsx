"use client";

import { KeyRound, MailCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { CodeField, FormError } from "@/components/auth-ui";
import { Button, ButtonLink, Card, PageHeader } from "@/components/ui";
import { friendlyAuthError, listAuthenticators, sendPasswordReset, useSyncState, verifySignInCode } from "@/lib/sync";

/**
 * Change password = the reset-password email flow, so a new password is only ever set from a link sent to
 * the account's inbox. With two-factor on, the authenticator code is checked first.
 */
export default function ChangePasswordPage() {
  const { email, userId, phase } = useSyncState();
  const signedIn = !!userId && phase !== "mfa";
  const [twoFactor, setTwoFactor] = useState<boolean | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    listAuthenticators()
      .then((f) => setTwoFactor(f.length > 0))
      .catch(() => setTwoFactor(false));
  }, [signedIn]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    setError(undefined);
    try {
      if (twoFactor) await verifySignInCode(code);
      await sendPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(friendlyAuthError(err));
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Change password" back="/settings/security" privacy={false} />
      <div className="space-y-4 px-4 pb-6">
        {!signedIn ? (
          <p className="rounded-2xl bg-pale p-3 text-sm text-ink-2">Sign in to change your password.</p>
        ) : sent ? (
          <Card className="space-y-4 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-pale text-brand"><MailCheck className="size-6" /></span>
            <div>
              <p className="font-semibold">Check your email</p>
              <p className="mt-1 text-sm text-ink-3">
                We sent a link to <b className="text-ink">{email}</b>. Open it to choose your new password.
              </p>
            </div>
            <ButtonLink href="/settings/security" variant="secondary" wrapperClassName="grid">Done</ButtonLink>
          </Card>
        ) : (
          <Card>
            <form onSubmit={submit} className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-pale text-brand"><KeyRound className="size-5" /></span>
                <p className="text-sm text-ink-2">
                  {twoFactor
                    ? "Enter the code from your authenticator app. Then we'll email you a link to set a new password."
                    : <>We&apos;ll email <b className="text-ink">{email}</b> a link to set a new password.</>}
                </p>
              </div>
              {twoFactor && <CodeField value={code} onChange={setCode} />}
              <FormError>{error}</FormError>
              <Button type="submit" wrapperClassName="w-full" disabled={busy || twoFactor === null || (twoFactor && code.length !== 6)}>
                {busy ? "Sending…" : twoFactor ? "Verify and send link" : "Send reset link"}
              </Button>
            </form>
          </Card>
        )}
      </div>
    </>
  );
}
