"use client";
// Profiles and families. Screens read a cached copy from the signed-in ledger's meta table, so they
// render instantly and offline; the sync loop refreshes it in the background (syncFamilyData). Social
// actions (create, join, approve, remove) need the server and refresh the cache when they finish.
//
// Shared accounts are read-only snapshots: the owner's device builds one per shared account and publishes
// it when it changes. Nothing here writes to the personal ledger tables or their outbox.
import { useMemo } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { KabanDB } from "./db";
import { allTables, uid, visibleDatabase } from "./db";
import { cycleInfo } from "./billing";
import { todayISO } from "./dates";
import { accountBalances, effectOn } from "./finance";
import { useMeta } from "./hooks";
import { familyPersonId, getMeta, setMeta } from "./repo";
import { supabase } from "./supabase";
import type { Account, AccountType, Txn, TxnType } from "./types";

// ---------- Types ----------

export type FamilyRole = "owner" | "admin" | "member";
export type ShareVisibility = "balance" | "activity";

export interface Profile {
  display_name: string | null;
  birthday: string | null;
  avatar: string | null;
  /** Saved on this device but not on the server yet. */
  pending?: boolean;
  /** Local edit time; a background save only clears `pending` if no newer edit happened. */
  editedAt?: number;
}

export interface FamilyMember {
  user_id: string;
  role: FamilyRole;
  joined_at: string;
  display_name: string | null;
  avatar: string | null;
}

export interface JoinRequest {
  id: string;
  user_id: string;
  created_at: string;
  display_name: string | null;
  avatar: string | null;
}

export interface SnapshotTxn {
  id: string;
  type: TxnType;
  /** Signed effect on this account (credit: + is more debt). */
  effect: number;
  amountMinor: number;
  date: string;
  description: string;
  category?: string;
  /** Family member who added it from their phone (absent: the owner did). */
  by?: string;
}

export interface AccountSnapshot {
  v: 1;
  account: {
    id: string;
    name: string;
    type: AccountType;
    color: string;
    bankId?: string;
    issuer?: string;
    last4?: string;
    creditLimitMinor?: number;
  };
  /** cash/debit: balance. credit: outstanding. */
  balanceMinor: number;
  availableMinor?: number;
  dueDate?: string;
  monthSpendMinor: number;
  txns?: SnapshotTxn[];
  builtAt: number;
}

export interface SharedAccount {
  owner_id: string;
  account_id: string;
  visibility: ShareVisibility;
  /** Members may add transactions to it (missing on servers before contributions: treat as false). */
  allow_add?: boolean;
  snapshot: AccountSnapshot;
  updated_at: string;
}

export interface Family {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  created_at: string;
  role: FamilyRole;
  members: FamilyMember[];
  invite: { code: string; expires_at: string } | null;
  requests: JoinRequest[];
  shared: SharedAccount[];
  /** Ids of this user's added transactions the owner hasn't brought in yet. */
  my_pending: string[];
  /** Edits of this user's the owner's device turned down because the owner had changed it. */
  my_conflicts?: string[];
}

export interface MyRequest {
  id: string;
  family_id: string;
  family_name: string;
  family_icon: string;
  family_color: string;
  status: "pending" | "approved" | "declined" | "cancelled";
  created_at: string;
}

export interface FamilyState {
  families: Family[];
  my_requests: MyRequest[];
  max_families: number;
  fetchedAt: number;
}

/** accountId → the families it is shared with. */
export interface ShareSetting {
  familyId: string;
  visibility: ShareVisibility;
  /** Members can add transactions (default on). */
  allowAdd?: boolean;
}
export type ShareSettings = Record<string, ShareSetting[]>;

const PROFILE = "profile";
const FAMILIES = "families";
const SHARES = "familyShares";
const PUBLISHED = "familyPublished";
const UNAVAILABLE = "familyUnavailable";
const QUEUE = "familyQueue";
const AUTHORS = "familyAuthors";

// ---------- Hooks ----------

export const useProfile = () => useMeta<Profile>(PROFILE);
export const useFamilies = () => useMeta<FamilyState>(FAMILIES);
export const useShareSettings = () => useMeta<ShareSettings>(SHARES);
export const useFamilyQueue = () => useMeta<QueuedTxn[]>(QUEUE);

/** Resolve profile photos by family user ID and the ledger's existing contact links. */
export function useFamilyPersonAvatars(state: FamilyState | null | undefined, links: Record<string, string>) {
  return useMemo(() => {
    const photos = new Map<string, string>();
    for (const family of state?.families ?? []) {
      for (const member of family.members) {
        if (member.avatar) photos.set(links[member.user_id] ?? familyPersonId(member.user_id), member.avatar);
      }
    }
    return photos;
  }, [state, links]);
}

