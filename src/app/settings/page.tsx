"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bell, ChevronRight, Cloud, Info, LogOut, Search, ShieldCheck, SlidersHorizontal, Smartphone, Trash2, X } from "lucide-react";
import { alertDialog, confirmDialog, confirmSignOut } from "@/components/dialog";
import { PersonAvatar } from "@/components/family-ui";
import { HapticLink } from "@/components/haptic-button";
import { InstallSheet, requestInstall, useInstall } from "@/components/install";
import { searchSettings, SettingsAction, SettingsGroup, SettingsLink } from "@/components/settings-ui";
import { ButtonLink, Card, inputCls, PageHeader } from "@/components/ui";
import { isActiveDatabase, useLedgerDatabase } from "@/lib/db";
import { useProfile } from "@/lib/family";
import { resetOnboarded } from "@/lib/first-run";
import { useNotifyPrefs } from "@/lib/notify";
import { wipeAll } from "@/lib/repo";
import { deleteCloudData, friendlyAuthError, signOut, useSyncState } from "@/lib/sync";
import { useSyncPrefs } from "@/lib/sync-prefs";

export default function SettingsPage() {
  const sync = useSyncState();
  const signedIn = !!sync.userId && sync.phase !== "mfa";
  const install = useInstall();
  const installed = install.standalone || install.installed;
  const syncPrefs = useSyncPrefs();
  const notify = useNotifyPrefs();
  const [query, setQuery] = useState("");
  const results = searchSettings(query, signedIn);

  return (
    <>
      <PageHeader title="Settings" back="/home" privacy={false} />
      <div className="space-y-6 px-4 pb-6">
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search settings"
            aria-label="Search settings"
            className={`${inputCls} pr-11 pl-10 [&::-webkit-search-cancel-button]:hidden`}
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-ink-3 active:bg-pale">
              <X className="size-4" />
            </button>
          )}
        </label>

        {query.trim() ? (
          results.length ? (
            <SettingsGroup title="Results">
              {results.map((r) => (
                <SettingsLink key={r.label} href={r.href} label={r.label} detail={r.page} />
              ))}
            </SettingsGroup>
          ) : (
            <p className="px-1 py-6 text-center text-sm text-ink-3">No settings match “{query.trim()}”.</p>
          )
        ) : (
          <>
            {sync.configured && <AccountHeader signedIn={signedIn} email={sync.email} />}

            <SettingsGroup title="Preferences">
              <SettingsLink href="/settings/general" icon={SlidersHorizontal} label="General" detail="Theme, hide amounts" />
              <SettingsLink href="/settings/notifications" icon={Bell} label="Notifications" detail={notify.cardDue ? "Payment reminders on" : "Off"} />
              {sync.configured && (
                <SettingsLink
                  href="/settings/sync"
                  icon={Cloud}
                  label="Sync"
                  detail={syncPrefs.auto ? `Every ${syncPrefs.intervalMin} min` : "Manual only"}
                />
              )}
            </SettingsGroup>

            {signedIn && (
              <SettingsGroup title="Account">
                <SettingsLink href="/settings/security" icon={ShieldCheck} label="Security" detail="Two-factor sign-in, password" />
                <SettingsLink href="/sync" icon={Cloud} label="Sync & backup" detail="Cloud storage, export, import" />
              </SettingsGroup>
            )}

            <div id="install" className="scroll-mt-24">
              <SettingsGroup title="App">
                {!installed && (
                  <SettingsAction
                    onClick={() => void requestInstall()}
                    icon={Smartphone}
                    label={install.platform === "desktop" ? "Install Kaban" : "Add to Home Screen"}
                    detail="Opens full screen, works offline"
                  />
                )}
                <SettingsLink href="/settings/about" icon={Info} label="About Kaban" detail={installed ? "Installed app" : "Running in browser"} />
              </SettingsGroup>
              <InstallSheet />
            </div>

            <DangerZone signedIn={signedIn} />
          </>
        )}
      </div>
    </>
  );
}

function AccountHeader({ signedIn, email }: { signedIn: boolean; email?: string }) {
  const profile = useProfile();
  if (!signedIn)
    return (
      <Card className="space-y-3">
        <div>
          <p className="font-semibold">Back up with a free account</p>
          <p className="text-sm text-ink-3">Sync across devices. Optional.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ButtonLink href="/signup" wrapperClassName="grid" className="min-h-11 px-3 text-sm whitespace-nowrap">Create account</ButtonLink>
          <ButtonLink href="/login" variant="secondary" wrapperClassName="grid" className="min-h-11 px-3 text-sm">Sign in</ButtonLink>
        </div>
      </Card>
    );
  const name = profile?.display_name?.trim();
  return (
    <HapticLink href="/profile" wrapperClassName="block" className="flex items-center gap-3 rounded-3xl border border-line bg-surface p-4 shadow-soft active:bg-pale">
      <PersonAvatar name={name || email} avatar={profile?.avatar} size={52} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{name || "Your profile"}</span>
        <span className="block truncate text-sm text-ink-3">{email}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-ink-3" />
    </HapticLink>
  );
}

/** Sign out and every destructive action, kept together at the bottom. */
function DangerZone({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const db = useLedgerDatabase();

  async function doSignOut() {
    if (!(await confirmSignOut()) || !db || !isActiveDatabase(db)) return;
    await signOut();
    router.replace("/login");
  }

  async function doDeleteCloud() {
    const ok = await confirmDialog({
      title: "Delete your cloud data?",
      body: "Deletes your cloud records and resets sync on all your devices. This browser keeps a recovery copy you can export from Sync & backup.",
      confirmLabel: "Delete cloud data",
      danger: true,
      typeToConfirm: "DELETE",
    });
    if (!ok || !db || !isActiveDatabase(db)) return;
    try {
      await deleteCloudData();
    } catch (e) {
      await alertDialog({ title: "Couldn't delete cloud data", body: friendlyAuthError(e), danger: true });
    }
  }

  async function doErase() {
    const ok = await confirmDialog({
      title: "Erase everything on this device?",
      body: "Every account, transaction and person is deleted from this device. This can't be undone — export a backup first if you might need it.",
      confirmLabel: "Erase all local data",
      danger: true,
      typeToConfirm: "ERASE",
    });
    if (!ok || !db || !isActiveDatabase(db)) return;
    await wipeAll(db);
    resetOnboarded();
    router.replace("/welcome");
  }

  return (
    <div id="danger" className="scroll-mt-24">
      <SettingsGroup title="Danger zone" footer={signedIn ? "Signing out keeps this device's copy; sign in again to see it." : "Export a backup from Sync & backup first."}>
        {signedIn ? (
          <>
            <SettingsAction onClick={doSignOut} icon={LogOut} tone="danger" label="Sign out" />
            <SettingsAction onClick={doDeleteCloud} icon={Trash2} tone="danger" label="Delete cloud data" detail="Removes the synced copy on all devices" />
          </>
        ) : (
          <SettingsAction onClick={doErase} icon={Trash2} tone="danger" label="Erase this device" detail="Deletes every record stored here" />
        )}
      </SettingsGroup>
    </div>
  );
}
