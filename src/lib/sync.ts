// Background cloud sync. Nothing here is on the UI's write or read path: screens only touch IndexedDB,
// repo.ts appends to the outbox in the same transaction, and this module drains the outbox to Supabase
// and pulls other devices' changes whenever it gets a chance (after writes, on focus, when back online,
// and on a slow timer). If the cloud is slow, down or full, the app keeps working locally.
import { useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import { db } from "./db";
import { enqueueEverything, getMeta, rebuildInstalments, setMeta, wipeAll } from "./repo";
import { cloudConfigured, supabase } from "./supabase";
import type { OutboxEntry } from "./types";

export type SyncPhase = "off" | "signed-out" | "mfa" | "idle" | "syncing" | "offline" | "error" | "full";

export interface CloudQuota {
  records: number;
  maxRecords: number;
  bytes: number;
  maxBytes: number;
}

export interface SyncState {
  configured: boolean;
  phase: SyncPhase;
  email?: string;
  userId?: string;
  lastSyncedAt?: number;
  error?: string;
  quota?: CloudQuota;
  /** Arrived from a password-reset email: show the "set a new password" form. */
  recovering: boolean;
}

// ---------- Observable state ----------

let state: SyncState = { configured: cloudConfigured, phase: cloudConfigured ? "signed-out" : "off", recovering: false };
const SERVER_STATE: SyncState = state;
const listeners = new Set<() => void>();

function set(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => SERVER_STATE,
  );
}

// ---------- Scheduling ----------

const PUSH_BATCH = 200;
const PULL_BATCH = 500;
const IDLE_INTERVAL = 60_000;
const QUOTA_RETRY = 10 * 60_000;

let started = false;
let session: Session | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;
let rerun = false;
let failures = 0;
let lastQuotaRetry = 0;
/** Bumped on sign-out so an in-flight pull can't write a previous account's rows after the wipe. */
let epoch = 0;

/** Run a sync after `delay` ms, coalescing with any sync already scheduled sooner. */
export function scheduleSync(delay = 0) {
  if (!session || state.phase === "mfa") return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void runSync(), delay);
}

/** Called once from the app shell. Safe to call again. */
export function startSync() {
  if (started || !cloudConfigured || typeof window === "undefined") return;
  started = true;
  const sb = supabase()!;

  sb.auth.onAuthStateChange((event, s) => {
    // Never await Supabase calls inside this callback (it holds the auth lock); hop out first.
    setTimeout(() => void onAuth(event, s), 0);
  });

  window.addEventListener("online", () => scheduleSync(0));
  window.addEventListener("offline", () => session && set({ phase: "offline" }));
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && scheduleSync(500));
  // Any local write lands in the outbox: push it shortly after, batching bursts of edits.
  db.outbox.hook("creating", () => {
    scheduleSync(1500);
  });
  setInterval(() => document.visibilityState === "visible" && scheduleSync(0), IDLE_INTERVAL);
}

async function onAuth(event: string, s: Session | null) {
  if (event === "PASSWORD_RECOVERY") set({ recovering: true });
  session = s;
  if (!s) {
    if (timer) clearTimeout(timer);
    set({ phase: "signed-out", email: undefined, userId: undefined, quota: undefined, error: undefined });
    return;
  }
  set({ email: s.user.email, userId: s.user.id });

  const { data: aal } = await supabase()!.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    set({ phase: "mfa" });
    return;
  }

  // First sync of this account on this device.
  const owner = await getMeta<string>("syncUser");
  if (owner !== s.user.id) {
    // Data left by a different account never gets merged into this one.
    if (owner) {
      await wipeAll();
      await setMeta("mode", "local");
      await setMeta("startedAt", Date.now());
    }
    // Local-only data (made before signing in) is uploaded into this account.
    await enqueueEverything();
    await setMeta("syncUser", s.user.id);
    await setMeta("syncCursor", 0);
  }
  if (state.phase === "signed-out" || state.phase === "mfa" || state.phase === "off") set({ phase: "idle" });
  lastQuotaRetry = 0;
  scheduleSync(0);
}

// ---------- The sync cycle ----------

export async function runSync() {
  if (!session || state.phase === "mfa") return;
  if (running) {
    rerun = true;
    return;
  }
  if (!navigator.onLine) {
    set({ phase: "offline" });
    return;
  }
  running = true;
  set({ phase: "syncing", error: undefined });
  try {
    const full = await push();
    await pull();
    const quota = await fetchQuota();
    failures = 0;
    const now = Date.now();
    await setMeta("lastSync", now);
    set({ phase: full ? "full" : "idle", lastSyncedAt: now, quota: quota ?? state.quota });
  } catch (e) {
    failures++;
    set({ phase: navigator.onLine ? "error" : "offline", error: (e as Error).message });
    // Back off: 5s, 10s, 20s … capped at 5 min.
    scheduleSync(Math.min(5 * 60_000, 5000 * 2 ** (failures - 1)));
  } finally {
    running = false;
    if (rerun) {
      rerun = false;
      scheduleSync(0);
    }
  }
}