export const isAdmin = (f: Pick<Family, "role">) => f.role === "owner" || f.role === "admin";
/** A family becomes active once someone else has joined. */
export const isForming = (f: Pick<Family, "members">) => f.members.length < 2;

export function memberName(m: Pick<FamilyMember, "display_name"> | undefined, fallback = "Member") {
  return m?.display_name?.trim() || fallback;
}

/** Things that need this user's action: join requests in families they admin. */
export function inboxCount(state: FamilyState | null | undefined) {
  return state?.families.reduce((n, f) => n + (isAdmin(f) ? f.requests.length : 0), 0) ?? 0;
}

export function inviteLink(code: string) {
  return `${window.location.origin}/family/join?code=${encodeURIComponent(code)}`;
}

/** Accepts a bare code or a pasted invite link. */
export function parseInviteCode(input: string) {
  const text = input.trim();
  const fromLink = /[?&]code=([A-Za-z0-9]+)/.exec(text)?.[1];
  return (fromLink ?? text).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// ---------- Errors ----------

export class FamilyError extends Error {
  constructor(message: string, readonly reason?: string) {
    super(message);
  }
}

function fail(error: { message: string; hint?: string; code?: string } | null): asserts error is null {
  if (!error) return;
  if (/failed to fetch|networkerror|load failed/i.test(error.message)) throw new FamilyError("You're offline. Connect to the internet and try again.", "offline");
  if (error.code === "PGRST202") throw new FamilyError("Families aren't available on the server yet.", "unavailable");
  const reason = error.hint;
  const friendly: Record<string, string> = {
    limit: "You've reached the number of families your plan allows.",
    invalid: "This invite has expired or isn't valid. Ask for a new code.",
    member: "You're already in this family.",
    rate: "Too many join requests today. Try again tomorrow.",
    owner: "Hand over ownership to another member before leaving.",
  };
  throw new FamilyError((reason && friendly[reason]) || error.message.replace(/^./, (c) => c.toUpperCase()), reason);
}

function client() {
  const c = supabase();
  if (!c) throw new FamilyError("Sign in to use families.", "signed-out");
  return c;
}

async function rpc<T>(fn: string, args?: Record<string, unknown>, c: SupabaseClient = client()): Promise<T> {
  const { data, error } = await c.rpc(fn, args);
  fail(error);
  return data as T;
}

function ledger(db?: KabanDB | null) {
  const target = db ?? visibleDatabase();
  if (!target) throw new FamilyError("Your ledger is still opening. Try again in a moment.");
  return target;
}

// ---------- Profile ----------

/** Saves locally right away; the sync loop sends it to the server. */
export async function saveProfile(input: Omit<Profile, "pending" | "editedAt">, db?: KabanDB) {
  await setMeta(PROFILE, { ...input, pending: true, editedAt: Date.now() } satisfies Profile, ledger(db));
  const { scheduleSync } = await import("./sync");
  scheduleSync(300);
}

async function syncProfile(db: KabanDB, c: SupabaseClient) {
  const local = await getMeta<Profile>(PROFILE, db);
  if (local?.pending) {
    const saved = await rpc<Profile>("save_my_profile", { p_display_name: local.display_name ?? "", p_birthday: local.birthday, p_avatar: local.avatar ?? "" }, c);
    await db.transaction("rw", db.meta, async () => {
      const now = await getMeta<Profile>(PROFILE, db);
      if (now?.editedAt === local.editedAt) await setMeta(PROFILE, { display_name: saved.display_name, birthday: saved.birthday, avatar: saved.avatar }, db);
    });
    return;
  }
  const remote = await rpc<Profile>("get_my_profile", undefined, c);
  await db.transaction("rw", db.meta, async () => {
    const now = await getMeta<Profile>(PROFILE, db);
    if (!now?.pending) await setMeta(PROFILE, { display_name: remote.display_name, birthday: remote.birthday, avatar: remote.avatar }, db);
  });
}

/** Square-crop and shrink a picked photo so it stays small enough to cache and sync. */
export async function avatarFromFile(file: File, size = 192): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  for (const quality of [0.82, 0.7, 0.55, 0.4]) {
    let url = canvas.toDataURL("image/webp", quality);
    if (!url.startsWith("data:image/webp")) url = canvas.toDataURL("image/jpeg", quality);
    if (url.length < 60_000) return url;
  }
  throw new FamilyError("That photo is too large. Try another one.");
}

// ---------- Families: reads ----------

