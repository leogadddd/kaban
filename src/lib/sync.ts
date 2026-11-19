import { liveQuery } from "dexie";
// Background cloud sync. Nothing here is on the UI's write or read path: screens only touch IndexedDB,
// repo.ts appends to the outbox in the same transaction, and this module drains the outbox to Supabase
// and pulls other devices' changes whenever it gets a chance (after writes, on focus, when back online,
// and on a slow timer). If the cloud is slow, down or full, the app keeps working locally.
import { useSyncExternalStore } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { allTables, databaseFor, getDatabase, ledgerTables, migrateLedger, showDatabase, type KabanDB } from "./db";
import { exportBackup, getMeta, rebuildInstalments, setMeta } from "./repo";
import { isEntity, validSyncedRecord } from "./record-validation";
import { cloudConfigured, supabase, syncClient } from "./supabase";
import type { OutboxEntry } from "./types";

export type SyncPhase = "off" | "starting" | "signed-out" | "mfa" | "idle" | "syncing" | "offline" | "error" | "full";

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
  dataNotice?: string;
  quota?: CloudQuota;
  /** Arrived from a password-reset email: show the "set a new password" form. */
  recovering: boolean;
}

// ---------- Observable state ----------

let state: SyncState = { configured: cloudConfigured, phase: "starting", recovering: false };
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

interface SyncAccount {
  session: Session;
  db: KabanDB;
  stopWatching: () => void;
}

let started = false;
let authChange = 0;
let account: SyncAccount | null = null;
let signingOut = false;
let deletingUser: string | undefined;
let recoveringUser: string | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;
let rerun = false;
let failures = 0;

export function scheduleSync(delay = 0) {
  if (!account) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void runSync(), delay);
}

/**
 * Sync right now (pull-to-refresh) and resolve once that run, and any rerun it queued, has settled.
 * Resolves false when there is no signed-in cloud account to sync.
 */
export function syncNow(timeout = 20_000): Promise<boolean> {
  if (!account) return Promise.resolve(false);
  if (timer) clearTimeout(timer);
  void runSync();
  const started = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      const busy = running || rerun || state.phase === "syncing";
      if (busy && Date.now() - started < timeout) setTimeout(check, 120);
      else resolve(true);
    };
    check();
  });
}

function stopSync() {
  account?.stopWatching();
  account = null;
  if (timer) clearTimeout(timer);
}

export function startSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  const client = supabase();
  if (!client) {
    queueAuth(null);
    return;
  }

  client.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") recoveringUser = session?.user.id;
    if (session?.user.id !== recoveringUser) recoveringUser = undefined;
    set({ recovering: !!recoveringUser });
    if (!signingOut && (!session || session.user.id !== deletingUser)) queueAuth(session, event);
  });
  window.addEventListener("online", () => scheduleSync());
  window.addEventListener("offline", () => account && set({ phase: "offline" }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") scheduleSync(500);
  });
  setInterval(() => {
    if (document.visibilityState === "visible") scheduleSync();
  }, IDLE_INTERVAL);
}

function assurance(session: Session) {
  const payload = session.access_token.split(".")[1];
  return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { aal?: string; session_id?: string };
}

function needsMfa(session: Session) {
  return assurance(session).aal !== "aal2" && !!session.user.factors?.some((factor) => factor.status === "verified");
}

function queueAuth(session: Session | null, event?: string) {
  const change = ++authChange;
  if (session && account?.session.user.id === session.user.id && event !== "USER_UPDATED") {
    const previous = assurance(account.session);
    const next = assurance(session);
    if (previous.session_id && previous.session_id === next.session_id && previous.aal === next.aal && !needsMfa(session)) {
      account.session = session;
      return;
    }
  }
  stopSync();
  showDatabase(null);
  set({ phase: "starting", userId: undefined, email: undefined, quota: undefined, error: undefined, dataNotice: undefined, lastSyncedAt: undefined });
  // Leave Supabase's auth callback before doing async work.
  setTimeout(() => {
    void activateAccount(session, change).catch((error: Error) => {
      if (change === authChange) set({ phase: "error", error: error.message });
    });
  }, 0);
}

