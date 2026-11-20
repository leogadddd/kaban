"use client";

import { CalendarClock, ChevronRight, CloudOff, Eye, LogIn, QrCode, ScanLine, Settings, Share2, UserPlus, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FamilyIllustration, FamilyMark, InboxButton, MemberAvatar, pickFamily, useCurrentFamily } from "@/components/family-ui";
import { HapticLink } from "@/components/haptic-button";
import { BankLogo } from "@/components/bank-logo";
import { GroupTitle, Tile, Tiles } from "@/components/swipe-hub";
import { ButtonLink, Card, Chip, cx, Loading, Money, PageHeader, Progress, SectionTitle } from "@/components/ui";
import { bankFor } from "@/lib/banks";
import { formatDay, relativeDayLabel, todayISO } from "@/lib/dates";
import { isAdmin, isForming, memberName, refreshFamilies, type Family, type FamilyMember, type SharedAccount, type SnapshotTxn } from "@/lib/family";
import { useOnline } from "@/lib/hooks";
import { cloudConfigured } from "@/lib/supabase";
import { useSyncState } from "@/lib/sync";

export default function Page() {
  const { userId } = useSyncState();
  const { state, family } = useCurrentFamily();
  const online = useOnline();
  // First visit on this device: nothing cached yet, so wait for one fetch before showing "no family".
  const [fetchDone, setFetchDone] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    refreshFamilies()
      .catch(() => {})
      .finally(() => live && setFetchDone(true));
    return () => {
      live = false;
    };
  }, [userId]);

  if (!userId) return <SignedOut />;
  if (state === null || (state === undefined && !fetchDone && online)) return <><Header /><Loading /></>;
  if (!state || !family) return <NoFamily offline={!state && !online} />;

  return <Dashboard family={family} families={state.families} myId={userId} />;
}

function Header({ family }: { family?: Family }) {
  return (
    <PageHeader
      title="Family"
      action={
        <div className="flex items-center gap-2">
          <InboxButton />
          {family && (
            <HapticLink href={`/family/settings?id=${family.id}`} aria-label="Family settings" className="grid size-11 place-items-center rounded-full border border-line bg-surface">
              <Settings className="size-5" />
            </HapticLink>
          )}
        </div>
      }
    />
  );
}

function SignedOut() {
  return (
    <>
      <PageHeader title="Family" />
      <div className="flex flex-col items-center px-6 pt-4 pb-10 text-center">
        <FamilyIllustration className="mb-4 w-56" />
        <p className="text-lg font-semibold">Track money together</p>
        <p className="mt-1 max-w-xs text-sm text-ink-3">
          {cloudConfigured ? "Sign in to create a family, invite the people you live with and share the accounts you choose." : "Families need cloud sync, which isn't set up in this build."}
        </p>
        {cloudConfigured && (
          <div className="mt-5 grid w-full max-w-xs grid-cols-2 gap-2">
            <ButtonLink href="/signup" wrapperClassName="grid"><UserPlus className="size-4" /> Sign up</ButtonLink>
            <ButtonLink href="/login" variant="secondary" wrapperClassName="grid"><LogIn className="size-4" /> Sign in</ButtonLink>
          </div>
        )}
      </div>
    </>
  );
}

function NoFamily({ offline }: { offline: boolean }) {
  return (
    <>
      <Header />
      <div className="flex flex-col items-center px-6 pt-2 pb-10 text-center">
        <FamilyIllustration className="mb-4 w-60" />
        <p className="text-lg font-semibold">No family yet</p>
        <p className="mt-1 max-w-xs text-sm text-ink-3">Start one and invite others with a QR code, or scan a code someone shows you. You choose which accounts to share.</p>
        {offline && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-pale px-3 py-1 text-xs text-ink-2">
            <CloudOff className="size-3.5" /> Offline. Connect to load your family.
          </p>
        )}
        <div className="mt-6 grid w-full max-w-xs gap-2">
          <ButtonLink href="/family/new" wrapperClassName="grid"><Users className="size-4" /> Create a family</ButtonLink>
          <ButtonLink href="/family/join?scan=1" variant="secondary" wrapperClassName="grid"><ScanLine className="size-4" /> Scan to join</ButtonLink>
          <ButtonLink href="/family/join" variant="ghost" wrapperClassName="grid" className="min-h-10 text-sm">Enter a code instead</ButtonLink>
        </div>
      </div>
    </>
  );
}

