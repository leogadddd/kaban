"use client";

import { useRouter } from "next/navigation";
import { Trash2, Zap } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button, Card, cx, Field, inputCls, PageHeader, SectionTitle } from "@/components/ui";
import { useLedger, useMeta } from "@/lib/hooks";
import { LogoMark } from "@/lib/logo";
import { setMeta, wipeAll } from "@/lib/repo";
import { signOut, unsyncedCount, useSyncState } from "@/lib/sync";

export default function SettingsPage() {
  const router = useRouter();
  const ledger = useLedger();
  const standalone = useSyncExternalStore(noop, isStandalone, () => false);
  const launchToAdd = useMeta<boolean>("launchToAdd");
  const launchAccount = useMeta<string>("launchAccount");
  const sync = useSyncState();
  const signedIn = !!sync.userId;

  return (
    <>
      <PageHeader title="Settings" back="/home" />
      <div className="space-y-5 px-4 pb-4">
        <Card className="flex items-center gap-3">
          <LogoMark size={44} />
          <div>
            <p className="font-semibold">Kaban</p>
            <p className="text-sm text-ink-3">v0.1 · PHP · {standalone ? "Installed on Home Screen" : "Running in browser"}</p>
          </div>
        </Card>

        {!standalone && (
          <Card className="space-y-2">
            <SectionTitle>Install on iPhone</SectionTitle>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-2">
              <li>Open this page in Safari.</li>
              <li>Tap the Share button, then <b>Add to Home Screen</b>.</li>
              <li>Open Kaban from the Home Screen once while online — after that it works offline.</li>
            </ol>
          </Card>
        )}

        <Card className="space-y-3">
          <SectionTitle><span className="flex items-center gap-1.5"><Zap className="size-4 text-brand" /> Quick add</span></SectionTitle>
          <button
            type="button"
            role="switch"
            aria-checked={!!launchToAdd}
            onClick={() => setMeta("launchToAdd", !launchToAdd)}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <span>
              <span className="block font-medium">Open on the Add screen</span>
              <span className="block text-sm text-ink-3">Tapping the Kaban icon starts a new transaction right away.</span>
            </span>
            <span className={cx("relative h-7 w-12 shrink-0 rounded-full transition-colors", launchToAdd ? "bg-brand" : "bg-line")}>
              <span className={cx("absolute top-1 size-5 rounded-full bg-white shadow transition-all", launchToAdd ? "left-6" : "left-1")} />
            </span>
          </button>
          {launchToAdd && (
            <Field label="Start with account">
              {(id) => (
                <select id={id} className={inputCls} value={launchAccount ?? ""} onChange={(e) => setMeta("launchAccount", e.target.value || undefined)}>
                  <option value="">Last-used default</option>
                  {ledger.activeAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              )}
            </Field>
          )}
          <p className="text-xs text-ink-3">Applies when Kaban is opened fresh from the Home Screen. If it was already open in the background, it resumes where you left off.</p>
        </Card>

        <Card className="space-y-2">
          <SectionTitle>Danger zone</SectionTitle>
          <p className="text-sm text-ink-3">
            {signedIn
              ? "Sign out and erase every record on this device. Your cloud copy stays, and comes back when you sign in again."
              : "Erase every account, transaction and person on this device. Export a backup first."}
          </p>
          <Button
            variant="danger"
            className="w-full"
            onClick={async () => {
              if (signedIn) {
                const n = await unsyncedCount();
                const warn = n ? ` ${n} change${n === 1 ? " hasn't" : "s haven't"} reached the cloud yet and will be lost.` : "";
                if (!confirm(`Sign out and erase Kaban data on this device?${warn}`)) return;
                await signOut();
                router.replace("/welcome");
                return;
              }
              if (!confirm("Erase all Kaban data on this device? This cannot be undone.")) return;
              if (!confirm("Really erase everything?")) return;
              await wipeAll();
              router.replace("/welcome");
            }}
          >
            <Trash2 className="size-4" /> {signedIn ? "Sign out & erase device" : "Erase all data"}
          </Button>
        </Card>
      </div>
    </>
  );
}

const noop = () => () => {};
function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}
