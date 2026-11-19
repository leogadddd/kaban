"use client";

import { ShieldCheck, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { CodeField } from "@/components/auth-ui";
import { confirmDialog } from "@/components/dialog";
import { Button, Card, cx } from "@/components/ui";
import { confirmAuthenticator, friendlyAuthError, listAuthenticators, removeAuthenticator, startAuthenticatorEnrollment } from "@/lib/sync";

/** Authenticator-app (TOTP) second factor for the signed-in account. Lives in Settings → Account. */
export function TwoFactorCard() {
  const [factors, setFactors] = useState<{ id: string }[] | null>(null);
  const [enroll, setEnroll] = useState<{ factorId: string; qr: string; secret: string }>();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const refresh = () => listAuthenticators().then(setFactors).catch(() => setFactors([]));
  useEffect(() => {
    void refresh();
  }, []);

  const on = !!factors?.length;

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold"><Smartphone className="size-4 text-brand" /> Two-factor sign-in</p>
        {factors && <span className={cx("rounded-full px-2.5 py-1 text-xs font-medium", on ? "bg-pale text-brand" : "bg-line/60 text-ink-3")}>{on ? "On" : "Off"}</span>}
      </div>
      <p className="text-sm text-ink-3">Ask for a code from an authenticator app (Google Authenticator, 1Password, Authy…) whenever this account signs in on a new device.</p>

      {enroll ? (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(undefined);
            try {
              await confirmAuthenticator(enroll.factorId, code);
              setEnroll(undefined);
              setCode("");
              await refresh();
            } catch (err) {
              setError(friendlyAuthError(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enroll.qr} alt="QR code for your authenticator app" className="mx-auto size-44 rounded-2xl border border-line bg-white p-2" />
          <p className="text-center text-xs text-ink-3">
            Scan it, or enter this key: <span className="num break-all text-ink-2 select-all">{enroll.secret}</span>
          </p>
          <CodeField value={code} onChange={setCode} error={error} />
          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="secondary" onClick={() => setEnroll(undefined)}>Cancel</Button>
            <Button type="submit" disabled={busy || code.length !== 6}>Enable two-factor sign-in</Button>
          </div>
        </form>
      ) : on ? (
        <Button
          variant="secondary"
          wrapperClassName="w-full"
          disabled={busy}
          onClick={async () => {
            if (
              !(await confirmDialog({
                title: "Turn off two-factor sign-in?",
                body: "Signing in will only need your password again.",
                confirmLabel: "Disable two-factor sign-in",
                danger: true,
              }))
            )
              return;
            setBusy(true);
            try {
              for (const f of factors!) await removeAuthenticator(f.id);
              await refresh();
            } catch (err) {
              setError(friendlyAuthError(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          Disable two-factor sign-in
        </Button>
      ) : (
        <Button
          variant="secondary"
          wrapperClassName="w-full"
          disabled={busy || !factors}
          onClick={async () => {
            setBusy(true);
            setError(undefined);
            try {
              setEnroll(await startAuthenticatorEnrollment());
            } catch (err) {
              setError(friendlyAuthError(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <ShieldCheck className="size-4" /> Set up authenticator app
        </Button>
      )}
      {error && !enroll && <p className="px-1 text-sm text-expense" role="alert">{error}</p>}
    </Card>
  );
}
