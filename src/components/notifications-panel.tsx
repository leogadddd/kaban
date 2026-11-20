"use client";

import { Bell, CalendarClock, ChevronRight, HandCoins, UserCheck, UserPlus, UserX, Users, WifiOff, Zap, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { confirmDialog } from "@/components/dialog";
import { HapticButton, HapticLink } from "@/components/haptic-button";
import { FamilyRequests, useFamilyRequests } from "@/components/family-ui";
import { QuickEntryForm } from "@/components/quick-add-form";
import { cx, EmptyState, Money, SectionTitle, Sheet } from "@/components/ui";
import { useLedgerDatabase } from "@/lib/db";
import { useLedger, useMeta, useOnline } from "@/lib/hooks";
import { clearInbox, markInboxRead, useInbox, type InboxItem, type InboxKind } from "@/lib/inbox";
import { PENDING, type QuickEntry } from "@/lib/quick-add";
import { useSyncState } from "@/lib/sync";

const ICONS: Record<InboxKind, { icon: LucideIcon; cls: string }> = {
  "family-joined": { icon: UserCheck, cls: "bg-pale text-brand" },
  "family-declined": { icon: UserX, cls: "bg-line/60 text-ink-2" },
  "member-joined": { icon: Users, cls: "bg-pale text-brand" },
  "join-request": { icon: UserPlus, cls: "bg-gold/15 text-gold" },
  "family-entry": { icon: HandCoins, cls: "bg-pale text-brand" },
  "card-due": { icon: CalendarClock, cls: "bg-expense/10 text-expense" },
};

function ago(ms: number) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** "Clear" for the header of whichever view holds the list. */
export function ClearNotifications() {
  const db = useLedgerDatabase();
  const inbox = useInbox();
  if (!inbox?.length) return null;
  return (
    <HapticButton
      type="button"
      onClick={async () => {
        if (db && (await confirmDialog({ title: "Clear notifications?", body: "Entries waiting for approval stay.", confirmLabel: "Clear" }))) await clearInbox(db);
      }}
      className="min-h-10 rounded-full px-3 text-sm font-medium text-brand active:bg-pale lg:hover:bg-pale"
    >
      Clear
    </HapticButton>
  );
}

/**
 * The notifications themselves, used by the phone page and the desktop side panel. `onNavigate` runs when
 * a row opens another page (the panel closes itself then).
 */
export function NotificationsList({ onNavigate }: { onNavigate?: () => void }) {
  const db = useLedgerDatabase();
  const online = useOnline();
  const { userId } = useSyncState();
  const pending = useMeta<QuickEntry[]>(PENDING) ?? [];
  const inbox = useInbox();
  const { activeAccounts, txns } = useLedger();
  const [reviewing, setReviewing] = useState<QuickEntry>();

  // Unread dots stay while it's open; everything counts as read once it closes (or the app is put away).
  useEffect(() => {
    if (!db) return;
    const onHide = () => document.visibilityState === "hidden" && void markInboxRead(db);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      void markInboxRead(db);
    };
  }, [db]);

  const requests = useFamilyRequests();
  // A join request still waiting is answered in its own section above; don't list it twice.
  const waiting = new Set(requests.incoming.map((r) => `join-request:${r.id}`));
  // One that's no longer waiting was answered (here or on another device): keep it as history, without the
  // old "approve in Members" hint and link that older notifications carry.
  const items = (inbox ?? [])
    .filter((i) => !waiting.has(i.id))
    .map((i) => (i.kind === "join-request" ? { ...i, body: "Answered", href: undefined } : i));
  const empty = !pending.length && !items.length && !requests.incoming.length && !requests.mine.length;

  return (
    <div className="space-y-6">

        {!online && userId && (
          <p className="flex items-center gap-2 rounded-2xl bg-pale p-3 text-sm text-ink-2">
            <WifiOff className="size-4 shrink-0" /> You&apos;re offline. New notifications arrive when you&apos;re back online.
          </p>
        )}

        {pending.length > 0 && (
          <section>
            <SectionTitle>Needs your approval</SectionTitle>
            <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface shadow-soft">
              {pending.map((e) => (
                <HapticButton key={e.id} type="button" onClick={() => setReviewing(e)} wrapperClassName="block" className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left active:bg-pale">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold">
                    <Zap className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{e.description || (e.type === "income" ? "Income" : "Expense")}</span>
                    <span className="block truncate text-sm text-ink-3">Quick add · {e.source ?? "Shortcut"} · {ago(new Date(e.createdAt).getTime())}</span>
                  </span>
                  <Money minor={e.amountMinor} tone={e.type === "income" ? "income" : "expense"} className="font-semibold" />
                  <ChevronRight className="size-4 shrink-0 text-ink-3" />
                </HapticButton>
              ))}
            </div>
          </section>
        )}

        <FamilyRequests />

        {items.length > 0 && (
          <section>
            <SectionTitle>Recent</SectionTitle>
            <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface shadow-soft">
              {items.map((i) => (
                <Row key={i.id} item={i} unread={!i.read} onNavigate={onNavigate} />
              ))}
            </div>
          </section>
        )}

        {empty && <EmptyState icon={<Bell className="size-6" />} title="You're all caught up" body="Quick adds to approve, family join requests and news, and payment due dates show up here." />}

      <Sheet open={!!reviewing} onClose={() => setReviewing(undefined)} title="Approve quick add">
        {reviewing && <QuickEntryForm key={reviewing.id} entry={reviewing} accounts={activeAccounts} txns={txns} onDone={() => setReviewing(undefined)} />}
      </Sheet>
    </div>
  );
}

function Row({ item, unread, onNavigate }: { item: InboxItem; unread: boolean; onNavigate?: () => void }) {
  const { icon: Icon, cls } = ICONS[item.kind] ?? { icon: Bell, cls: "bg-pale text-brand" };
  const body = (
    <>
      <span className={cx("grid size-10 shrink-0 place-items-center rounded-xl", cls)}>
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cx("block truncate", unread ? "font-semibold" : "font-medium")}>{item.title}</span>
        <span className="block truncate text-sm text-ink-3">
          {item.body ? `${item.body} · ` : ""}
          {ago(item.at)}
        </span>
      </span>
      {item.amountMinor !== undefined && <Money minor={item.amountMinor} className="text-sm font-medium" />}
      {unread && <span aria-label="New" className="size-2 shrink-0 rounded-full bg-brand-2" />}
    </>
  );
  const cls2 = "flex min-h-16 w-full items-center gap-3 px-4 py-3";
  return item.href ? (
    <HapticLink href={item.href} onClick={onNavigate} wrapperClassName="block" className={cx(cls2, "active:bg-pale")}>{body}</HapticLink>
  ) : (
    <div className={cls2}>{body}</div>
  );
}