async function activateAccount(session: Session | null, change: number) {
  if (change !== authChange) return;
  const userId = session?.user.id;
  if (session) {
    let mfa = needsMfa(session);
    if (navigator.onLine) {
      const { data, error } = await sb().auth.mfa.getAuthenticatorAssuranceLevel(session.access_token);
      if (change !== authChange) return;
      if (error && error.name !== "AuthRetryableFetchError") throw error;
      if (data) mfa = data.nextLevel === "aal2" && data.currentLevel !== "aal2";
    }
    if (mfa) {
      if (change === authChange) set({ phase: "mfa", userId, email: session.user.email });
      return;
    }
  }
  const db = databaseFor(userId);
  await migrateLedger(db, userId);
  if (session) {
    await db.transaction("rw", db.meta, async () => {
      if (!(await getMeta<string>("mode", db))) {
        await setMeta("mode", "local", db);
        await setMeta("startedAt", Date.now(), db);
      }
    });
  }
  if (change !== authChange) return;

  if (session) {
    // Observe the account's queue across tabs instead of relying on this tab's write events.
    const subscription = liveQuery(() => db.outbox.where("status").equals("pending").count()).subscribe({
      next(count) { if (account?.db === db && count) scheduleSync(1500); },
      error(error) { console.error("sync queue unavailable", error); },
    });
    account = { session, db, stopWatching: () => subscription.unsubscribe() };
  }
  showDatabase(db);
  failures = 0;
  set({ phase: session ? "idle" : cloudConfigured ? "signed-out" : "off", userId, email: session?.user.email });
  scheduleSync();
}

type ChangeStatus = "ok" | "stale" | "quota" | "invalid";

function checkError(error: { message: string; code?: string } | null) {
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
}

export async function runSync() {
  const current = account;
  if (!current) return;
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
  const { db } = current;
  const client = syncClient(current.session.access_token);
  try {
    const quota = await fetchQuota(client);
    if (account !== current) return;
    if (!await reconcileGeneration(db, quota.generation)) {
      rerun = true;
      return;
    }
    const full = await push(current, client, quota.generation);
    await pull(current, client, quota.generation);
    if (account !== current) return;
    const latest = await fetchQuota(client);
    if (latest.generation !== quota.generation) {
      rerun = true;
      return;
    }
    if (account !== current) return;
    const now = Date.now();
    await db.transaction("rw", db.meta, async () => {
      if (account === current && await getMeta<number>("syncGeneration", db) === latest.generation) {
        await setMeta("lastSync", now, db);
      }
    });
    if (account !== current) return;
    failures = 0;
    set({ phase: full ? "full" : "idle", lastSyncedAt: now, quota: latest });
  } catch (error) {
    if (account !== current) return;
    const code = (error as { code?: string }).code;
    if (code === "40001") {
      rerun = true;
    } else if (code === "28000") {
      // An authenticator can be enrolled on a different device after this ledger opened.
      stopSync();
      queueAuth(current.session);
    } else {
      failures++;
      set({ phase: navigator.onLine ? "error" : "offline", error: (error as Error).message });
      scheduleSync(Math.min(5 * 60_000, 5000 * 2 ** (failures - 1)));
    }
  } finally {
    running = false;
    if (rerun) {
      rerun = false;
      scheduleSync();
    }
  }
}

/** A generation change invalidates the old cursor, records and queued writes as one unit. */
async function reconcileGeneration(db: KabanDB, generation: number) {
  return db.transaction("rw", allTables(db), async () => {
    const previous = await getMeta<number>("syncGeneration", db);
    if (previous === generation) return true;
    if (previous !== undefined && previous > generation) return false;
    if (previous !== undefined || generation !== 1) {
      const snapshot = await exportBackup(db);
      if (snapshot.accounts.length || snapshot.transactions.length || snapshot.people.length || snapshot.debts.length || snapshot.splits.length) {
        await setMeta("recoveryBackup", snapshot, db);
        await setMeta("recoveryAvailable", true, db);
      }
      await Promise.all(ledgerTables(db).map((table) => table.clear()));
      await db.outbox.clear();
      await db.meta.bulkDelete(["syncCursor", "lastSync", "lastQuotaRetry", "launchAccount"]);
    }
    await setMeta("syncGeneration", generation, db);
    return true;
  });
}

