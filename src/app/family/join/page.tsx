"use client";

import { CheckCircle2, Clock, LogIn, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { FamilyMark } from "@/components/family-ui";
import { noticeToast } from "@/components/undo-toast";
import { Button, ButtonLink, Card, Field, inputCls, Loading, PageHeader } from "@/components/ui";
import { parseInviteCode, previewInvite, requestJoin, type InvitePreview } from "@/lib/family";
import { useOnline } from "@/lib/hooks";
import { useSyncState } from "@/lib/sync";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Join />
    </Suspense>
  );
}

function Join() {
  const params = useSearchParams();
  const router = useRouter();
  const { userId } = useSyncState();
  const code = parseInviteCode(params.get("code") ?? "");
  const [typed, setTyped] = useState("");

  if (!userId)
    return (
      <>
        <PageHeader title="Join a family" back="/family" privacy={false} />
        <div className="space-y-4 px-4">
          <Card className="text-sm text-ink-2">Sign in or create an account first, then open the invite link again.</Card>
          <div className="grid grid-cols-2 gap-2">
            <ButtonLink href="/signup" wrapperClassName="grid"><UserPlus className="size-4" /> Sign up</ButtonLink>
            <ButtonLink href="/login" variant="secondary" wrapperClassName="grid"><LogIn className="size-4" /> Sign in</ButtonLink>
          </div>
        </div>
      </>
    );

  if (!code)
    return (
      <>
        <PageHeader title="Join a family" back="/family" privacy={false} />
        <form
          className="space-y-4 px-4"
          onSubmit={(e) => {
            e.preventDefault();
            const c = parseInviteCode(typed);
            if (c) router.replace(`/family/join?code=${c}`);
          }}
        >
          <p className="px-1 text-sm text-ink-3">Scan the family&apos;s QR code with your phone camera, or type the 10-letter code from their screen.</p>
          <Field label="Invite code">
            {(id) => (
              <input id={id} className={`${inputCls} font-mono tracking-[0.2em] uppercase`} value={typed} onChange={(e) => setTyped(e.target.value)}
                placeholder="ABCDE 23456" autoCapitalize="characters" autoComplete="off" spellCheck={false} autoFocus />
            )}
          </Field>
          <Button type="submit" disabled={parseInviteCode(typed).length < 10} wrapperClassName="grid">Continue</Button>
        </form>
      </>
    );

  return <Preview code={code} />;
}

function Preview({ code }: { code: string }) {
  const online = useOnline();
  const [preview, setPreview] = useState<InvitePreview | { status: "error"; message: string }>();
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!online) return;
    let live = true;
    previewInvite(code)
      .then((p) => live && setPreview(p))
      .catch((e: Error) => live && setPreview({ status: "error", message: e.message }));
    return () => {
      live = false;
    };
  }, [code, online]);

  async function ask() {
    setSending(true);
    try {
      await requestJoin(code);
      setPreview((p) => (p && p.status !== "error" ? { ...p, status: "pending" } : p));
    } catch (e) {
      noticeToast((e as Error).message, "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <PageHeader title="Join a family" back="/family" privacy={false} />
      <div className="space-y-4 px-4">
        {!online ? (
          <Card className="text-sm">You&apos;re offline. Joining a family needs a connection.</Card>
        ) : !preview ? (
          <Loading />
        ) : preview.status === "error" ? (
          <Card className="text-sm">{preview.message}</Card>
        ) : preview.status === "invalid" ? (
          <Card className="text-center">
            <p className="font-semibold">This invite isn&apos;t valid</p>
            <p className="mt-1 text-sm text-ink-3">It may have expired or been replaced. Ask an admin for a new code.</p>
            <ButtonLink href="/family/join" variant="secondary" wrapperClassName="mt-4 grid">Enter another code</ButtonLink>
          </Card>
        ) : (
          <Card className="flex flex-col items-center py-6 text-center">
            <FamilyMark icon={preview.icon!} color={preview.color!} size={72} />
            <p className="mt-3 text-xl font-semibold tracking-tight">{preview.name}</p>
            {preview.description && <p className="mt-1 max-w-xs text-sm text-ink-3">{preview.description}</p>}
            <p className="mt-1 text-sm text-ink-3">{preview.member_count} {preview.member_count === 1 ? "member" : "members"}</p>

            {preview.status === "ok" && (
              <>
                <p className="mt-4 max-w-xs text-xs text-ink-3">An admin approves your request. Members see your name and photo, plus only the accounts you choose to share.</p>
                <Button disabled={sending} onClick={ask} wrapperClassName="mt-4 grid w-full">Ask to join</Button>
              </>
            )}
            {preview.status === "pending" && (
              <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-pale px-4 py-2 text-sm font-medium text-brand">
                <Clock className="size-4" /> Request sent. Waiting for an admin.
              </p>
            )}
            {preview.status === "member" && (
              <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-pale px-4 py-2 text-sm font-medium text-brand">
                <CheckCircle2 className="size-4" /> You&apos;re already a member
              </p>
            )}
          </Card>
        )}
        <Link href="/family" className="block py-2 text-center text-sm font-medium text-brand">Go to Family</Link>
      </div>
    </>
  );
}
