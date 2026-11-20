"use client";

import { KeyRound } from "lucide-react";
import { SettingsGroup, SettingsLink } from "@/components/settings-ui";
import { TwoFactorCard } from "@/components/two-factor";
import { PageHeader } from "@/components/ui";
import { useSyncState } from "@/lib/sync";

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
            <SettingsGroup>
              <SettingsLink href="/settings/security/password" icon={KeyRound} label="Change password" detail="Via a link sent to your email" />
            </SettingsGroup>
          </>
        ) : (
          <p className="rounded-2xl bg-pale p-3 text-sm text-ink-2">Sign in to manage two-factor sign-in and your password.</p>
        )}
      </div>
    </>
  );
}
