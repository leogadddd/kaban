"use client";
// The Notifications tab. Local only: items live in the signed-in ledger's meta table, so the tab opens
// instantly and offline. Producers add items as they learn things: the sync loop (family changes, members'
// entries), the due-date check when the app opens, and so on. Pending quick adds aren't stored here; they
// come straight from the quick add cache because they need a decision, not just a read.
//
// To add a new kind: give it an InboxKind, an icon in the Notifications page, and call addInboxItems with a
// stable id (the same event must always produce the same id, so re-checks never duplicate it).
import type { KabanDB } from "./db";
import { cycleInfo } from "./billing";
import { fromISO, todayISO } from "./dates";
import type { Family, FamilyState } from "./family";
import { useMeta } from "./hooks";
import { getMeta, setMeta } from "./repo";
import type { Account } from "./types";

export type InboxKind = "family-joined" | "family-declined" | "member-joined" | "join-request" | "family-entry" | "card-due";

export interface InboxItem {
  /** Stable per event, e.g. "card-due:<account>:<date>". */
  id: string;
  kind: InboxKind;
  title: string;
  body?: string;
  /** Shown with the hide-amounts setting respected. */
  amountMinor?: number;
  href?: string;
  at: number;
  read?: boolean;
}

export const INBOX = "inbox:items";
const MAX_ITEMS = 100;
/** Seen ids are remembered a while after they age out, so a re-check can't bring one back. */
const SEEN = "inbox:seen";

export const useInbox = () => useMeta<InboxItem[]>(INBOX);

export async function addInboxItems(db: KabanDB, items: Omit<InboxItem, "read">[]) {
  if (!items.length) return;
  await db.transaction("rw", db.meta, async () => {
    const all = (await getMeta<InboxItem[]>(INBOX, db)) ?? [];
    const seen = new Set((await getMeta<string[]>(SEEN, db)) ?? []);
    const fresh = items.filter((i) => !seen.has(i.id) && !all.some((a) => a.id === i.id));
    if (!fresh.length) return;
    const next = [...fresh, ...all].sort((a, b) => b.at - a.at).slice(0, MAX_ITEMS);
    for (const i of fresh) seen.add(i.id);
    await setMeta(INBOX, next, db);
    await setMeta(SEEN, [...seen].slice(-500), db);
  });
}

export async function markInboxRead(db: KabanDB) {
  await db.transaction("rw", db.meta, async () => {
    const all = (await getMeta<InboxItem[]>(INBOX, db)) ?? [];
    if (all.some((i) => !i.read)) await setMeta(INBOX, all.map((i) => (i.read ? i : { ...i, read: true })), db);
  });
}

export async function clearInbox(db: KabanDB) {
  await setMeta(INBOX, [], db);
}

// ---------- Producers ----------

const name = (s: string | null | undefined, fallback: string) => s?.trim() || fallback;

/**
 * Compare the family list before and after a refresh. The first refresh on a device only sets the
 * baseline, so signing in doesn't flood the inbox with old news.
 */
export async function noteFamilyChanges(db: KabanDB, prev: FamilyState | undefined, next: FamilyState, myId?: string) {
  if (!prev) return;
  const now = Date.now();
  const items: Omit<InboxItem, "read">[] = [];
  const before = new Map(prev.families.map((f) => [f.id, f]));

  for (const r of next.my_requests) {
    const old = prev.my_requests.find((p) => p.id === r.id);
    if (old?.status !== "pending" || r.status === "pending") continue;
    if (r.status === "approved")
      items.push({ id: `family-joined:${r.id}`, kind: "family-joined", title: `You're in ${r.family_name}`, body: "Your request to join was accepted.", href: "/family", at: now });
    else if (r.status === "declined")
      items.push({ id: `family-declined:${r.id}`, kind: "family-declined", title: `Request to join ${r.family_name} declined`, href: "/family", at: now });
  }

  for (const f of next.families) {
    const old: Family | undefined = before.get(f.id);
    if (!old) continue; // Just joined: the request item above covers it.
    const known = new Set(old.members.map((m) => m.user_id));
    for (const m of f.members) {
      if (known.has(m.user_id) || m.user_id === myId) continue;
      items.push({ id: `member-joined:${f.id}:${m.user_id}`, kind: "member-joined", title: `${name(m.display_name, "Someone")} joined ${f.name}`, href: "/family/members", at: now });
    }
    const asked = new Set(old.requests.map((r) => r.id));
    for (const r of f.requests) {
      if (asked.has(r.id)) continue;
      items.push({ id: `join-request:${r.id}`, kind: "join-request", title: `${name(r.display_name, "Someone")} wants to join ${f.name}`, body: "Approve or decline it in Notifications.", at: now });
    }
  }
  await addInboxItems(db, items);
}

/** A family member's entry was brought into one of this user's shared accounts. */
export async function noteFamilyEntries(db: KabanDB, entries: { id: string; author: string; description: string; amountMinor: number; accountId: string }[]) {
  const now = Date.now();
  await addInboxItems(
    db,
    entries.map((e) => ({
      id: `family-entry:${e.id}`,
      kind: "family-entry" as const,
      title: `${e.author} added an entry`,
      body: e.description,
      amountMinor: e.amountMinor,
      href: `/accounts/view?id=${encodeURIComponent(e.accountId)}`,
      at: now,
    })),
  );
}

/** Credit cards due within `daysBefore` days, once per card per due date. Works without push permission. */
export async function noteCardsDue(db: KabanDB, accounts: Account[], daysBefore: number) {
  const today = todayISO();
  const items: Omit<InboxItem, "read">[] = [];
  for (const a of accounts) {
    if (a.archived || a.type !== "credit" || !a.closingDay) continue;
    const due = cycleInfo(a, today).upcomingDue;
    const days = Math.round((fromISO(due).getTime() - fromISO(today).getTime()) / 86_400_000);
    if (days < 0 || days > daysBefore) continue;
    // One item per due date, so the title names the date rather than "in 3 days" (which would go stale).
    const date = fromISO(due).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    items.push({ id: `card-due:${a.id}:${due}`, kind: "card-due", title: `${a.name} payment due ${date}`, body: "Open the card to see what to pay.", href: `/accounts/view?id=${encodeURIComponent(a.id)}`, at: Date.now() });
  }
  await addInboxItems(db, items);
}