type ChangeStatus = "ok" | "stale" | "quota" | "invalid";

/** Drain the outbox. Returns true when the cloud refused something for lack of space. */
async function push(): Promise<boolean> {
  const sb = supabase()!;
  let hitQuota = false;
  // Quota-rejected changes are retried occasionally (the user may have freed space or had the limit raised).
  const retryQuota = Date.now() - lastQuotaRetry > QUOTA_RETRY;
  if (retryQuota) lastQuotaRetry = Date.now();
  const attempted = new Set<string>();

  for (;;) {
    const batch = await db.outbox
      .orderBy("createdAt")
      .filter((e) => !attempted.has(e.mutationId) && (e.status === "pending" || (retryQuota && e.status === "quota")))
      .limit(PUSH_BATCH)
      .toArray();
    if (!batch.length) break;
    batch.forEach((e) => attempted.add(e.mutationId));

    // Only the newest queued version of each record needs to go up.
    const groups = new Map<string, OutboxEntry[]>();
    for (const e of batch) {
      const k = `${e.entity}:${e.entityId}`;
      groups.set(k, [...(groups.get(k) ?? []), e]);
    }
    const changes = [...groups.values()].map((g) => {
      const top = g.reduce((a, b) => (b.version > a.version || (b.version === a.version && b.createdAt > a.createdAt) ? b : a));
      const payload = top.payload as { updatedAt?: number } | null;
      return {
        entity: top.entity,
        id: top.entityId,
        version: top.version,
        updated_ms: payload?.updatedAt ?? 0,
        deleted: top.op === "delete",
        data: top.op === "delete" ? null : top.payload,
      };
    });

    const { data, error } = await sb.rpc("push_records", { p_changes: changes });
    if (error) throw new Error(error.message);

    const results = new Map((data as { entity: string; id: string; status: ChangeStatus }[]).map((r) => [`${r.entity}:${r.id}`, r.status]));
    await db.transaction("rw", db.outbox, async () => {
      for (const [k, entries] of groups) {
        const status = results.get(k);
        const ids = entries.map((e) => e.mutationId);
        if (status === "ok" || status === "stale") {
          await db.outbox.bulkDelete(ids);
        } else if (status === "quota") {
          hitQuota = true;
          await db.outbox.where("mutationId").anyOf(ids).modify({ status: "quota", lastError: "Cloud storage is full" });
        } else {
          await db.outbox
            .where("mutationId")
            .anyOf(ids)
            .modify((e) => {
              e.status = "conflict";
              e.attempts++;
              e.lastError = "Rejected by the server";
            });
        }
      }
    });
  }
  return hitQuota || (await db.outbox.where("status").equals("quota").count()) > 0;
}

const TABLES = {
  account: () => db.accounts,
  transaction: () => db.transactions,
  person: () => db.people,
  debt: () => db.debts,
  split: () => db.splits,
} as const;
type Entity = keyof typeof TABLES;

interface RemoteRecord {
  entity: Entity;
  id: string;
  version: number;
  updated_ms: number;
  data: Record<string, unknown> | null;
  deleted: boolean;
  server_seq: number;
}

const newer = (a: [number, number], b: [number, number]) => a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]);

/** Fetch everything other devices pushed since our cursor and merge it in; newest (version, updatedAt) wins. */
async function pull() {
  const sb = supabase()!;
  const mine = epoch;
  for (;;) {
    const cursor = (await getMeta<number>("syncCursor")) ?? 0;
    const { data, error } = await sb
      .from("records")
      .select("entity,id,version,updated_ms,data,deleted,server_seq")
      .gt("server_seq", cursor)
      .order("server_seq")
      .limit(PULL_BATCH);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as RemoteRecord[];
    if (!rows.length) return;

    const touchedTxns = new Set<string>();
    const touchedAccounts = new Set<string>();
    let aborted = false;
    await db.transaction("rw", [db.accounts, db.transactions, db.people, db.debts, db.splits, db.outbox, db.meta], async () => {
      if (mine !== epoch) {
        aborted = true;
        return;
      }
      // A local change still waiting to upload outranks an older remote copy (e.g. a split deleted here).
      const queued = new Map<string, [number, number]>();
      for (const e of await db.outbox.where("status").anyOf("pending", "quota", "conflict", "failed").toArray()) {
        const k = `${e.entity}:${e.entityId}`;
        const v: [number, number] = [e.version, (e.payload as { updatedAt?: number } | null)?.updatedAt ?? 0];
        const prev = queued.get(k);
        if (!prev || newer(v, prev)) queued.set(k, v);
      }
      for (const r of rows) {
        const table = TABLES[r.entity]?.();
        if (!table) continue;
        const remote: [number, number] = [r.version, r.updated_ms];
        const q = queued.get(`${r.entity}:${r.id}`);
        if (q && !newer(remote, q)) continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const t = table as any;
        const local = await t.get(r.id);
        const localV: [number, number] = [local?.version ?? 1, local?.updatedAt ?? 0];
        if (r.deleted) {
          if (local) await t.delete(r.id);
        } else if (!local || newer(remote, localV)) {
          await t.put(r.data);
        } else continue;
        if (r.entity === "transaction") touchedTxns.add(r.id);
        if (r.entity === "account") touchedAccounts.add(r.id);
      }
      await db.meta.put({ key: "syncCursor", value: rows[rows.length - 1].server_seq });
    });

    if (aborted) return;
    // Instalment schedules are derived locally from the purchase and the card's billing cycle.
    if (touchedAccounts.size) {
      const onCards = await db.transactions.where("accountId").anyOf([...touchedAccounts]).toArray();
      onCards.forEach((t) => touchedTxns.add(t.id));
    }
    if (touchedTxns.size) await rebuildInstalments(touchedTxns);
    if (rows.length < PULL_BATCH) return;
  }
}

