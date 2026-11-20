"use client";

import { Copy, RefreshCw, Share } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { confirmDialog } from "@/components/dialog";
import { FamilyMark, InviteQr, useCurrentFamily } from "@/components/family-ui";
import { noticeToast } from "@/components/undo-toast";
import { Button, Card, EmptyState, Loading, PageHeader } from "@/components/ui";
import { formatDayLong, todayISO } from "@/lib/dates";
import { inviteLink, isAdmin, rotateInvite } from "@/lib/family";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Invite />
    </Suspense>
  );
}

function Invite() {
  const params = useSearchParams();
  const { state, family } = useCurrentFamily(params.get("id"));
  const [busy, setBusy] = useState(false);
  const fresh = params.get("new") === "1";

  if (state === null) return <Loading />;
  if (!family || !isAdmin(family))
    return (
      <>
        <PageHeader title="Invite" back privacy={false} />
        <EmptyState title="Only family admins can invite" action={<Link href="/family" className="text-brand">Back to family</Link>} />
      </>
    );

  const invite = family.invite;
  const expired = !invite || invite.expires_at.slice(0, 10) < todayISO();
  const link = invite ? inviteLink(invite.code) : "";
  const code = invite ? `${invite.code.slice(0, 5)} ${invite.code.slice(5)}` : "";

  async function newCode(ask: boolean) {
    if (ask && !(await confirmDialog({ title: "Make a new code?", body: "The current QR code and link stop working. Requests already sent stay in your inbox.", confirmLabel: "New code" }))) return;
    setBusy(true);
    try {
      await rotateInvite(family!.id);
      noticeToast("New invite code ready");
    } catch (e) {
      noticeToast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    const text = `Join ${family!.name} on Kaban`;
    try {
      if (navigator.share) await navigator.share({ title: text, text, url: link });
      else {
        await navigator.clipboard.writeText(link);
        noticeToast("Invite link copied");
      }
    } catch {
      /* share sheet dismissed */
    }
  }

  return (
    <>
      <PageHeader title={fresh ? "Invite your family" : "Invite"} back={fresh ? "/family" : true} privacy={false} />
      <div className="space-y-5 px-4 pb-8">
        <div className="flex items-center justify-center gap-2">
          <FamilyMark icon={family.icon} color={family.color} size={36} />
          <p className="font-semibold">{family.name}</p>
        </div>

        {expired ? (
          <Card className="text-center">
            <p className="font-semibold">This invite code has expired</p>
            <p className="mt-1 text-sm text-ink-3">Make a new one to invite people.</p>
            <Button disabled={busy} onClick={() => newCode(false)} wrapperClassName="mt-4 grid"><RefreshCw className="size-4" /> New code</Button>
          </Card>
        ) : (
          <>
            <InviteQr value={link} />
            <p className="text-center text-sm text-ink-3">Have them scan this with their phone camera, or enter the code in Family → Join.</p>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard?.writeText(invite!.code).catch(() => {});
                noticeToast("Code copied");
              }}
              className="mx-auto flex items-center gap-2 rounded-2xl bg-pale px-5 py-3 font-mono text-xl font-semibold tracking-[0.2em] text-brand"
              aria-label={`Invite code ${invite!.code}, tap to copy`}
            >
              {code} <Copy className="size-4" />
            </button>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={share} wrapperClassName="grid"><Share className="size-4" /> Share link</Button>
              <Button variant="secondary" disabled={busy} onClick={() => newCode(true)} wrapperClassName="grid"><RefreshCw className="size-4" /> New code</Button>
            </div>
            <p className="text-center text-xs text-ink-3">Expires {formatDayLong(invite!.expires_at.slice(0, 10))}.</p>
          </>
        )}
      </div>
    </>
  );
}
