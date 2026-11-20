"use client";
// Quick add: entries sent from outside the app (iOS Shortcuts etc.) with a personal token. They wait on the
// server until the user approves or rejects them here; an approved entry is saved into the ledger like any
// other transaction (outbox → push), so the ledger is only ever written by the user's own devices.
//
// The sync loop pulls pending entries into the ledger's meta table (PENDING) so the approval sheet shows
// instantly and offline. Decisions are applied locally first and reported to the server in the background.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { KabanDB } from "./db";
import { visibleDatabase } from "./db";
import { getMeta, saveTransaction, setMeta } from "./repo";
import { SITE_URL } from "./site";
import { supabase } from "./supabase";

export interface QuickEntry {
  id: string;
  amountMinor: number;
  type: "expense" | "income";
  description?: string;
  category?: string;
  /** Account name the shortcut asked for; matched loosely against this ledger's accounts. */
  account?: string;
  date?: string;
  /** Name of the token that sent it. */
  source?: string;
  createdAt: string;
}

export interface QuickToken {
  id: string;
  name: string;
  hint: string;
  created_at: string;
  last_used_at: string | null;
}

export const PENDING = "quickAdd:pending";
/** Ids decided on this device whose decision hasn't reached the server yet: entry id → status. */
const DECIDED = "quickAdd:decided";

export const QUICK_ADD_URL = `${SITE_URL}/api/quick-add`;
/**
 * iCloud link to the ready-made "Add to Kaban" shortcut (shared from the Shortcuts app). It asks for the
 * person's token when they add it, so the shared shortcut itself holds no secret. See README → Quick add.
 */
export const QUICK_ADD_SHORTCUT_URL = process.env.NEXT_PUBLIC_QUICK_ADD_SHORTCUT_URL?.trim() || "";

type Decision = "approved" | "rejected";

function client() {
  const c = supabase();
  if (!c) throw new Error("Sign in to use quick add.");
  return c;
}

async function rpc<T>(fn: string, args?: Record<string, unknown>, c: SupabaseClient = client()): Promise<T> {
  const { data, error } = await c.rpc(fn, args);
  if (error) {
    if (/failed to fetch|networkerror|load failed/i.test(error.message)) throw new Error("You're offline. Connect to the internet and try again.");
    if (error.code === "PGRST202") throw new Error("Quick add isn't available on the server yet.");
    throw new Error(error.message);
  }
  return data as T;
}

// ---------- Tokens (online only) ----------

export const listTokens = () => rpc<QuickToken[]>("list_quick_add_tokens");
export const createToken = (name: string) => rpc<{ id: string; token: string }>("create_quick_add_token", { p_name: name });
export const revokeToken = (id: string) => rpc<void>("revoke_quick_add_token", { p_id: id });

// ---------- Pending entries ----------

interface Row {
  id: string;
  created_at: string;
  data: Omit<QuickEntry, "id" | "createdAt">;
}

/**
 * Called by the sync loop. Sends decisions made on this device, then refreshes the pending list.
 * Never throws: quick add trouble must not affect the ledger sync.
 */
export async function syncQuickAdd(db: KabanDB, c: SupabaseClient) {
  try {
    const decided = (await getMeta<Record<string, Decision>>(DECIDED, db)) ?? {};
    const rows = await rpc<Row[]>("pull_quick_add_entries", undefined, c);
    // Approved on another device before it could tell the server: the transaction is already here.
    for (const row of rows) if (!decided[row.id] && (await db.transactions.get(row.id))) decided[row.id] = "approved";
    for (const status of ["approved", "rejected"] as const) {
      const ids = Object.keys(decided).filter((id) => decided[id] === status);
      if (ids.length) await rpc<void>("decide_quick_add_entries", { p_ids: ids, p_status: status }, c);
    }
    const sent = new Set(Object.keys(decided));
    const pending: QuickEntry[] = rows.filter((r) => !sent.has(r.id)).map((r) => ({ ...r.data, id: r.id, createdAt: r.created_at }));
    await db.transaction("rw", db.meta, async () => {
      // Drop only the decisions just sent; one made while this ran waits for the next sync.
      const now = (await getMeta<Record<string, Decision>>(DECIDED, db)) ?? {};
      for (const id of sent) if (now[id] === decided[id]) delete now[id];
      await setMeta(DECIDED, now, db);
      await setMeta(PENDING, pending.filter((p) => !now[p.id]), db);
    });
  } catch (error) {
    // A server without the quick add tables yet just has nothing to show.
    if (!/isn't available on the server/.test((error as Error).message)) console.warn("quick add sync skipped", error);
  }
}

async function decide(db: KabanDB, entry: QuickEntry, status: Decision) {
  const id = entry.id;
  await db.transaction("rw", db.meta, async () => {
    const decided = (await getMeta<Record<string, Decision>>(DECIDED, db)) ?? {};
    await setMeta(DECIDED, { ...decided, [id]: status }, db);
    const pending = (await getMeta<QuickEntry[]>(PENDING, db)) ?? [];
    await setMeta(PENDING, pending.filter((p) => p.id !== id), db);
  });
  void import("./sync").then((m) => m.scheduleSync(300));
}

export interface ApprovedEntry {
  accountId: string;
  type: "expense" | "income";
  amountMinor: number;
  description: string;
  category?: string;
  date: string;
}

/**
 * Save the entry into the ledger. The transaction takes the entry's id, so approving the same entry on
 * two devices writes the same record instead of a duplicate.
 */
export async function approveEntry(entry: QuickEntry, input: ApprovedEntry, db = visibleDatabase()) {
  if (!db) throw new Error("Your ledger is still opening. Try again in a moment.");
  if (!(await db.transactions.get(entry.id))) {
    await saveTransaction({ ...input, ...(input.category ? { category: input.category } : {}), notes: entry.source ? `Quick add · ${entry.source}` : "Quick add" }, undefined, db, entry.id);
  }
  await decide(db, entry, "approved");
}

export async function rejectEntry(entry: QuickEntry, db = visibleDatabase()) {
  if (!db) throw new Error("Your ledger is still opening. Try again in a moment.");
  await decide(db, entry, "rejected");
}
