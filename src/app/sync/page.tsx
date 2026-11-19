"use client";

import { HapticLink } from "@/components/haptic-button";
import { confirmDialog } from "@/components/dialog";
import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle, Cloud, CloudOff, Download, HardDrive, RefreshCw, ShieldCheck, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, Card, cx, PageHeader, Progress, SectionTitle } from "@/components/ui";
import { isActiveDatabase, useLedgerDatabase } from "@/lib/db";
import { useMeta, useOnline } from "@/lib/hooks";
import { exportBackup, importBackup, MAX_BACKUP_BYTES, prepareBackupImport, setMeta } from "@/lib/repo";
import {
  runSync,
  recoveryBackup,
  useSyncState,
  type SyncState,
} from "@/lib/sync";

export default function SyncPage() {
  const online = useOnline();
  const sync = useSyncState();
  const lastBackup = useMeta<number>("lastBackup");
  const db = useLedgerDatabase();
  const queue = useLiveQuery(() => db ? db.outbox.toArray() : [], [db]) ?? [];
  const recoveryAvailable = useMeta<boolean>("recoveryAvailable");
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<string>();
  const [msg, setMsg] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);
  const signedIn = !!sync.userId && sync.phase !== "mfa";

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(false));
    navigator.storage?.estimate?.().then((e) => e.usage && setUsage(`${(e.usage / 1024 / 1024).toFixed(1)} MB used`));
  }, []);

  const counts = { pending: 0, failed: 0, conflict: 0, quota: 0 } as Record<string, number>;
  for (const q of queue) counts[q.status] = (counts[q.status] ?? 0) + 1;

  async function doExport(recovery = false) {
    if (!db) return;
    const data = recovery ? await recoveryBackup(db) : await exportBackup(db);
    if (!data || !isActiveDatabase(db)) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const name = `kaban-${recovery ? "recovery" : "backup"}-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([blob], name, { type: "application/json" });
    // iOS: share sheet lets the user save to Files / iCloud Drive.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Kaban backup" });
        if (!recovery) await setMeta("lastBackup", Date.now(), db);
        return;
      } catch {
        /* cancelled → fall through to download */
      }
    }
    if (!isActiveDatabase(db)) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    if (!recovery) await setMeta("lastBackup", Date.now(), db);
  }

  async function doImport(f: File) {
    if (!db) return;
    try {
      if (f.size > MAX_BACKUP_BYTES) throw new Error("Choose a backup of 32 MiB or less.");
      const preview = await prepareBackupImport(JSON.parse(await f.text()), db);
      if (!isActiveDatabase(db)) return;
      if (!(await confirmDialog({
        title: "Import backup?",
        body: `Add ${preview.added} and replace ${preview.updated} records in this ledger.${signedIn ? " Imported changes will sync to this account." : ""}`,
        confirmLabel: "Import backup",
      }))) return;
      const res = await importBackup(preview);
      setMsg(`Merged backup: ${res.added} new and ${res.updated} updated records.`);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  const queued = counts.pending + counts.quota;

  return (
    <>
      <PageHeader title="Sync & backup" back="/home" privacy={false} />
      <div className="space-y-4 px-4 pb-4">
        <Card className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-pale text-brand">
              {signedIn ? <Cloud className="size-5" /> : <HardDrive className="size-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{signedIn ? "Cloud sync on" : "Local only"}</p>
              <p className="truncate text-sm text-ink-3">{signedIn ? sync.email : "Records are stored on this device in IndexedDB."}</p>
            </div>
            <span className={cx("flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", online ? "bg-pale text-brand" : "bg-expense/10 text-expense")}>
              {online ? <Cloud className="size-3.5" /> : <CloudOff className="size-3.5" />} {online ? "Online" : "Offline"}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            {signedIn && (
              <>
                <dt className="text-ink-3">Last synced</dt>
                <dd className="text-right">{sync.phase === "syncing" ? "Syncing…" : sync.lastSyncedAt ? relTime(sync.lastSyncedAt) : "Not yet"}</dd>
              </>
            )}
            <dt className="text-ink-3">{signedIn ? "Waiting to upload" : "Queued changes"}</dt>
            <dd className="num text-right">
              {queued}
              {counts.conflict ? ` · ${counts.conflict} rejected` : ""}
            </dd>
            <dt className="text-ink-3">Storage</dt>
            <dd className="text-right">{persisted ? <span className="inline-flex items-center gap-1 text-income"><ShieldCheck className="size-4" /> Protected</span> : "Best-effort"}</dd>
            {usage && (
              <>
                <dt className="text-ink-3">Space used</dt>
                <dd className="num text-right">{usage.replace(" used", "")}</dd>
              </>
            )}
            <dt className="text-ink-3">Last backup</dt>
            <dd className="text-right">{lastBackup ? new Date(lastBackup).toLocaleString("en-PH") : "Never"}</dd>
          </dl>
          {!signedIn && (
            <p className="rounded-2xl bg-gold/10 p-3 text-xs text-ink-2">
              This ledger stays on this device. To move it into your cloud account, export a backup, then sign in and import the file. Clearing Safari website data deletes the local copy.
            </p>
          )}
        </Card>

        <CloudSection sync={sync} />

        <section>
          <SectionTitle>Backup</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" className="px-2 text-sm" onClick={() => doExport()}><Download className="size-4 shrink-0" /> Export backup</Button>
            <Button variant="secondary" className="px-2 text-sm" onClick={() => fileRef.current?.click()}><Upload className="size-4 shrink-0" /> Import backup</Button>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = "";
            if (file) void doImport(file);
          }} />
          {recoveryAvailable && (
            <div className="mt-3 rounded-2xl bg-gold/10 p-3 text-sm text-ink-2">
              <p>Cloud data was reset. A recovery copy of this browser’s previous records is available to export.</p>
              <Button variant="ghost" wrapperClassName="mt-1" className="min-h-10 px-2" onClick={() => doExport(true)}><Download className="size-4" /> Export recovery copy</Button>
            </div>
          )}
          {msg && <p className="mt-3 rounded-2xl bg-pale p-3 text-sm text-brand" role="status">{msg}</p>}
          <p className="mt-2 px-1 text-xs text-ink-3">Import merges by record ID and keeps the newest version of each record, so restoring onto a device that already has data won&apos;t silently overwrite it.</p>
        </section>
      </div>
    </>
  );
}

function CloudSection({ sync }: { sync: SyncState }) {
  if (!sync.configured) {
    return (
      <Card className="space-y-2">
        <p className="flex items-center gap-2 font-semibold"><Cloud className="size-4 text-brand" /> Cloud sync</p>
        <p className="text-sm text-ink-3">Cloud sync isn&apos;t set up in this build. Kaban keeps working fully on this device.</p>
      </Card>
    );
  }
  if (!sync.userId || sync.phase === "mfa") return <SignedOutCard />;
  return <AccountCard sync={sync} />;
}

// ---------- Signed out ----------

function SignedOutCard() {
  return (
    <Card className="space-y-3">
      <div>
        <p className="flex items-center gap-2 font-semibold"><Cloud className="size-4 text-brand" /> Cloud sync</p>
        <p className="mt-1 text-sm text-ink-3">
          Back up your records and use Kaban on more than one device. It stays just as fast — everything still saves here first and uploads in the background.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <HapticLink href="/signup" wrapperClassName="grid" className="flex min-h-12 items-center justify-center rounded-2xl bg-brand font-medium text-on-brand shadow-soft">Create account</HapticLink>
        <Link href="/login" className="flex min-h-12 items-center justify-center rounded-2xl bg-pale font-medium text-brand">Sign in</Link>
      </div>
    </Card>
  );
}

// ---------- Signed in ----------

function AccountCard({ sync }: { sync: SyncState }) {
  const q = sync.quota;
  const recPct = q ? (q.records / q.maxRecords) * 100 : 0;
  const bytePct = q ? (q.bytes / q.maxBytes) * 100 : 0;

  return (
    <>
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 font-semibold"><Cloud className="size-4 text-brand" /> Cloud storage</p>
          <Button variant="ghost" className="min-h-10 px-3 text-sm" onClick={() => void runSync()} disabled={sync.phase === "syncing"}>
            <RefreshCw className={cx("size-4", sync.phase === "syncing" && "animate-spin")} /> Sync now
          </Button>
        </div>
        {sync.phase === "full" && (
          <p className="flex gap-2 rounded-2xl bg-gold/10 p-3 text-sm text-ink-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-gold" />
            Your cloud storage is full. New changes are saved on this device and will upload once there&apos;s room.
          </p>
        )}
        {sync.phase === "error" && sync.error && (
          <p className="flex gap-2 rounded-2xl bg-expense/10 p-3 text-sm text-expense">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            Sync paused: {sync.error}. Retrying automatically.
          </p>
        )}
        {sync.dataNotice && <p role="status" className="text-sm text-expense">{sync.dataNotice}</p>}
        {q ? (
          <div className="space-y-3 text-sm">
            <div className="space-y-1.5">
              <div className="flex justify-between"><span className="text-ink-3">Records</span><span className="num">{q.records.toLocaleString("en-PH")} / {q.maxRecords.toLocaleString("en-PH")}</span></div>
              <Progress value={recPct} color={recPct >= 90 ? "var(--color-gold)" : undefined} />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between"><span className="text-ink-3">Size</span><span className="num">{mb(q.bytes)} / {mb(q.maxBytes)}</span></div>
              <Progress value={bytePct} color={bytePct >= 90 ? "var(--color-gold)" : undefined} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-3">Usage appears after the first sync.</p>
        )}
      </Card>

      <p className="px-1 text-xs text-ink-3">
        Sign out, two-factor sign-in and deleting cloud data are in <Link href="/settings" className="font-medium text-brand">Settings → Account</Link>.
      </p>
    </>
  );
}

function mb(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(bytes < 1024 * 1024 ? 2 : 1)} MB`;
}

function relTime(ms: number) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 45) return "Just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return new Date(ms).toLocaleString("en-PH", { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" });
}