async function push(current: SyncAccount, client: SupabaseClient, generation: number) {
  const { db } = current;
  const attempted = new Set<string>();
  let hitQuota = false;
  const lastQuotaRetry = await getMeta<number>("lastQuotaRetry", db) ?? 0;
  const retryQuota = Date.now() - lastQuotaRetry > QUOTA_RETRY;
  if (retryQuota) await setMeta("lastQuotaRetry", Date.now(), db);

  while (account === current) {
    const batch = await db.transaction("r", [db.meta, db.outbox], async () => {
      if (await getMeta<number>("syncGeneration", db) !== generation) return [];
      return db.outbox.orderBy("createdAt")
        .filter((entry) => !attempted.has(entry.mutationId) && (entry.status === "pending" || (retryQuota && entry.status === "quota")))
        .limit(PUSH_BATCH)
        .toArray();
    });
    if (!batch.length || account !== current) break;
    const groups = new Map<string, OutboxEntry[]>();
    for (const entry of batch) {
      attempted.add(entry.mutationId);
      const key = `${entry.entity}:${entry.entityId}`;
      const group = groups.get(key) ?? [];
      group.push(entry);
      groups.set(key, group);
    }
    const changes = [...groups.values()].map((group) => {
      const top = group.reduce((a, b) => b.version > a.version || (b.version === a.version && b.createdAt > a.createdAt) ? b : a);
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

    const { data, error } = await client.rpc("push_records", { p_changes: changes, p_generation: generation });
    checkError(error);
    const results = new Map((data as { entity: string; id: string; status: ChangeStatus }[]).map((row) => [`${row.entity}:${row.id}`, row.status]));
    await db.transaction("rw", [db.outbox, db.meta], async () => {
      if (account !== current || await getMeta<number>("syncGeneration", db) !== generation) return;
      for (const [key, entries] of groups) {
        const status = results.get(key);
        const ids = entries.map((entry) => entry.mutationId);
        if (status === "ok" || status === "stale") {
          await db.outbox.bulkDelete(ids);
        } else if (status === "quota") {
          hitQuota = true;
          await db.outbox.where("mutationId").anyOf(ids).modify({ status: "quota", lastError: "Cloud storage is full" });
        } else {
          await db.outbox.where("mutationId").anyOf(ids).modify((entry) => {
            entry.status = "conflict";
            entry.attempts++;
            entry.lastError = "The server rejected the record";
          });
        }
      }
    });
  }
  return hitQuota || await db.outbox.where("status").equals("quota").count() > 0;
}

interface RemoteRecord {
  entity: unknown;
  id: string;
  version: number;
  updated_ms: number;
  data: unknown;
  deleted: boolean;
  server_seq: number;
}

type Revision = [number, number];
const newer = (a: Revision, b: Revision) => a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]);

async function pull(current: SyncAccount, client: SupabaseClient, generation: number) {
  const { db } = current;
  const tables = { account: db.accounts, transaction: db.transactions, person: db.people, debt: db.debts, split: db.splits } as const;
  while (account === current) {
    const cursor = await getMeta<number>("syncCursor", db) ?? 0;
    const { data, error } = await client.rpc("pull_records", { p_generation: generation, p_cursor: cursor, p_limit: PULL_BATCH });
    checkError(error);
    const rows = data as RemoteRecord[];
    if (!rows.length) return;

    const outcome = await db.transaction("rw", allTables(db), async () => {
      if (account !== current || await getMeta<number>("syncGeneration", db) !== generation) return;
      // Another tab may already have applied this page. Never move its cursor backwards.
      if ((await getMeta<number>("syncCursor", db) ?? 0) !== cursor) return { retry: true, invalid: false };
      const touchedTxns = new Set<string>();
      const touchedAccounts = new Set<string>();
      const queued = new Map<string, Revision>();
      for (const entry of await db.outbox.where("status").anyOf("pending", "quota", "conflict", "failed").toArray()) {
        const key = `${entry.entity}:${entry.entityId}`;
        const revision: Revision = [entry.version, (entry.payload as { updatedAt?: number } | null)?.updatedAt ?? 0];
        const previous = queued.get(key);
        if (!previous || newer(revision, previous)) queued.set(key, revision);
      }
      let invalid = false;
      for (const row of rows) {
        if (!isEntity(row.entity)) {
          invalid = true;
          continue;
        }
        const remote: Revision = [row.version, row.updated_ms];
        const pending = queued.get(`${row.entity}:${row.id}`);
        if (pending && !newer(remote, pending)) continue;
        const table = tables[row.entity];
        const local = await table.get(row.id);
        const localRevision: Revision = [local && "version" in local ? local.version : 1, local && "updatedAt" in local ? local.updatedAt : 0];
        if (local && !newer(remote, localRevision)) continue;
        if (row.deleted) {
          await table.delete(row.id);
        } else if (!validSyncedRecord(row.entity, row.data) || row.data.id !== row.id
          || ("version" in row.data ? row.data.version !== row.version || row.data.updatedAt !== row.updated_ms : row.version !== 1 || row.updated_ms !== 0)) {
          invalid = true;
          continue;
        } else {
          // The entity check and validator above pair the payload with this table.
          await table.put(row.data as never);
        }
        if (row.entity === "transaction") touchedTxns.add(row.id);
        if (row.entity === "account") touchedAccounts.add(row.id);
      }
      if (touchedAccounts.size) {
        const ids = await db.transactions.where("accountId").anyOf([...touchedAccounts]).primaryKeys();
        ids.forEach((id) => touchedTxns.add(id));
      }
      await rebuildInstalments(db, touchedTxns);
      await setMeta("syncCursor", rows[rows.length - 1].server_seq, db);
      return { retry: false, invalid };
    });
    if (!outcome || account !== current) return;
    if (outcome.invalid) set({ dataNotice: "Some cloud records were skipped because their data is invalid." });
    if (!outcome.retry && rows.length < PULL_BATCH) return;
  }
}

