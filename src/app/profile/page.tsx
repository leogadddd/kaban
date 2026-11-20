"use client";

import { Cake, CloudOff, LogIn, Mail, Pencil, UserPlus } from "lucide-react";
import { PersonAvatar } from "@/components/family-ui";
import { HapticLink } from "@/components/haptic-button";
import { ButtonLink, Card, PageHeader } from "@/components/ui";
import { fromISO } from "@/lib/dates";
import { useProfile } from "@/lib/family";
import { cloudConfigured } from "@/lib/supabase";
import { useSyncState } from "@/lib/sync";

const birthdayFmt = new Intl.DateTimeFormat("en-PH", { month: "long", day: "numeric", year: "numeric" });

export default function Page() {
  const { userId, email } = useSyncState();
  const profile = useProfile();

  if (!userId)
    return (
      <>
        <PageHeader title="Profile" back privacy={false} />
        <div className="space-y-4 px-4">
          <Card className="text-center">
            <PersonAvatar size={72} className="mx-auto mb-3" />
            <p className="font-semibold">On this device only</p>
            <p className="mt-1 text-sm text-ink-3">Create an account to get a profile, back up your ledger and join a family.</p>
          </Card>
          {cloudConfigured && (
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/signup" wrapperClassName="grid min-w-max flex-1" className="px-3! text-sm whitespace-nowrap">
                <UserPlus className="size-4 shrink-0" /> Create account
              </ButtonLink>
              <ButtonLink href="/login" variant="secondary" wrapperClassName="grid min-w-max flex-1" className="px-3! text-sm whitespace-nowrap">
                <LogIn className="size-4 shrink-0" /> Sign in
              </ButtonLink>
            </div>
          )}
        </div>
      </>
    );

  const name = profile?.display_name?.trim();
  return (
    <>
      <PageHeader
        title="Profile"
        back
        privacy={false}
        action={
          <HapticLink href="/profile/edit" aria-label="Edit profile" className="grid size-11 place-items-center rounded-full border border-line bg-surface">
            <Pencil className="size-4" />
          </HapticLink>
        }
      />
      <div className="space-y-4 px-4">
        <Card className="flex flex-col items-center py-6 text-center">
          <PersonAvatar name={name || email} avatar={profile?.avatar} size={96} className="mb-3 ring-4 ring-pale" />
          <p className="text-xl font-semibold tracking-tight">{name || "Add your name"}</p>
          <p className="text-sm text-ink-3">{email}</p>
          {profile?.pending && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-pale px-3 py-1 text-xs text-ink-2">
              <CloudOff className="size-3.5" /> Saved here, uploading soon
            </p>
          )}
        </Card>

        <Card className="divide-y divide-line p-0">
          <Detail icon={Mail} label="Email" value={email ?? "—"} hint="Used to sign in. It can't be changed." />
          <Detail icon={Cake} label="Birthday" value={profile?.birthday ? birthdayFmt.format(fromISO(profile.birthday)) : "Not set"} />
        </Card>
        <p className="px-1 text-xs text-ink-3">Family members see your name and photo. Your email and birthday stay private.</p>

        <ButtonLink href="/profile/edit" variant="secondary" wrapperClassName="grid">
          <Pencil className="size-4" /> Edit profile
        </ButtonLink>
      </div>
    </>
  );
}

function Detail({ icon: Icon, label, value, hint }: { icon: typeof Mail; label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-start gap-3 p-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-pale text-brand">
        <Icon className="size-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-ink-3">{label}</p>
        <p className="truncate font-medium">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-ink-3">{hint}</p>}
      </div>
    </div>
  );
}
