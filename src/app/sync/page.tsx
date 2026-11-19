"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle, Cloud, CloudOff, Download, HardDrive, KeyRound, LogOut, RefreshCw, ShieldCheck, Smartphone, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Card, cx, Field, inputCls, PageHeader, Progress, SectionTitle } from "@/components/ui";
import { db } from "@/lib/db";
import { useMeta, useOnline } from "@/lib/hooks";
import { exportBackup, importBackup, setMeta } from "@/lib/repo";
import {
  confirmAuthenticator,
  deleteCloudData,
  listAuthenticators,
  removeAuthenticator,
  runSync,
  sendPasswordReset,
  setNewPassword,
  signIn,
  signOut,
  signUp,
  startAuthenticatorEnrollment,
  unsyncedCount,
  useSyncState,
  verifySignInCode,
  type SyncState,
} from "@/lib/sync";

export default function SyncPage() {
  const online = useOnline();
  const sync = useSyncState();
  const lastBackup = useMeta<number>("lastBackup");
  const queue = useLiveQuery(() => db.outbox.toArray()) ?? [];
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

  const queued = counts.pending + counts.quota;

  return (
    <>
      <PageHeader title="Sync & backup" back="/home" />
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
              Every change is also written to a durable sync queue, so when you sign in it all uploads without duplicates. Until then, export a backup regularly — clearing Safari website data deletes local records.
            </p>
          )}
        </Card>

        <CloudSection sync={sync} />

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
  if (sync.recovering) return <NewPasswordCard />;
  if (sync.phase === "mfa") return <MfaCard />;
  if (!sync.userId) return <AuthCard />;
  return <AccountCard sync={sync} />;
}

// ---------- Signed out ----------

