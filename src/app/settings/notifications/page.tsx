"use client";

import { BellRing, CreditCard, Send } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { SettingsAction, SettingsGroup, SettingsRow, SettingsSwitch } from "@/components/settings-ui";
import { Button, Card, PageHeader, Segmented } from "@/components/ui";
import {
  notifySupport,
  REMIND_DAYS,
  requestNotifyPermission,
  setNotifyPrefs,
  showNotification,
  useNotifyPermission,
  useNotifyPrefs,
} from "@/lib/notify";

const noop = () => () => {};

export default function NotificationsPage() {
  const prefs = useNotifyPrefs();
  const permission = useNotifyPermission();
  const support = useSyncExternalStore(noop, notifySupport, () => "ok" as const);
  const [busy, setBusy] = useState(false);
  const granted = permission === "granted";

  async function enable() {
    setBusy(true);
    try {
      if ((await requestNotifyPermission()) === "granted") setNotifyPrefs({ cardDue: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Notifications" back="/settings" privacy={false} />
      <div className="space-y-6 px-4 pb-6">
        {support === "needs-install" ? (
          <Notice title="Add Kaban to your Home Screen" body="On iPhone and iPad, notifications only work in the installed app. Use Share → Add to Home Screen in Safari." />
        ) : support === "unsupported" ? (
          <Notice title="Not available here" body="This browser doesn't support notifications." />
        ) : permission === "denied" ? (
          <Notice title="Notifications are blocked" body="Allow notifications for Kaban in your browser or phone settings, then come back." />
        ) : !granted ? (
          <Card className="space-y-3 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-pale text-brand"><BellRing className="size-6" /></span>
            <div>
              <p className="font-semibold">Get payment reminders</p>
              <p className="text-sm text-ink-3">A heads-up before a credit card is due.</p>
            </div>
            <Button wrapperClassName="w-full" disabled={busy} onClick={enable}>Turn on notifications</Button>
          </Card>
        ) : null}

        {granted && (
          <>
            <SettingsGroup title="Reminders">
              <SettingsSwitch icon={CreditCard} label="Credit card due dates" checked={prefs.cardDue} onChange={(cardDue) => setNotifyPrefs({ cardDue })} />
              {prefs.cardDue && (
                <>
                  <SettingsRow label="Remind me" />
                  <div className="px-3 pb-3">
                    <Segmented
                      size="sm"
                      value={String(prefs.daysBefore)}
                      onChange={(v) => setNotifyPrefs({ daysBefore: Number(v) })}
                      options={REMIND_DAYS.map((d) => ({ value: String(d), label: d === 1 ? "1 day" : `${d} days` }))}
                    />
                  </div>
                </>
              )}
            </SettingsGroup>

            <SettingsGroup footer="Reminders are checked when you open Kaban, on this device only. Amounts are never shown.">
              <SettingsAction icon={Send} tone="muted" label="Send a test notification" onClick={() => void showNotification("Kaban", "Notifications are working.", "kaban-test")} />
            </SettingsGroup>
          </>
        )}
      </div>
    </>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <Card className="space-y-1">
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-ink-3">{body}</p>
    </Card>
  );
}
