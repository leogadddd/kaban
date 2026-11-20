"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle, Cloud, CloudOff, Download, HardDrive, RefreshCw, Settings2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CLOUD_BENEFITS } from "@/components/cloud-benefits";
import { confirmDialog } from "@/components/dialog";
import { HapticLink } from "@/components/haptic-button";
import { Button, ButtonLink, Card, cx, PageHeader, Progress, SectionTitle } from "@/components/ui";
import { isActiveDatabase, useLedgerDatabase } from "@/lib/db";
import { useMeta, useOnline } from "@/lib/hooks";
import { exportBackup, importBackup, MAX_BACKUP_BYTES, prepareBackupImport, setMeta } from "@/lib/repo";
import { recoveryBackup, runSync, useSyncState, type SyncState } from "@/lib/sync";
import { useSyncPrefs } from "@/lib/sync-prefs";

export default function SyncPage() {
  const sync = useSyncState();
  const signedIn = !!sync.userId && sync.phase !== "mfa";

  return (
    <>
      <PageHeader
        title="Sync & backup"
        back="/home"
        privacy={false}
        action={
          sync.configured && (
            <HapticLink href="/settings/sync" aria-label="Sync settings" className="grid size-11 place-items-center rounded-full border border-line bg-surface">
              <Settings2 className="size-4" />
            </HapticLink>
          )
        }
      />
      <div className="space-y-4 px-4 pb-6">
        <StatusCard sync={sync} signedIn={signedIn} />
        {sync.configured && (signedIn ? <SignedIn sync={sync} /> : <WhyCloud />)}
        <BackupCard signedIn={signedIn} />
      </div>
    </>
  );
}