async function fetchQuota(client: SupabaseClient): Promise<CloudQuota & { generation: number }> {
  const { data, error } = await client.from("user_quota").select("row_count,max_records,byte_count,max_bytes,sync_generation").single();
  checkError(error);
  return { records: data!.row_count, maxRecords: data!.max_records, bytes: Number(data!.byte_count), maxBytes: Number(data!.max_bytes), generation: Number(data!.sync_generation) };
}

// ---------- Account actions (used by the Sync page) ----------

function sb() {
  const c = supabase();
  if (!c) throw new Error("Cloud sync isn't configured in this build");
  return c;
}

const origin = () => window.location.origin;

export async function signUp(email: string, password: string): Promise<{ needsConfirm: boolean }> {
  const { data, error } = await sb().auth.signUp({ email, password, options: { emailRedirectTo: `${origin()}/login` } });
  if (error) throw error;
  // Supabase hides "already registered" (no identities, no error) to prevent email probing; treat it the same.
  return { needsConfirm: !data.session };
}

export async function resendConfirmation(email: string) {
  const { error } = await sb().auth.resend({ type: "signup", email, options: { emailRedirectTo: `${origin()}/login` } });
  if (error) throw error;
}

/** Auth events select the ledger only after the required factors are complete. */
export async function signIn(email: string, password: string): Promise<{ needsCode: boolean }> {
  const { data, error } = await sb().auth.signInWithPassword({ email, password });
  if (error) throw error;
  // Tell the login screen straight away whether a second factor is due, so it can go to the code step
  // without waiting for the ledger to open.
  const { data: aal } = await sb().auth.mfa.getAuthenticatorAssuranceLevel(data.session?.access_token);
  return { needsCode: !!aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2" };
}

export async function sendPasswordReset(email: string) {
  const { error } = await sb().auth.resetPasswordForEmail(email, { redirectTo: `${origin()}/reset-password` });
  if (error) throw error;
}

export async function setNewPassword(password: string) {
  const { error } = await sb().auth.updateUser({ password });
  if (error) throw error;
  recoveringUser = undefined;
  set({ recovering: false });
}

/** Turn Supabase / fetch errors into something a person can act on. */
export function friendlyAuthError(err: unknown) {
  const m = (err as Error)?.message ?? String(err);
  if (/failed to fetch|networkerror|load failed/i.test(m)) return "Can't reach the server. Check your connection and try again.";
  if (/invalid login credentials/i.test(m)) return "That email and password don't match.";
  if (/email not confirmed/i.test(m)) return "Confirm your email first — check your inbox for the link.";
  if (/invalid totp|invalid.*code|code.*(expired|invalid)/i.test(m)) return "That code didn't work. Try the newest one from your app.";
  if (/rate limit|too many/i.test(m)) return "Too many attempts. Wait a minute and try again.";
  if (/password.*(at least|short|weak)/i.test(m)) return "Choose a longer password (at least 8 characters).";
  if (/same.*password|different from the old/i.test(m)) return "Pick a password you haven't used here before.";
  return m;
}

/** Hide the account ledger immediately, preserving its offline records and pending changes. */
export async function signOut() {
  signingOut = true;
  ++authChange;
  stopSync();
  showDatabase(null);
  set({ phase: "starting", userId: undefined, email: undefined });
  try {
    await sb().auth.signOut({ scope: "local" });
  } finally {
    signingOut = false;
    const { data } = await sb().auth.getSession();
    queueAuth(data.session);
  }
}

export async function deleteCloudData() {
  const current = account;
  if (!current) throw new Error("Sign in before deleting cloud data.");
  const { db } = current;
  deletingUser = current.session.user.id;
  stopSync();
  showDatabase(null);
  const change = ++authChange;
  const client = syncClient(current.session.access_token);
  try {
    const { data, error } = await client.rpc("delete_my_cloud_data");
    checkError(error);
    await reconcileGeneration(db, Number(data));
  } finally {
    deletingUser = undefined;
    if (change === authChange) {
      const { data } = await sb().auth.getSession();
      if (change === authChange) queueAuth(data.session);
    }
  }
}

export async function recoveryBackup(db = getDatabase()) {
  return getMeta<Awaited<ReturnType<typeof exportBackup>>>("recoveryBackup", db);
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
