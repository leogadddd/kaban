"use client";

import { HapticButton, HapticLink } from "@/components/haptic-button";
import { Check, MailCheck } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useLeaveWhenSignedIn } from "@/components/auth-redirect";
import { AuthScreen, EmailField, FormError, PasswordField } from "@/components/auth-ui";
import { BirthdayField, birthdayISO } from "@/components/birthday-field";
import { checkAge } from "@/lib/age";
import { Button } from "@/components/ui";
import { rememberSignupAgreement } from "@/lib/legal";
import { friendlyAuthError, resendConfirmation, signUp } from "@/lib/sync";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [sentTo, setSentTo] = useState<string>();
  const [resent, setResent] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [birth, setBirth] = useState({ y: "", m: "", d: "" });
  const [guardian, setGuardian] = useState(false);
  const birthday = birthdayISO(birth);
  const age = birthday ? checkAge(birthday) : undefined;
  // A brand-new account ends onboarding on the welcome screen.
  useLeaveWhenSignedIn("/ready");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    if (password.length < 8) return setError("Use at least 8 characters for your password.");
    if (password !== confirm) return setError("The passwords don't match.");
    if (!age || age === "invalid") return setError("Enter your birthday.");
    if (age === "too-young") return setError("Kaban accounts are for people 13 and older.");
    if (age === "needs-guardian" && !guardian) return setError("Because you're under 18, a parent or guardian needs to agree too.");
    if (!agreed) return setError("Agree to the Terms of Service and Privacy Policy to create an account.");
    rememberSignupAgreement();
    setBusy(true);
    try {
      const { needsConfirm } = await signUp(email.trim(), password, { birthday, guardianConsent: age === "needs-guardian" && guardian });
      if (needsConfirm) {
        setSentTo(email.trim());
        setBusy(false);
        return;
      }
    } catch (err) {
      setError(friendlyAuthError(err));
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <AuthScreen
        title="Check your email"
        subtitle={<>We sent a confirmation link to <b className="text-ink">{sentTo}</b>. Open it, then sign in.</>}
        back="/signup"
        footer={
          <>
            Wrong email?{" "}
            <HapticButton type="button" className="font-medium text-brand" onClick={() => setSentTo(undefined)}>Start over</HapticButton>
          </>
        }
      >
        <div className="space-y-4">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-pale text-brand">
            <MailCheck className="size-6" />
          </div>
          <HapticLink href="/login" replace wrapperClassName="w-full" className="flex min-h-12 items-center justify-center rounded-2xl bg-brand font-medium text-on-brand shadow-soft">
            I&apos;ve confirmed — sign in
          </HapticLink>
          <Button
            variant="ghost"
            wrapperClassName="w-full"
            disabled={resent}
            onClick={async () => {
              try {
                await resendConfirmation(sentTo);
                setResent(true);
              } catch (err) {
                setError(friendlyAuthError(err));
              }
            }}
          >
            {resent ? "Sent again" : "Resend the email"}
          </Button>
          <FormError>{error}</FormError>
          <p className="text-center text-xs text-ink-3">On iPhone the link opens in Safari. Come back to the Kaban app and sign in there.</p>
        </div>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title="Create your account"
      subtitle="Back up your records and use Kaban on more than one device."
      footer={
        <>
          Already have an account? <Link href="/login" replace className="font-medium text-brand">Sign in</Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <EmailField value={email} onChange={setEmail} autoFocus />
        <PasswordField value={password} onChange={setPassword} autoComplete="new-password" hint="At least 8 characters." />
        <PasswordField label="Confirm password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        <BirthdayField parts={birth} onChange={setBirth} hint="Kept private on your profile. Never shown to family members." />
        {age === "too-young" && (
          <p role="alert" className="rounded-2xl bg-gold/15 p-3 text-sm text-ink-2">
            Kaban accounts are for people 13 and older. You can still use Kaban on this device without an account, with a parent or guardian&apos;s permission.
          </p>
        )}
        {age === "needs-guardian" && (
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-gold/40 bg-gold/10 p-3.5 text-sm text-ink-2">
            <span className="relative mt-0.5 grid size-5 shrink-0 place-items-center">
              <input
                type="checkbox"
                checked={guardian}
                onChange={(e) => setGuardian(e.target.checked)}
                className="peer size-5 appearance-none rounded-md border-2 border-line bg-field checked:border-brand checked:bg-brand"
              />
              <Check className="pointer-events-none absolute size-3.5 text-on-brand opacity-0 peer-checked:opacity-100" strokeWidth={3} />
            </span>
            <span>
              <b className="text-ink">I&apos;m under 18.</b> My parent or guardian has read the Terms of Service and Privacy Policy and agrees to me creating this account.
            </span>
          </label>
        )}
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface p-3.5 text-sm text-ink-2">
          <span className="relative mt-0.5 grid size-5 shrink-0 place-items-center">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="peer size-5 appearance-none rounded-md border-2 border-line bg-field checked:border-brand checked:bg-brand"
            />
            <Check className="pointer-events-none absolute size-3.5 text-on-brand opacity-0 peer-checked:opacity-100" strokeWidth={3} />
          </span>
          <span>
            I agree to the <Link href="/terms" className="font-medium text-brand underline-offset-2 hover:underline">Terms of Service</Link> and{" "}
            <Link href="/privacy" className="font-medium text-brand underline-offset-2 hover:underline">Privacy Policy</Link>.
          </span>
        </label>
        <FormError>{error}</FormError>
        <Button type="submit" wrapperClassName="w-full" disabled={busy || age === "too-young"}>{busy ? "Creating account…" : "Create account"}</Button>
        <p className="text-center text-xs text-ink-3">Records already on this device are added to your account.</p>
      </form>
    </AuthScreen>
  );
}