async function fetchQuota(): Promise<CloudQuota | undefined> {
  const { data, error } = await supabase()!.from("user_quota").select("record_count,max_records,byte_count,max_bytes").maybeSingle();
  if (error || !data) return undefined;
  return { records: data.record_count, maxRecords: data.max_records, bytes: Number(data.byte_count), maxBytes: Number(data.max_bytes) };
}

// ---------- Account actions (used by the Sync page) ----------

function sb() {
  const c = supabase();
  if (!c) throw new Error("Cloud sync isn't configured in this build");
  return c;
}

const redirect = () => `${window.location.origin}/sync`;

export async function signUp(email: string, password: string): Promise<{ needsConfirm: boolean }> {
  const { data, error } = await sb().auth.signUp({ email, password, options: { emailRedirectTo: redirect() } });
  if (error) throw error;
  return { needsConfirm: !data.session };
}

export async function signIn(email: string, password: string) {
  const { error } = await sb().auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function sendPasswordReset(email: string) {
  const { error } = await sb().auth.resetPasswordForEmail(email, { redirectTo: redirect() });
  if (error) throw error;
}

export async function setNewPassword(password: string) {
  const { error } = await sb().auth.updateUser({ password });
  if (error) throw error;
  set({ recovering: false });
}

/** Unsynced changes that signing out would destroy. */
export function unsyncedCount() {
  return db.outbox.where("status").anyOf("pending", "failed", "quota", "conflict").count();
}

/** Sign out and erase this device's copy (it can be pulled back down by signing in again). */
export async function signOut() {
  if (timer) clearTimeout(timer);
  session = null;
  epoch++;
  await sb().auth.signOut({ scope: "local" });
  await wipeAll();
}

/** Delete every record in the cloud, then sign out but keep this device's data as a local-only ledger. */
export async function deleteCloudData() {
  const { error } = await sb().rpc("delete_my_cloud_data");
  if (error) throw error;
  if (timer) clearTimeout(timer);
  session = null;
  epoch++;
  await sb().auth.signOut({ scope: "local" });
  await db.outbox.clear();
  await db.meta.bulkDelete(["syncUser", "syncCursor", "lastSync"]);
}

// ---------- Two-factor (authenticator app) ----------

export async function verifySignInCode(code: string) {
  const c = sb();
  const { data, error } = await c.auth.mfa.listFactors();
  if (error) throw error;
  const factor = data.totp.find((f) => f.status === "verified");
  if (!factor) throw new Error("No authenticator is set up for this account");
  const res = await c.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (res.error) throw res.error;
  // The session upgrades to aal2 and onAuthStateChange resumes syncing.
}

export async function listAuthenticators() {
  const { data, error } = await sb().auth.mfa.listFactors();
  if (error) throw error;
  return data.totp.filter((f) => f.status === "verified");
}

export async function startAuthenticatorEnrollment() {
  const c = sb();
  // Clear abandoned half-finished enrollments first; Supabase refuses duplicates.
  const { data: list } = await c.auth.mfa.listFactors();
  for (const f of list?.all ?? []) if (f.status === "unverified") await c.auth.mfa.unenroll({ factorId: f.id });
  const { data, error } = await c.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator app" });
  if (error) throw error;
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export async function confirmAuthenticator(factorId: string, code: string) {
  const { error } = await sb().auth.mfa.challengeAndVerify({ factorId, code });
  if (error) throw error;
}

export async function removeAuthenticator(factorId: string) {
  const { error } = await sb().auth.mfa.unenroll({ factorId });
  if (error) throw error;
}