export async function refreshFamilies(db?: KabanDB, c: SupabaseClient = client()) {
  const target = ledger(db);
  const data = await rpc<Omit<FamilyState, "fetchedAt">>("get_my_families", undefined, c);
  const state: FamilyState = {
    families: (data.families ?? []).map((f) => ({ ...f, members: f.members ?? [], requests: f.requests ?? [], shared: f.shared ?? [], my_pending: f.my_pending ?? [], my_conflicts: f.my_conflicts ?? [] })),
    my_requests: data.my_requests ?? [],
    max_families: data.max_families ?? 1,
    fetchedAt: Date.now(),
  };
  const prev = await getMeta<FamilyState>(FAMILIES, target);
  await setMeta(FAMILIES, state, target);
  // Joins, accepted requests and new join requests show up in Notifications. Never blocks the refresh.
  await import("./inbox").then((m) => m.noteFamilyChanges(target, prev, state)).catch((e) => console.warn("inbox: family changes skipped", e));
  return state;
}

/** Fire-and-forget refresh for screens: never throws. */
export function refreshFamiliesQuietly() {
  void refreshFamilies().catch(() => {});
}

export interface InvitePreview {
  status: "ok" | "member" | "pending" | "invalid";
  family_id?: string;
  name?: string;
  icon?: string;
  color?: string;
  description?: string | null;
  member_count?: number;
}

export const previewInvite = (code: string) => rpc<InvitePreview>("preview_invite", { p_code: code });

// ---------- Families: actions ----------

async function act<T>(fn: string, args: Record<string, unknown>) {
  const result = await rpc<T>(fn, args);
  await refreshFamilies().catch(() => {});
  return result;
}

export const createFamily = (input: { name: string; description: string; icon: string; color: string }) =>
  act<string>("create_family", { p_name: input.name, p_description: input.description, p_icon: input.icon, p_color: input.color });
export const updateFamily = (id: string, input: { name: string; description: string; icon: string; color: string }) =>
  act<void>("update_family", { p_family: id, p_name: input.name, p_description: input.description, p_icon: input.icon, p_color: input.color });
export const deleteFamily = (id: string) => act<void>("delete_family", { p_family: id });
export const leaveFamily = (id: string) => act<void>("leave_family", { p_family: id });
export const rotateInvite = (id: string) => act<string>("rotate_family_invite", { p_family: id });
export const requestJoin = (code: string) => act<string>("request_join", { p_code: code });
export const cancelJoinRequest = (id: string) => act<void>("cancel_join_request", { p_request: id });
export const respondJoinRequest = (id: string, approve: boolean) => act<void>("respond_join_request", { p_request: id, p_approve: approve });
export const setMemberRole = (familyId: string, userId: string, role: "admin" | "member") =>
  act<void>("set_member_role", { p_family: familyId, p_user: userId, p_role: role });
export const transferOwnership = (familyId: string, userId: string) => act<void>("transfer_family_ownership", { p_family: familyId, p_user: userId });
export const removeMember = (familyId: string, userId: string) => act<void>("remove_family_member", { p_family: familyId, p_user: userId });

// ---------- Sharing ----------

/** Local choice; the background publisher sends or withdraws the snapshot. */
export async function setAccountShares(accountId: string, shares: ShareSetting[], db?: KabanDB) {
  const target = ledger(db);
  await target.transaction("rw", target.meta, async () => {
    const all = { ...((await getMeta<ShareSettings>(SHARES, target)) ?? {}) };
    // Keep an explicit empty choice so withdrawals survive a missing publication cache.
    all[accountId] = shares;
    await setMeta(SHARES, all, target);
  });
  const { scheduleSync } = await import("./sync");
  scheduleSync(300);
}

const SNAPSHOT_DAYS = 120;
const SNAPSHOT_TXNS = 150;

