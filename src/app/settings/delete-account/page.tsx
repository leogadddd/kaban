"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarClock, Download, KeyRound, Trash2, UsersRound } from "lucide-react";
import { alertDialog, confirmDialog } from "@/components/dialog";
import { Mascot } from "@/components/mascot";
import { Button, ButtonLink, Card, PageHeader } from "@/components/ui";
import { friendlyAuthError, requestAccountDeletion, useSyncState } from "@/lib/sync";

const WHAT_HAPPENS = [
  { icon: CalendarClock, t: "30 days to change your mind", d: "Sign in any time before then and tap Recover. Everything comes back as it was." },
  { icon: Trash2, t: "Then it's gone for good", d: "Your sign-in, synced records, profile and family memberships are erased and can't be restored." },
  { icon: UsersRound, t: "Families keep going", d: "Families you own pass to the next admin, or the longest-standing member. A family with only you is deleted." },
  { icon: KeyRound, t: "Quick add stops now", d: "Your quick add tokens are turned off right away, so nothing can be sent in your name." },
];

export default function DeleteAccountPage() {
  const router = useRouter();
  const sync = useSyncState();
  const signedIn = !!sync.userId && sync.phase !== "mfa" && sync.phase !== "deleted";
  const [busy, setBusy] = useState(false);

  async function start() {
    const ok = await confirmDialog({
      title: "Delete your Kaban account?",
      body: "Your account will be erased in 30 days. Sign in before then to recover it. This device's copy is removed now.",
      confirmLabel: "Delete account",
      danger: true,
      typeToConfirm: "DELETE",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await requestAccountDeletion();
      router.replace("/account/deleted");
    } catch (e) {
      setBusy(false);
      await alertDialog({ title: "Couldn't delete your account", body: friendlyAuthError(e), danger: true });
    }
  }

  return (
    <>
      <PageHeader title="Delete account" back="/settings" privacy={false} />
      <div className="space-y-6 px-4 pb-6">
        <Card className="flex flex-col items-center py-6 text-center">
          <Mascot action="worried" className="h-24 w-[6.4rem]" />
          <p className="mt-4 text-lg font-semibold">Leaving Kaban?</p>
          <p className="mt-1 max-w-sm text-sm text-ink-3">Deleting your account removes it from every device. Here&apos;s exactly what happens.</p>
        </Card>

        <ul className="space-y-4 px-1">
          {WHAT_HAPPENS.map(({ icon: Icon, t, d }) => (
            <li key={t} className="flex gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface text-brand ring-1 ring-line">
                <Icon className="size-4.5" />
              </span>
              <div>
                <p className="font-medium">{t}</p>
                <p className="text-sm text-ink-3">{d}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="rounded-2xl bg-gold/10 p-4 text-sm text-ink-2">
          <p className="font-medium text-ink">Want a copy first?</p>
          <p className="mt-1">Export a backup from Sync &amp; backup. You can import it into Kaban later, with or without an account.</p>
          <ButtonLink href="/sync" variant="secondary" wrapperClassName="mt-3 w-full" className="w-full">
            <Download className="size-4" /> Export a backup
          </ButtonLink>
        </div>

        {signedIn ? (
          <Button variant="danger" wrapperClassName="w-full" className="w-full" onClick={start} disabled={busy}>
            {busy ? "Saving your changes…" : "Delete my account"}
          </Button>
        ) : (
          <p className="rounded-2xl bg-pale p-3 text-sm text-ink-2">Sign in to delete your account. Without one, use Erase this device in Settings.</p>
        )}
      </div>
    </>
  );
}
