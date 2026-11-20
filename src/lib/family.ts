"use client";
// Profiles and families. Screens read a cached copy from the signed-in ledger's meta table, so they
// render instantly and offline; the sync loop refreshes it in the background (syncFamilyData). Social
// actions (create, join, approve, remove) need the server and refresh the cache when they finish.
//
// Shared accounts are read-only snapshots: the owner's device builds one per shared account and publishes
// it when it changes. Nothing here writes to the personal ledger tables or their outbox.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { KabanDB } from "./db";
import { visibleDatabase } from "./db";
import { cycleInfo } from "./billing";
import { todayISO } from "./dates";
import { accountBalances, effectOn } from "./finance";
import { useMeta } from "./hooks";
import { getMeta, setMeta } from "./repo";
import { supabase } from "./supabase";
import type { AccountType, TxnType } from "./types";

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
export type ShareSettings = Record<string, { familyId: string; visibility: ShareVisibility }[]>;

const PROFILE = "profile";
const FAMILIES = "families";
const SHARES = "familyShares";
const PUBLISHED = "familyPublished";
const UNAVAILABLE = "familyUnavailable";

// ---------- Hooks ----------

export const useProfile = () => useMeta<Profile>(PROFILE);
export const useFamilies = () => useMeta<FamilyState>(FAMILIES);
export const useShareSettings = () => useMeta<ShareSettings>(SHARES);

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
    families: (data.families ?? []).map((f) => ({ ...f, members: f.members ?? [], requests: f.requests ?? [], shared: f.shared ?? [] })),
    my_requests: data.my_requests ?? [],
    max_families: data.max_families ?? 1,
    fetchedAt: Date.now(),
  };
  await setMeta(FAMILIES, state, target);
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
export async function setAccountShares(accountId: string, shares: { familyId: string; visibility: ShareVisibility }[], db?: KabanDB) {
  const target = ledger(db);
  await target.transaction("rw", target.meta, async () => {
    const all = { ...((await getMeta<ShareSettings>(SHARES, target)) ?? {}) };
    if (shares.length) all[accountId] = shares;
    else delete all[accountId];
    await setMeta(SHARES, all, target);
  });
  const { scheduleSync } = await import("./sync");
  scheduleSync(300);
}

const SNAPSHOT_DAYS = 120;
const SNAPSHOT_TXNS = 150;

async function buildSnapshot(db: KabanDB, accountId: string, visibility: ShareVisibility): Promise<AccountSnapshot | null> {
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

async function publishShares(db: KabanDB, c: SupabaseClient, state: FamilyState) {
  const desired = (await getMeta<ShareSettings>(SHARES, db)) ?? {};
  const published = { ...((await getMeta<Record<string, string>>(PUBLISHED, db)) ?? {}) };
  const familyIds = new Set(state.families.map((f) => f.id));
  const wanted = new Set<string>();
  const dropped: { accountId: string; familyId: string }[] = [];

  for (const [accountId, shares] of Object.entries(desired)) {
    for (const { familyId, visibility } of shares) {
      if (!familyIds.has(familyId)) {
        dropped.push({ accountId, familyId });
        continue;
      }
      const key = `${familyId}:${accountId}`;
      const snapshot = await buildSnapshot(db, accountId, visibility);
      if (!snapshot) continue;
      wanted.add(key);
      const print = `${visibility}:${fingerprint(snapshot)}`;
      if (published[key] === print) continue;
      const status = await rpc<string>("publish_shared_account", { p_family: familyId, p_account: accountId, p_visibility: visibility, p_snapshot: { ...snapshot, builtAt: Date.now() } }, c);
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

/**
 * Called by the sync loop after the ledger has synced. Never throws: family trouble must not affect the
 * personal ledger. A server without the family tables yet (older backend) is remembered and retried hourly.
 */
export async function syncFamilyData(db: KabanDB, c: SupabaseClient) {
  try {
    const unavailableAt = await getMeta<number>(UNAVAILABLE, db);
    if (unavailableAt && Date.now() - unavailableAt < 60 * 60_000) return;
    await syncProfile(db, c);
    const state = await refreshFamilies(db, c);
    await publishShares(db, c, state);
    if (unavailableAt) await db.meta.delete(UNAVAILABLE);
  } catch (error) {
    if ((error as FamilyError).reason === "unavailable") await setMeta(UNAVAILABLE, Date.now(), db).catch(() => {});
    else console.warn("family sync skipped", error);
  }
}