async function buildSnapshot(db: KabanDB, accountId: string, visibility: ShareVisibility, authors: Record<string, string>): Promise<AccountSnapshot | null> {
  const account = await db.accounts.get(accountId);
  if (!account) return null;
  const txns = await db.transactions.where("accountId").equals(accountId).or("toAccountId").equals(accountId).toArray();
  const balance = accountBalances([account], txns).get(accountId)!;
  const today = todayISO();
  const month = today.slice(0, 7);
  const since = new Date(Date.now() - SNAPSHOT_DAYS * 86_400_000).toISOString().slice(0, 10);
  const spend = (t: (typeof txns)[number]) => t.state === "active" && t.type === "expense" && t.accountId === accountId;
  const snapshot: AccountSnapshot = {
    v: 1,
    account: {
      id: account.id,
      name: account.name,
      type: account.type,
      color: account.color,
      ...(account.bankId && { bankId: account.bankId }),
      ...(account.issuer && { issuer: account.issuer }),
      ...(account.last4 && { last4: account.last4 }),
      ...(account.creditLimitMinor !== undefined && { creditLimitMinor: account.creditLimitMinor }),
    },
    balanceMinor: balance.balance,
    ...(balance.available !== undefined && { availableMinor: balance.available }),
    ...(account.type === "credit" && account.closingDay && { dueDate: cycleInfo(account, today).upcomingDue }),
    monthSpendMinor: txns.filter((t) => spend(t) && t.date.startsWith(month)).reduce((s, t) => s + t.amountMinor, 0),
    builtAt: 0,
  };
  if (visibility === "activity") {
    // Notes and people stay private: only what the family needs to read the account.
    snapshot.txns = txns
      .filter((t) => t.state === "active" && t.date >= since)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
      .slice(0, SNAPSHOT_TXNS)
      .map((t) => ({
        id: t.id,
        type: t.type,
        effect: effectOn(t, account),
        amountMinor: t.amountMinor,
        date: t.date,
        description: t.description,
        ...(t.category && { category: t.category }),
        ...(authors[t.id] && { by: authors[t.id] }),
      }));
  }
  return snapshot;
}