function AuthCard() {
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [note, setNote] = useState<string>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    setNote(undefined);
    setBusy(true);
    try {
      if (mode === "signin") await signIn(email.trim(), password);
      else if (mode === "signup") {
        if (password.length < 8) throw new Error("Use at least 8 characters");
        const { needsConfirm } = await signUp(email.trim(), password);
        if (needsConfirm) setNote("Check your email to confirm your account, then sign in here.");
      } else {
        await sendPasswordReset(email.trim());
        setNote("If that email has an account, a reset link is on its way.");
      }
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3">
      <div>
        <p className="flex items-center gap-2 font-semibold"><Cloud className="size-4 text-brand" /> Cloud sync</p>
        <p className="mt-1 text-sm text-ink-3">
          Sign in to back up and sync across devices. Kaban stays just as fast — it still saves to this device first and uploads in the background.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Email">
          {(id) => <input id={id} type="email" autoComplete="email" required className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        {mode !== "reset" && (
          <Field label="Password">
            {(id) => (
              <input
                id={id}
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
                minLength={mode === "signup" ? 8 : undefined}
                className={inputCls}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </Field>
        )}
        {error && <p className="px-1 text-sm text-expense" role="alert">{error}</p>}
        {note && <p className="rounded-2xl bg-pale p-3 text-sm text-brand" role="status">{note}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
        </Button>
      </form>
      <div className="flex justify-between gap-2 text-sm">
        <button type="button" className="min-h-10 text-brand" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
          {mode === "signup" ? "Have an account? Sign in" : "Create an account"}
        </button>
        {mode !== "reset" && (
          <button type="button" className="min-h-10 text-ink-3" onClick={() => setMode("reset")}>Forgot password?</button>
        )}
      </div>
      <p className="text-xs text-ink-3">Records already on this device are uploaded to your account when you first sign in.</p>
    </Card>
  );
}

function NewPasswordCard() {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <Card className="space-y-3">
      <p className="flex items-center gap-2 font-semibold"><KeyRound className="size-4 text-brand" /> Set a new password</p>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(undefined);
          try {
            if (pw.length < 8) throw new Error("Use at least 8 characters");
            await setNewPassword(pw);
          } catch (err) {
            setError(friendly(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="New password" error={error}>
          {(id) => <input id={id} type="password" autoComplete="new-password" minLength={8} required className={inputCls} value={pw} onChange={(e) => setPw(e.target.value)} />}
        </Field>
        <Button type="submit" className="w-full" disabled={busy}>Save password</Button>
      </form>
    </Card>
  );
}

function CodeInput({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <input
      id={id}
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]{6}"
      maxLength={6}
      required
      className={cx(inputCls, "num text-center text-xl tracking-[0.4em]")}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
    />
  );
}

function MfaCard() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <Card className="space-y-3">
      <p className="flex items-center gap-2 font-semibold"><Smartphone className="size-4 text-brand" /> Two-factor check</p>
      <p className="text-sm text-ink-3">Enter the 6-digit code from your authenticator app to finish signing in.</p>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(undefined);
          try {
            await verifySignInCode(code);
          } catch (err) {
            setError(friendly(err));
            setCode("");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Code" error={error}>{(id) => <CodeInput id={id} value={code} onChange={setCode} />}</Field>
        <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>Verify</Button>
      </form>
      <Button
        variant="ghost"
        className="w-full"
        onClick={async () => {
          await signOut();
          router.replace("/welcome");
        }}
      >
        Cancel and sign out
      </Button>
    </Card>
  );
}

// ---------- Signed in ----------

function AccountCard({ sync }: { sync: SyncState }) {
  const router = useRouter();
  const q = sync.quota;
  const recPct = q ? (q.records / q.maxRecords) * 100 : 0;
  const bytePct = q ? (q.bytes / q.maxBytes) * 100 : 0;

  async function doSignOut() {
    const n = await unsyncedCount();
    const warn = n ? `\n\n${n} change${n === 1 ? " hasn't" : "s haven't"} reached the cloud yet and will be lost.` : "";
    if (!confirm(`Sign out? Kaban data will be erased from this device; your cloud copy stays.${warn}`)) return;
    await signOut();
    router.replace("/welcome");
  }

  async function doDeleteCloud() {
    if (!confirm("Delete everything stored in the cloud for this account? This device keeps its data as a local-only copy and signs out.")) return;
    if (!confirm("This can't be undone. Delete cloud data?")) return;
    try {
      await deleteCloudData();
    } catch (e) {
      alert((e as Error).message);
    }
  }

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

      <TwoFactorCard />

      <Card className="space-y-2">
        <SectionTitle>Account</SectionTitle>
        <Button variant="secondary" className="w-full" onClick={doSignOut}><LogOut className="size-4" /> Sign out</Button>
        <Button variant="danger" className="w-full" onClick={doDeleteCloud}><Trash2 className="size-4" /> Delete cloud data</Button>
      </Card>
    </>
  );
}

function TwoFactorCard() {
  const [factors, setFactors] = useState<{ id: string }[] | null>(null);
  const [enroll, setEnroll] = useState<{ factorId: string; qr: string; secret: string }>();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const refresh = () => listAuthenticators().then(setFactors).catch(() => setFactors([]));
  useEffect(() => {
    void refresh();
  }, []);

  const on = !!factors?.length;

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold"><Smartphone className="size-4 text-brand" /> Two-factor sign-in</p>
        {factors && <span className={cx("rounded-full px-2.5 py-1 text-xs font-medium", on ? "bg-pale text-brand" : "bg-line/60 text-ink-3")}>{on ? "On" : "Off"}</span>}
      </div>
      <p className="text-sm text-ink-3">Ask for a code from an authenticator app (Google Authenticator, 1Password, Authy…) whenever this account signs in on a new device.</p>

      {enroll ? (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(undefined);
            try {
              await confirmAuthenticator(enroll.factorId, code);
              setEnroll(undefined);
              setCode("");
              await refresh();
            } catch (err) {
              setError(friendly(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enroll.qr} alt="QR code for your authenticator app" className="mx-auto size-44 rounded-2xl border border-line bg-white p-2" />
          <p className="text-center text-xs text-ink-3">
            Scan it, or enter this key: <span className="num break-all text-ink-2 select-all">{enroll.secret}</span>
          </p>
          <Field label="Code from the app" error={error}>{(id) => <CodeInput id={id} value={code} onChange={setCode} />}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="secondary" onClick={() => setEnroll(undefined)}>Cancel</Button>
            <Button type="submit" disabled={busy || code.length !== 6}>Turn on</Button>
          </div>
        </form>
      ) : on ? (
        <Button
          variant="secondary"
          className="w-full"
          disabled={busy}
          onClick={async () => {
            if (!confirm("Turn off two-factor sign-in?")) return;
            setBusy(true);
            try {
              for (const f of factors!) await removeAuthenticator(f.id);
              await refresh();
            } catch (err) {
              setError(friendly(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          Turn off
        </Button>
      ) : (
        <Button
          variant="secondary"
          className="w-full"
          disabled={busy || !factors}
          onClick={async () => {
            setBusy(true);
            setError(undefined);
            try {
              setEnroll(await startAuthenticatorEnrollment());
            } catch (err) {
              setError(friendly(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <ShieldCheck className="size-4" /> Set up authenticator app
        </Button>
      )}
      {error && !enroll && <p className="px-1 text-sm text-expense" role="alert">{error}</p>}
    </Card>
  );
}

/** Turn Supabase / fetch errors into something a person can act on. */
function friendly(err: unknown) {
  const m = (err as Error)?.message ?? String(err);
  if (/failed to fetch|networkerror|load failed/i.test(m)) return "Can't reach the server. Check your connection and try again.";
  if (/invalid login credentials/i.test(m)) return "That email and password don't match.";
  if (/email not confirmed/i.test(m)) return "Confirm your email first — check your inbox for the link.";
  if (/invalid totp|invalid.*code/i.test(m)) return "That code didn't work. Try the newest one from your app.";
  return m;
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
