"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthScreen, EmailField, FormError } from "@/components/auth-ui";
import { Button } from "@/components/ui";
import { friendlyAuthError, sendPasswordReset } from "@/lib/sync";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await sendPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthScreen
      title={sent ? "Check your email" : "Reset your password"}
      subtitle={
        sent ? (
          <>If <b className="text-ink">{email.trim()}</b> has a Kaban account, a reset link is on its way.</>
        ) : (
          "Enter your account's email and we'll send you a link to choose a new password."
        )
      }
      back="/login"
      footer={<Link href="/login" replace className="font-medium text-brand">Back to sign in</Link>}
    >
      {sent ? (
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-pale text-brand">
          <MailCheck className="size-6" />
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <EmailField value={email} onChange={setEmail} autoFocus />
          <FormError>{error}</FormError>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</Button>
        </form>
      )}
    </AuthScreen>
  );
}