function fingerprint(value: unknown) {
  const text = JSON.stringify(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return `${text.length}:${(h >>> 0).toString(36)}`;
}

async function publishShares(db: KabanDB, c: SupabaseClient, state: FamilyState, myId: string) {
  const desired = (await getMeta<ShareSettings>(SHARES, db)) ?? {};
  const published = { ...((await getMeta<Record<string, string>>(PUBLISHED, db)) ?? {}) };
  const familyIds = new Set(state.families.map((f) => f.id));
  // Recover publications this device may not have recorded (e.g. after restoring a ledger).
  // Only reconcile accounts with a local sharing choice or an existing publication record.
  for (const family of state.families) {
    for (const share of family.shared) {
      if (share.owner_id !== myId) continue;
      const key = `${family.id}:${share.account_id}`;
      if (Object.hasOwn(desired, share.account_id) && !Object.hasOwn(published, key)) published[key] = "";
    }
  }
  // Withdraw first so an unrelated publishing failure cannot hold up an unshare.
  for (const key of Object.keys(published)) {
    const [familyId, accountId] = [key.slice(0, 36), key.slice(37)];
    if (desired[accountId]?.some((share) => share.familyId === familyId)) continue;
    if (familyIds.has(familyId)) await rpc<void>("unpublish_shared_account", { p_family: familyId, p_account: accountId }, c);
    delete published[key];
  }
  const wanted = new Set<string>();
  const dropped: { accountId: string; familyId: string }[] = [];
  const authors = (await getMeta<Record<string, string>>(AUTHORS, db)) ?? {};

  for (const [accountId, shares] of Object.entries(desired)) {
    for (const { familyId, visibility, allowAdd = true } of shares) {
      if (!familyIds.has(familyId)) {
        dropped.push({ accountId, familyId });
        continue;
      }
      const key = `${familyId}:${accountId}`;
      const snapshot = await buildSnapshot(db, accountId, visibility, authors);
      if (!snapshot) continue;
      wanted.add(key);
      const print = `${visibility}:${allowAdd ? "add" : "read"}:${fingerprint(snapshot)}`;
      if (published[key] === print) continue;
      const status = await rpc<string>("publish_shared_account", { p_family: familyId, p_account: accountId, p_visibility: visibility, p_snapshot: { ...snapshot, builtAt: Date.now() }, p_allow_add: allowAdd }, c);
      if (status === "ok") published[key] = print;
      else if (status === "gone") dropped.push({ accountId, familyId });
    }
  }
  for (const key of Object.keys(published)) {
    if (wanted.has(key)) continue;
    const [familyId, accountId] = [key.slice(0, 36), key.slice(37)];
    if (familyIds.has(familyId)) await rpc<void>("unpublish_shared_account", { p_family: familyId, p_account: accountId }, c);
    delete published[key];
  }
  await db.transaction("rw", db.meta, async () => {
    await setMeta(PUBLISHED, published, db);
    if (!dropped.length) return;
    // Families this user left or was removed from: forget those shares (the server already dropped them).
    const now = { ...((await getMeta<ShareSettings>(SHARES, db)) ?? {}) };
    for (const { accountId, familyId } of dropped) {
      const left = (now[accountId] ?? []).filter((s) => s.familyId !== familyId);
      if (left.length) now[accountId] = left;
      else delete now[accountId];
    }
    await setMeta(SHARES, now, db);
  });
}

// ---------- Adding to someone else's shared account ----------

/** A transaction a member added to another person's shared account, waiting on this device. */
export interface QueuedTxn {
  id: string;
  familyId: string;
  ownerId: string;
  accountId: string;
  accountName: string;
  txn: Txn;
  /**
   * queued: not sent yet. sent: on the server, waiting for the owner's device. imported: in the owner's
   * ledger (kept so it can still be edited). conflict: the owner changed it, so this edit wasn't applied.
   * failed: refused by the server.
   */
  status: "queued" | "sent" | "imported" | "conflict" | "failed";
  /** new: first send. edit: a change to something already sent. */
  op?: "new" | "edit";
  /** For edits: updatedAt of the version the owner has. */
  baseUpdatedMs?: number;
  /** Card payments: this user's own linked expense (same id) and whether the owner pays it back. */
  payMode?: "gift" | "loan";
  error?: string;
  queuedAt: number;
}

export interface SharedTarget {
  /** Stable synthetic account id for pickers; never stored in a ledger. */
  key: string;
  familyId: string;
  familyName: string;
  ownerId: string;
  ownerName: string;
  /** A read-only stand-in built from the snapshot, shaped like a ledger account. */
  account: Account;
  balance: number;
  available?: number;
}

export const SHARED_PREFIX = "shared~";
export const isSharedKey = (id: string) => id.startsWith(SHARED_PREFIX);

/** Accounts other members shared with this user and allow adding to. */
export function sharedTargets(state: FamilyState | null | undefined, myId: string | undefined): SharedTarget[] {
  if (!state || !myId) return [];
  const out: SharedTarget[] = [];
  for (const f of state.families) {
    const names = new Map(f.members.map((m) => [m.user_id, memberName(m)]));
    for (const s of f.shared) {
      if (s.owner_id === myId || !s.allow_add || !names.has(s.owner_id)) continue;
      const a = s.snapshot.account;
      const key = `${SHARED_PREFIX}${f.id}~${s.owner_id}~${s.account_id}`;
      out.push({
        key,
        familyId: f.id,
        familyName: f.name,
        ownerId: s.owner_id,
        ownerName: names.get(s.owner_id)!,
        balance: s.snapshot.balanceMinor,
        available: s.snapshot.availableMinor,
        account: {
          id: key,
          type: a.type,
          name: a.name,
          color: a.color,
          bankId: a.bankId,
          issuer: a.issuer,
          last4: a.last4,
          creditLimitMinor: a.creditLimitMinor,
          openingMinor: 0,
          openingDate: "1970-01-01",
          archived: false,
          sortOrder: 0,
          createdAt: 0,
          updatedAt: 0,
          version: 0,
        },
      });
    }
  }
  return out;
}

export const FAMILY_TXN_TYPES: TxnType[] = ["expense", "income", "refund"];

export type FamilyTxnInput = Pick<Txn, "type" | "amountMinor" | "date" | "description"> & Partial<Pick<Txn, "category" | "notes" | "arrangement" | "instalmentCount">>;

/**
 * Save a transaction on someone else's shared account. It lands in this device's queue at once and is
 * sent in the background; the owner's device adds it to their ledger the next time it syncs.
 */
export async function addFamilyTransaction(target: SharedTarget, input: FamilyTxnInput, db?: KabanDB) {
  const ledgerDb = ledger(db);
  const credit = target.account.type === "credit";
  if (!FAMILY_TXN_TYPES.includes(input.type)) throw new FamilyError("Only expenses, income and refunds can be added to a shared account.");
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new FamilyError("Enter an amount greater than zero");
  if (input.type === "income" && credit) throw new FamilyError("Income must go to a cash or debit account");
  const instalment = credit && input.type === "expense" && input.arrangement === "instalment";
  if (instalment && !(input.instalmentCount && input.instalmentCount >= 2 && input.instalmentCount <= 60)) throw new FamilyError("Instalments need 2–60 months");
  const now = Date.now();
  const txn: Txn = {
    id: uid(),
    type: input.type,
    accountId: target.key.split("~")[3],
    amountMinor: input.amountMinor,
    currency: "PHP",
    date: input.date,
    description: input.description,
    ...(input.category && { category: input.category }),
    ...(input.notes && { notes: input.notes }),
    ...(credit && input.type === "expense" && input.arrangement && { arrangement: input.arrangement }),
    ...(instalment && { instalmentCount: input.instalmentCount }),
    state: "active",
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
  const entry: QueuedTxn = {
    id: txn.id,
    familyId: target.familyId,
    ownerId: target.ownerId,
    accountId: txn.accountId,
    accountName: `${target.ownerName}'s ${target.account.name}`,
    txn,
    status: "queued",
    op: "new",
    queuedAt: now,
  };
  await ledgerDb.transaction("rw", ledgerDb.meta, async () => {
    const queue = (await getMeta<QueuedTxn[]>(QUEUE, ledgerDb)) ?? [];
    await setMeta(QUEUE, [...queue, entry], ledgerDb);
  });
  const { scheduleSync } = await import("./sync");
  scheduleSync(300);
  return txn.id;
}

/** Take back something added to a shared account before the owner's device brings it in. */
export async function removeQueuedTransaction(id: string, db?: KabanDB) {
  const target = ledger(db);
  const entry = ((await getMeta<QueuedTxn[]>(QUEUE, target)) ?? []).find((q) => q.id === id);
  if (!entry) return;
  // Already on the server or in the owner's ledger: send a void so it disappears there too.
  if ((entry.status === "sent" && entry.op === "edit") || entry.status === "imported") return editFamilyEntry(id, { state: "void" }, target);
  if (entry.status === "sent") await rpc<void>("cancel_family_transaction", { p_id: id });
  await target.transaction("rw", allTables(target), async () => {
    const queue = (await getMeta<QueuedTxn[]>(QUEUE, target)) ?? [];
    await setMeta(QUEUE, queue.filter((q) => q.id !== id), target);
    // The owner kept their own version after a conflict, so this side stays too.
    if (entry.txn.type === "member_payment" && entry.status !== "conflict") await voidLinked(target, id);
  });
}

async function voidLinked(db: KabanDB, id: string) {
  const local = await db.transactions.get(id);
  if (local && local.state === "active") {
    const { setTransactionVoid } = await import("./repo");
    await setTransactionVoid(id, true, db);
  }
}

export type FamilyEdit = Partial<Pick<Txn, "amountMinor" | "date" | "description" | "category" | "notes" | "state">>;

/** Whether an entry this user added can still be changed from their phone. */
export const canEditEntry = (q: QueuedTxn) => q.txn.state === "active" && (q.status === "queued" || q.status === "sent" || q.status === "imported");

/**
 * Change (or void) something this user added to a shared account. Saved here at once; the owner's phone
 * applies it on its next sync unless the owner already changed that transaction.
 */
export async function editFamilyEntry(id: string, change: FamilyEdit, db?: KabanDB) {
  const target = ledger(db);
  if (change.amountMinor !== undefined && (!Number.isSafeInteger(change.amountMinor) || change.amountMinor <= 0)) throw new FamilyError("Enter an amount greater than zero");
  const { saveTransaction, familyPersonFor } = await import("./repo");
  await target.transaction("rw", allTables(target), async () => {
    const queue = (await getMeta<QueuedTxn[]>(QUEUE, target)) ?? [];
    const entry = queue.find((q) => q.id === id);
    if (!entry || !canEditEntry(entry)) throw new FamilyError("This can't be changed any more.");
    const now = Date.now();
    const next: Txn = { ...entry.txn, ...change, updatedAt: now };
    if (!next.notes) delete next.notes;
    if (!next.category) delete next.category;
    let updated: QueuedTxn;
    if (entry.status === "queued" && entry.op !== "edit") {
      // Never left this phone: just replace it.
      updated = { ...entry, txn: next };
    } else {
      updated = {
        ...entry,
        txn: { ...next, version: entry.txn.version + 1 },
        status: "queued",
        op: "edit",
        // Keep the owner's version as the base across several quick edits.
        baseUpdatedMs: entry.status === "imported" ? entry.txn.updatedAt : entry.op === "edit" ? entry.baseUpdatedMs : entry.txn.updatedAt,
        error: undefined,
      };
    }
    await setMeta(QUEUE, queue.map((q) => (q.id === id ? updated : q)), target);

    // A card payment's own half lives in this ledger: keep it in step.
    if (entry.txn.type === "member_payment") {
      if (next.state === "void") await voidLinked(target, id);
      else if (await target.transactions.get(id)) {
        const local = (await target.transactions.get(id))!;
        const owner = entry.payMode === "loan" ? await familyPersonFor(target, { userId: entry.ownerId, name: ownerLabel(entry) }) : undefined;
        await saveTransaction(
          {
            type: "expense",
            accountId: local.accountId,
            amountMinor: next.amountMinor,
            date: next.date,
            description: local.description,
            category: local.category,
            notes: next.notes,
            splits: owner ? [{ personId: owner, amountMinor: next.amountMinor }] : [],
          },
          id,
          target,
        );
      }
    }
  });
  const { scheduleSync } = await import("./sync");
  scheduleSync(300);
}

const ownerLabel = (q: QueuedTxn) => q.accountName.split("'s ")[0] || "Family member";

/**
 * Pay someone else's shared credit card from one of this user's own accounts. Two linked records: an
 * expense here (optionally split fully to the owner, so it shows in Who Owes Me) and a "paid by family"
 * entry for the owner's card that their phone brings in.
 */
export async function payFamilyCard(
  target: SharedTarget,
  input: { fromAccountId: string; amountMinor: number; date: string; notes?: string; mode: "gift" | "loan" },
  db?: KabanDB,
) {
  const d = ledger(db);
  if (target.account.type !== "credit") throw new FamilyError("Pick a credit card to pay.");
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new FamilyError("Enter an amount greater than zero");
  const { saveTransaction, familyPersonFor } = await import("./repo");
  const id = uid();
  const now = Date.now();
  const cardLabel = `${target.ownerName}'s ${target.account.name}`;
  const txn: Txn = {
    id,
    type: "member_payment",
    accountId: target.key.split("~")[3],
    amountMinor: input.amountMinor,
    currency: "PHP",
    date: input.date,
    description: "Card payment",
    ...(input.notes && { notes: input.notes }),
    state: "active",
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
  await d.transaction("rw", allTables(d), async () => {
    const owner = input.mode === "loan" ? await familyPersonFor(d, { userId: target.ownerId, name: target.ownerName }) : undefined;
    await saveTransaction(
      {
        type: "expense",
        accountId: input.fromAccountId,
        amountMinor: input.amountMinor,
        date: input.date,
        description: `Paid ${cardLabel}`,
        category: "Family",
        notes: input.notes,
        splits: owner ? [{ personId: owner, amountMinor: input.amountMinor }] : undefined,
      },
      undefined,
      d,
      id,
    );
    const entry: QueuedTxn = {
      id,
      familyId: target.familyId,
      ownerId: target.ownerId,
      accountId: txn.accountId,
      accountName: cardLabel,
      txn,
      status: "queued",
      op: "new",
      payMode: input.mode,
      queuedAt: now,
    };
    await setMeta(QUEUE, [...((await getMeta<QueuedTxn[]>(QUEUE, d)) ?? []), entry], d);
  });
  const { scheduleSync } = await import("./sync");
  scheduleSync(300);
  return id;
}

async function updateQueue(db: KabanDB, fn: (q: QueuedTxn[]) => QueuedTxn[]) {
  await db.transaction("rw", db.meta, async () => setMeta(QUEUE, fn((await getMeta<QueuedTxn[]>(QUEUE, db)) ?? []), db));
}

const REFUSED: Record<string, string> = {
  not_shared: "This account isn't shared for adding any more.",
  invalid: "The server couldn't accept this transaction.",
  limit: "Too many transactions are waiting. Try again once the owner syncs.",
};

async function pushQueue(db: KabanDB, c: SupabaseClient) {
  const queued = ((await getMeta<QueuedTxn[]>(QUEUE, db)) ?? []).filter((q) => q.status === "queued");
  for (const q of queued) {
    const status =
      q.op === "edit"
        ? await rpc<string>("update_family_transaction", { p_txn: q.txn, p_base_updated_ms: q.baseUpdatedMs ?? null }, c)
        : await rpc<string>("add_family_transaction", { p_family: q.familyId, p_owner: q.ownerId, p_account: q.accountId, p_txn: q.txn }, c);
    await updateQueue(db, (all) =>
      all.map((e) => {
        // Edited again while this send was in flight: leave the newer version queued.
        if (e.id !== q.id || e.txn.updatedAt !== q.txn.updatedAt) return e;
        if (status === "ok") return { ...e, status: "sent", error: undefined };
        if (status === "conflict") return { ...e, status: "conflict", error: undefined };
        return { ...e, status: "failed", error: REFUSED[status] ?? status };
      }),
    );
  }
}

/** Sent entries the server no longer lists as pending were brought in by the owner (or cancelled). */
const KEEP_HISTORY_MS = 90 * 86_400_000;

async function reconcileQueue(db: KabanDB, state: FamilyState) {
  const pending = new Map(state.families.map((f) => [f.id, new Set(f.my_pending)]));
  const conflicts = new Map(state.families.map((f) => [f.id, new Set(f.my_conflicts ?? [])]));
  const cutoff = Date.now() - KEEP_HISTORY_MS;
  await updateQueue(db, (all) =>
    all
      .map((q): QueuedTxn => {
        if (q.status !== "sent" || !pending.has(q.familyId) || pending.get(q.familyId)!.has(q.id)) return q;
        return { ...q, status: conflicts.get(q.familyId)?.has(q.id) ? "conflict" : "imported" };
      })
      // Settled history ages out; anything still on its way is kept.
      .filter((q) => !["imported", "conflict"].includes(q.status) || q.queuedAt > cutoff)
      .slice(-300),
  );
}

interface Contribution {
  id: string;
  family_id: string | null;
  account_id: string;
  author_id: string;
  author_name: string | null;
  kind?: "new" | "edit";
  base_updated_ms?: number | null;
  data: Txn;
}

/** Owner side: bring members' transactions into this ledger, then tell the server they're in. */
async function importContributions(db: KabanDB, c: SupabaseClient) {
  const rows = await rpc<Contribution[]>("pull_family_contributions", undefined, c);
  if (!rows?.length) return;
  const { applyFamilyEdit, importFamilyTransaction } = await import("./repo");
  const done: string[] = [];
  const rejected: string[] = [];
  const authors: Record<string, string> = {};
  const added: { id: string; author: string; description: string; amountMinor: number; accountId: string }[] = [];
  for (const row of rows) {
    if (row.data?.id !== row.id || row.data.accountId !== row.account_id) {
      done.push(row.id); // Malformed: keep it on the server, stop retrying.
      continue;
    }
    const author = { userId: row.author_id, name: row.author_name?.trim() || "Family member" };
    const result = row.kind === "edit" ? await applyFamilyEdit(db, row.data, row.base_updated_ms ?? null, author) : await importFamilyTransaction(db, row.data, author);
    if (result === "missing") continue; // Account not on this device yet; try again next sync.
    if (result === "conflict") {
      rejected.push(row.id);
      continue;
    }
    if (result !== "invalid") authors[row.id] = row.author_id;
    if (result === "ok" && row.kind !== "edit")
      added.push({ id: row.id, author: author.name, description: row.data.description, amountMinor: row.data.amountMinor, accountId: row.account_id });
    done.push(row.id);
  }
  if (Object.keys(authors).length) {
    await db.transaction("rw", db.meta, async () => {
      const all = (await getMeta<Record<string, string>>(AUTHORS, db)) ?? {};
      await setMeta(AUTHORS, { ...all, ...authors }, db);
    });
  }
  if (added.length) await import("./inbox").then((m) => m.noteFamilyEntries(db, added)).catch((e) => console.warn("inbox: family entries skipped", e));
  if (done.length) await rpc<void>("ack_family_contributions", { p_ids: done }, c);
  if (rejected.length) await rpc<void>("reject_family_contributions", { p_ids: rejected }, c);
}

/**
 * Called by the sync loop after the ledger has synced. Never throws: family trouble must not affect the
 * personal ledger. Each step runs on its own so one failing (or missing on an older server) doesn't stop
 * the rest. A server without the family tables at all is remembered and retried hourly.
 */
export async function syncFamilyData(db: KabanDB, c: SupabaseClient, myId: string) {
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (error) {
      console.warn(`family sync: ${name} skipped`, error);
    }
  };
  let state: FamilyState | undefined;
  try {
    const unavailableAt = await getMeta<number>(UNAVAILABLE, db);
    if (unavailableAt && Date.now() - unavailableAt < 60 * 60_000) return;
    await step("profile", () => syncProfile(db, c));
    await step("queue", () => pushQueue(db, c));
    await step("import", () => importContributions(db, c));
    state = await refreshFamilies(db, c);
    if (unavailableAt) await db.meta.delete(UNAVAILABLE);
  } catch (error) {
    if ((error as FamilyError).reason === "unavailable") await setMeta(UNAVAILABLE, Date.now(), db).catch(() => {});
    else console.warn("family sync skipped", error);
    return;
  }
  await step("reconcile", () => reconcileQueue(db, state!));
  await step("people", async () => {
    const { ensureFamilyPeople } = await import("./repo");
    const seen = new Map<string, string>();
    for (const f of state!.families) for (const m of f.members) if (m.user_id !== myId && m.display_name?.trim()) seen.set(m.user_id, m.display_name.trim());
    await ensureFamilyPeople(db, [...seen].map(([userId, name]) => ({ userId, name })));
  });
  await step("publish", () => publishShares(db, c, state!, myId));
  // Read back the result in this run so family screens reflect sharing edits immediately.
  // Also runs after a partial publish failure, since earlier withdrawals may have succeeded.
  await step("refresh shares", () => refreshFamilies(db, c));
}