function Dashboard({ family, families, myId }: { family: Family; families: Family[]; myId: string }) {
  const members = useMemo(() => new Map(family.members.map((m) => [m.user_id, m])), [family.members]);
  const data = useMemo(() => summarise(family.shared), [family.shared]);
  const forming = isForming(family);
  const admin = isAdmin(family);

  return (
    <>
      <Header family={family} />
      <div className="space-y-5 px-4 pb-6">
        {families.length > 1 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {families.map((f) => (
              <Chip key={f.id} active={f.id === family.id} onClick={() => pickFamily(f.id)}>
                <span aria-hidden>{f.icon}</span> {f.name}
              </Chip>
            ))}
          </div>
        )}

        <Card className="flex items-center gap-3">
          <FamilyMark icon={family.icon} color={family.color} size={52} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold tracking-tight">{family.name}</p>
            <p className="truncate text-sm text-ink-3">{family.description || `${family.members.length} ${family.members.length === 1 ? "member" : "members"}`}</p>
          </div>
          <Link href={`/family/members?id=${family.id}`} className="flex items-center -space-x-2" aria-label="Members">
            {family.members.slice(0, 4).map((m) => (
              <MemberAvatar key={m.user_id} member={m} size={32} className="ring-2 ring-surface" />
            ))}
            {family.members.length > 4 && <span className="grid size-8 place-items-center rounded-full bg-pale text-xs font-semibold text-brand ring-2 ring-surface">+{family.members.length - 4}</span>}
          </Link>
        </Card>

        {forming && (
          <Card className="bg-night text-white dark:border-white/6">
            <p className="font-semibold">Invite someone to get started</p>
            <p className="mt-1 text-sm text-white/70">
              {admin ? "Your family is ready once a second person joins. Show them your QR code or send the link." : "Waiting for the first members to join."}
            </p>
            {admin && (
              <ButtonLink href={`/family/invite?id=${family.id}`} variant="secondary" wrapperClassName="mt-4 grid" className="bg-white text-brand-deep">
                <QrCode className="size-4" /> Show invite code
              </ButtonLink>
            )}
          </Card>
        )}

        {!family.shared.length ? (
          <Card className="text-center">
            <span className="mx-auto mb-2 grid size-12 place-items-center rounded-2xl bg-pale text-brand"><Share2 className="size-5" /></span>
            <p className="font-semibold">Nothing shared yet</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-ink-3">Open one of your accounts, tap Edit and turn on sharing with {family.name}. Everyone sees it here.</p>
            <ButtonLink href="/accounts" variant="secondary" wrapperClassName="mt-4 grid">Choose an account</ButtonLink>
          </Card>
        ) : (
          <>
            <Tiles>
              <Tile label="Shared money" dark><Money minor={data.cash} /></Tile>
              <Tile label="Card balances"><Money minor={data.credit} /></Tile>
              <Tile label="Spent this month"><Money minor={data.monthSpend} /></Tile>
              <Tile label="Shared accounts">{family.shared.length}</Tile>
            </Tiles>

            {data.byMember.length > 0 && data.monthSpend > 0 && (
              <section>
                <SectionTitle>Spending by member</SectionTitle>
                <Card className="space-y-3">
                  {data.byMember.map(({ ownerId, amount }) => (
                    <div key={ownerId} className="flex items-center gap-3">
                      <MemberAvatar member={members.get(ownerId)} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between gap-2 text-sm">
                          <span className="truncate font-medium">{who(members.get(ownerId), ownerId, myId)}</span>
                          <Money minor={amount} />
                        </div>
                        <Progress value={(amount / data.monthSpend) * 100} className="mt-1.5 h-1.5" />
                      </div>
                    </div>
                  ))}
                </Card>
              </section>
            )}

            {data.categories.length > 0 && (
              <section>
                <SectionTitle>This month by category</SectionTitle>
                <Card className="space-y-2.5">
                  {data.categories.slice(0, 6).map(({ category, amount }) => (
                    <div key={category}>
                      <div className="flex justify-between text-sm">
                        <span>{category}</span>
                        <Money minor={amount} />
                      </div>
                      <Progress value={(amount / data.categories[0].amount) * 100} className="mt-1 h-1.5" />
                    </div>
                  ))}
                </Card>
              </section>
            )}

            {data.dues.length > 0 && (
              <section>
                <GroupTitle icon={CalendarClock}>Upcoming card dues</GroupTitle>
                <Card className="divide-y divide-line p-0">
                  {data.dues.map((s) => (
                    <div key={`${s.owner_id}:${s.account_id}`} className="flex items-center gap-3 p-4">
                      <AccountMark s={s} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{s.snapshot.account.name}</p>
                        <p className="truncate text-xs text-ink-3">Due {relativeDayLabel(s.snapshot.dueDate!)} · {who(members.get(s.owner_id), s.owner_id, myId)}</p>
                      </div>
                      <Money minor={s.snapshot.balanceMinor} className="font-semibold" />
                    </div>
                  ))}
                </Card>
              </section>
            )}

            <section>
              <GroupTitle icon={Wallet}>Shared accounts</GroupTitle>
              <Card className="divide-y divide-line p-0">
                {family.shared.map((s) => (
                  <div key={`${s.owner_id}:${s.account_id}`} className="flex items-center gap-3 p-4">
                    <AccountMark s={s} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{s.snapshot.account.name}</p>
                      <p className="flex items-center gap-1 truncate text-xs text-ink-3">
                        {who(members.get(s.owner_id), s.owner_id, myId)} · {s.visibility === "balance" ? <><Eye className="size-3" /> Balance only</> : "Balance & activity"}
                      </p>
                    </div>
                    <div className="text-right">
                      <Money minor={s.snapshot.balanceMinor} className={cx("font-semibold", s.snapshot.account.type === "credit" && "text-expense")} />
                      <p className="text-[0.7rem] text-ink-3">{s.snapshot.account.type === "credit" ? "owed" : "balance"}</p>
                    </div>
                  </div>
                ))}
              </Card>
            </section>

            {data.recent.length > 0 && (
              <section>
                <SectionTitle>Recent activity</SectionTitle>
                <Card className="divide-y divide-line p-0">
                  {data.recent.map(({ t, s }) => (
                    <div key={`${s.owner_id}:${t.id}:${s.account_id}`} className="flex items-center gap-3 px-4 py-3">
                      <MemberAvatar member={members.get(s.owner_id)} size={32} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{t.description || t.category || "Transaction"}</p>
                        <p className="truncate text-xs text-ink-3">{formatDay(t.date)} · {s.snapshot.account.name}</p>
                      </div>
                      <Money minor={s.snapshot.account.type === "credit" ? -t.effect : t.effect} sign tone="auto" className="text-sm font-semibold" />
                    </div>
                  ))}
                </Card>
              </section>
            )}
          </>
        )}

        <Link href={`/family/members?id=${family.id}`} className="flex min-h-14 items-center gap-3 rounded-3xl border border-line bg-surface px-4 active:bg-pale">
          <span className="grid size-9 place-items-center rounded-xl bg-pale text-brand"><Users className="size-4.5" /></span>
          <span className="flex-1 font-medium">Members</span>
          <span className="text-sm text-ink-3">{family.members.length}</span>
          <ChevronRight className="size-4 text-ink-3" />
        </Link>
      </div>
    </>
  );
}

