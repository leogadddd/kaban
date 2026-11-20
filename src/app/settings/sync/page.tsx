"use client";

import { AppWindow, Clock, RefreshCw, Upload } from "lucide-react";
import { SettingsGroup, SettingsLink, SettingsRow, SettingsSwitch } from "@/components/settings-ui";
import { PageHeader, Segmented } from "@/components/ui";
import { useSyncState } from "@/lib/sync";
import { setSyncPrefs, SYNC_INTERVALS, useSyncPrefs } from "@/lib/sync-prefs";

export default function SyncSettingsPage() {
  const prefs = useSyncPrefs();
  const sync = useSyncState();
  const signedIn = !!sync.userId && sync.phase !== "mfa";

  return (
    <>
      <PageHeader title="Sync settings" back={true} privacy={false} />
      <div className="space-y-6 px-4 pb-6">
        {!signedIn && <p className="rounded-2xl bg-pale p-3 text-sm text-ink-2">These apply once you sign in to a cloud account.</p>}

        <SettingsGroup footer={prefs.auto ? undefined : "Changes stay on this device until you tap Sync now or pull down to refresh."}>
          <SettingsSwitch icon={RefreshCw} label="Automatic sync" detail="Sync in the background" checked={prefs.auto} onChange={(auto) => setSyncPrefs({ auto })} />
        </SettingsGroup>

        {prefs.auto && (
          <>
            <SettingsGroup title="Check for changes" footer="Only while Kaban is open. Longer intervals use less data.">
              <SettingsRow icon={Clock} label="Every" />
              <div className="px-3 pb-3">
                <Segmented
                  size="sm"
                  value={String(prefs.intervalMin)}
                  onChange={(v) => setSyncPrefs({ intervalMin: Number(v) })}
                  options={SYNC_INTERVALS.map((m) => ({ value: String(m), label: `${m} min` }))}
                />
              </div>
            </SettingsGroup>

            <SettingsGroup>
              <SettingsSwitch icon={Upload} label="Upload right away" detail="Send each change a moment after you save it" checked={prefs.uploadNow} onChange={(uploadNow) => setSyncPrefs({ uploadNow })} />
              <SettingsSwitch icon={AppWindow} label="Sync when opened" detail="Check whenever you return to Kaban" checked={prefs.onOpen} onChange={(onOpen) => setSyncPrefs({ onOpen })} />
            </SettingsGroup>
          </>
        )}

        <SettingsGroup footer="Saved on this device only.">
          <SettingsLink href="/sync" icon={RefreshCw} label="Sync & backup" detail="Sync now, storage, export" />
        </SettingsGroup>
      </div>
    </>
  );
}
