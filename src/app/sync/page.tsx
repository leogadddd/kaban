"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Cloud, CloudOff, Download, HardDrive, ShieldCheck, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Card, cx, PageHeader, SectionTitle } from "@/components/ui";
import { db } from "@/lib/db";
import { useMeta, useOnline } from "@/lib/hooks";
import { exportBackup, importBackup, setMeta } from "@/lib/repo";

export default function SyncPage() {
  const online = useOnline();
  const lastBackup = useMeta<number>("lastBackup");
  const queue = useLiveQuery(() => db.outbox.toArray()) ?? [];
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<string>();
  const [msg, setMsg] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(false));
    navigator.storage?.estimate?.().then((e) => e.usage && setUsage(`${(e.usage / 1024 / 1024).toFixed(1)} MB used`));
  }, []);

  const counts = { pending: 0, failed: 0, conflict: 0 } as Record<string, number>;
  for (const q of queue) counts[q.status] = (counts[q.status] ?? 0) + 1;

  async function doExport() {
    const data = await exportBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const name = `kaban-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([blob], name, { type: "application/json" });
    // iOS: share sheet lets the user save to Files / iCloud Drive.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Kaban backup" });
        await setMeta("lastBackup", Date.now());
        return;
      } catch {
        /* cancelled → fall through to download */
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    await setMeta("lastBackup", Date.now());
  }

  async function doImport(f: File) {
    try {
      const res = await importBackup(JSON.parse(await f.text()));
      setMsg(`Merged backup: ${res.added} new, ${res.updated} updated records. Nothing was overwritten with older data.`);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  return (
    <>
      <PageHeader title="Sync & backup" back="/home" />
      <div className="space-y-4 px-4">
        <Card className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-pale text-brand"><HardDrive className="size-5" /></span>
            <div className="flex-1">
              <p className="font-semibold">Local only</p>
              <p className="text-sm text-ink-3">Records are stored on this device in IndexedDB.</p>
            </div>
            <span className={cx("flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", online ? "bg-pale text-brand" : "bg-expense/10 text-expense")}>
              {online ? <Cloud className="size-3.5" /> : <CloudOff className="size-3.5" />} {online ? "Online" : "Offline"}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-ink-3">Queued changes</dt>
            <dd className="num text-right">{counts.pending} pending{counts.failed ? ` · ${counts.failed} failed` : ""}{counts.conflict ? ` · ${counts.conflict} conflicts` : ""}</dd>
            <dt className="text-ink-3">Storage</dt>
            <dd className="text-right">{persisted ? <span className="inline-flex items-center gap-1 text-income"><ShieldCheck className="size-4" /> Protected</span> : "Best-effort"}{usage ? ` · ${usage}` : ""}</dd>
            <dt className="text-ink-3">Last backup</dt>
            <dd className="text-right">{lastBackup ? new Date(lastBackup).toLocaleString("en-PH") : "Never"}</dd>
          </dl>
          <p className="rounded-2xl bg-gold/10 p-3 text-xs text-ink-2">
            Every change is also written to a durable sync queue, so when cloud sync is switched on it can upload your history without duplicates. Until then, export a backup regularly — clearing Safari website data deletes local records.
          </p>
        </Card>

        <section>
          <SectionTitle>Backup</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={doExport}><Download className="size-4" /> Export</Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}><Upload className="size-4" /> Import</Button>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
          {msg && <p className="mt-3 rounded-2xl bg-pale p-3 text-sm text-brand" role="status">{msg}</p>}
          <p className="mt-2 px-1 text-xs text-ink-3">Import merges by record ID and keeps the newest version of each record, so restoring onto a device that already has data won&apos;t silently overwrite it.</p>
        </section>

        <Card className="space-y-2">
          <p className="flex items-center gap-2 font-semibold"><Cloud className="size-4 text-brand" /> Cloud sync</p>
          <p className="text-sm text-ink-3">Optional sign-in for multi-device backup is planned. It needs a sync server and is not connected in this build.</p>
          <Button disabled className="w-full">Sign in to enable sync</Button>
        </Card>
      </div>
    </>
  );
}