function StatusCard({ sync, signedIn }: { sync: SyncState; signedIn: boolean }) {
  const online = useOnline();
  return (
    <Card className="flex items-center gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-pale text-brand">
        {signedIn ? <Cloud className="size-5" /> : <HardDrive className="size-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{signedIn ? "Cloud sync on" : "On this device only"}</p>
        <p className="truncate text-sm text-ink-3">{signedIn ? sync.email : "Not backed up"}</p>
      </div>
      <span className={cx("flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", online ? "bg-pale text-brand" : "bg-expense/10 text-expense")}>
        {online ? <Cloud className="size-3.5" /> : <CloudOff className="size-3.5" />} {online ? "Online" : "Offline"}
      </span>
    </Card>
  );
}

// ---------- Signed out ----------

function WhyCloud() {
  return (
    <Card className="space-y-4">
      <p className="font-semibold">Why add a cloud account?</p>
      <ul className="space-y-3">
        {CLOUD_BENEFITS.map(({ icon: Icon, t }) => (
          <li key={t} className="flex items-center gap-3 text-sm">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-pale text-brand"><Icon className="size-4" /></span>
            {t}
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-2">
        <ButtonLink href="/signup" wrapperClassName="grid" className="min-h-11 px-3 text-sm whitespace-nowrap">Create account</ButtonLink>
        <ButtonLink href="/login" variant="secondary" wrapperClassName="grid" className="min-h-11 px-3 text-sm">Sign in</ButtonLink>
      </div>
      <p className="text-xs text-ink-3">Free and optional. To move this ledger, export a backup, sign in, then import it.</p>
    </Card>
  );
}

// ---------- Signed in ----------

function SignedIn({ sync }: { sync: SyncState }) {
  const db = useLedgerDatabase();
  const queue = useLiveQuery(() => (db ? db.outbox.toArray() : []), [db]) ?? [];
  const prefs = useSyncPrefs();
  const busy = sync.phase === "syncing";
  const waiting = queue.filter((q) => q.status === "pending" || q.status === "quota").length;
  const rejected = queue.filter((q) => q.status === "conflict").length;
  const q = sync.quota;

  return (
    <>
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold">{busy ? "Syncing…" : sync.lastSyncedAt ? `Synced ${relTime(sync.lastSyncedAt)}` : "Not synced yet"}</p>
            <p className="text-sm text-ink-3">
              {waiting ? `${waiting} change${waiting === 1 ? "" : "s"} waiting` : "Everything uploaded"}
              {rejected ? ` · ${rejected} rejected` : ""}
              {" · "}
              {prefs.auto ? `auto every ${prefs.intervalMin} min` : "manual"}
            </p>
          </div>
        </div>
        {sync.phase === "full" && <Alert tone="gold">Cloud storage is full. Changes stay here until there&apos;s room.</Alert>}
        {sync.phase === "error" && sync.error && <Alert tone="expense">Sync paused: {sync.error}. Retrying automatically.</Alert>}
        {sync.dataNotice && <Alert tone="expense">{sync.dataNotice}</Alert>}
        <Button wrapperClassName="w-full" className="w-full" onClick={() => void runSync()} disabled={busy}>
          <RefreshCw className={cx("size-4", busy && "animate-spin")} /> {busy ? "Syncing…" : "Sync now"}
        </Button>
      </Card>

      <Card className="space-y-3">
        <p className="font-semibold">Cloud storage</p>
        {q ? (
          <div className="space-y-3 text-sm">
            <Meter label="Records" used={q.records} max={q.maxRecords} format={(n) => n.toLocaleString("en-PH")} />
            <Meter label="Size" used={q.bytes} max={q.maxBytes} format={mb} />
          </div>
        ) : (
          <p className="text-sm text-ink-3">Shows after the first sync.</p>
        )}
      </Card>
    </>
  );
}

function Meter({ label, used, max, format }: { label: string; used: number; max: number; format: (n: number) => string }) {
  const pct = (used / max) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between">
        <span className="text-ink-3">{label}</span>
        <span className="num">{format(used)} / {format(max)}</span>
      </div>
      <Progress value={pct} color={pct >= 90 ? "var(--color-gold)" : undefined} />
    </div>
  );
}

function Alert({ tone, children }: { tone: "gold" | "expense"; children: React.ReactNode }) {
  return (
    <p className={cx("flex gap-2 rounded-2xl p-3 text-sm", tone === "gold" ? "bg-gold/10 text-ink-2" : "bg-expense/10 text-expense")} role="status">
      <AlertTriangle className={cx("mt-0.5 size-4 shrink-0", tone === "gold" && "text-gold")} />
      <span>{children}</span>
    </p>
  );
}

// ---------- Backup ----------

function BackupCard({ signedIn }: { signedIn: boolean }) {
  const db = useLedgerDatabase();
  const lastBackup = useMeta<number>("lastBackup");
  const recoveryAvailable = useMeta<boolean>("recoveryAvailable");
  const [usage, setUsage] = useState<string>();
  const [msg, setMsg] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => e.usage && setUsage(mb(e.usage))).catch(() => {});
  }, []);

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
        body: `Add ${preview.added} and update ${preview.updated} records. Newer versions win.${signedIn ? " Changes will sync to this account." : ""}`,
        confirmLabel: "Import backup",
      }))) return;
      const res = await importBackup(preview);
      setMsg(`Imported: ${res.added} new, ${res.updated} updated.`);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  return (
    <section>
      <SectionTitle>Backup file</SectionTitle>
      <Card className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" className="px-2 text-sm" onClick={() => doExport()}><Download className="size-4 shrink-0" /> Export</Button>
          <Button variant="secondary" className="px-2 text-sm" onClick={() => fileRef.current?.click()}><Upload className="size-4 shrink-0" /> Import</Button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (file) void doImport(file);
        }} />
        <p className="text-xs text-ink-3">
          Last export: {lastBackup ? new Date(lastBackup).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "never"}
          {usage && ` · ${usage} on this device`}
        </p>
        {recoveryAvailable && (
          <div className="rounded-2xl bg-gold/10 p-3 text-sm text-ink-2">
            <p>Cloud data was reset. This browser kept a copy of your old records.</p>
            <Button variant="ghost" wrapperClassName="mt-1" className="min-h-10 px-2" onClick={() => doExport(true)}><Download className="size-4" /> Export recovery copy</Button>
          </div>
        )}
        {msg && <p className="rounded-2xl bg-pale p-3 text-sm text-brand" role="status">{msg}</p>}
      </Card>
    </section>
  );
}

function mb(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(bytes < 1024 * 1024 ? 2 : 1)} MB`;
}

function relTime(ms: number) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return new Date(ms).toLocaleString("en-PH", { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" });
}