function AccountMark({ s }: { s: SharedAccount }) {
  const bank = bankFor(s.snapshot.account);
  if (bank) return <BankLogo bank={bank} size={36} />;
  return <span className="size-9 shrink-0 rounded-xl" style={{ background: s.snapshot.account.color }} aria-hidden />;
}

function who(m: FamilyMember | undefined, id: string, myId: string) {
  return id === myId ? "You" : memberName(m, "Former member");
}

function summarise(shared: SharedAccount[]) {
  const month = todayISO().slice(0, 7);
  let cash = 0;
  let credit = 0;
  let monthSpend = 0;
  const byMember = new Map<string, number>();
  const categories = new Map<string, number>();
  const recent: { t: SnapshotTxn; s: SharedAccount }[] = [];
  for (const s of shared) {
    const snap = s.snapshot;
    if (snap.account.type === "credit") credit += snap.balanceMinor;
    else cash += snap.balanceMinor;
    monthSpend += snap.monthSpendMinor;
    byMember.set(s.owner_id, (byMember.get(s.owner_id) ?? 0) + snap.monthSpendMinor);
    for (const t of snap.txns ?? []) {
      recent.push({ t, s });
      if (t.type === "expense" && t.effect !== 0 && t.date.startsWith(month)) categories.set(t.category || "Other", (categories.get(t.category || "Other") ?? 0) + t.amountMinor);
    }
  }
  recent.sort((a, b) => b.t.date.localeCompare(a.t.date));
  return {
    cash,
    credit,
    monthSpend,
    byMember: [...byMember].map(([ownerId, amount]) => ({ ownerId, amount })).filter((r) => r.amount > 0).sort((a, b) => b.amount - a.amount),
    categories: [...categories].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
    dues: shared.filter((s) => s.snapshot.dueDate && s.snapshot.balanceMinor > 0).sort((a, b) => a.snapshot.dueDate!.localeCompare(b.snapshot.dueDate!)),
    recent: recent.slice(0, 12),
  };
}
