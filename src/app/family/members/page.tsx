"use client";

import { Crown, QrCode, Shield, ShieldOff, UserMinus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { confirmDialog } from "@/components/dialog";
import { MemberAvatar, ROLE_LABEL, useCurrentFamily } from "@/components/family-ui";
import { HapticButton } from "@/components/haptic-button";
import { noticeToast } from "@/components/undo-toast";
import { ButtonLink, Card, cx, EmptyState, Loading, PageHeader, Sheet } from "@/components/ui";
import { formatDayLong } from "@/lib/dates";
import { isAdmin, memberName, removeMember, setMemberRole, transferOwnership, type Family, type FamilyMember } from "@/lib/family";
import { useOnline } from "@/lib/hooks";
import { useSyncState } from "@/lib/sync";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Members />
    </Suspense>
  );
}

function Members() {
  const { state, family } = useCurrentFamily(useSearchParams().get("id"));
  const { userId } = useSyncState();
  const [selected, setSelected] = useState<FamilyMember>();

  if (state === null) return <Loading />;
  if (!family)
    return (
      <>
        <PageHeader title="Members" back="/family" privacy={false} />
        <EmptyState title="Family not found" action={<Link href="/family" className="text-brand">Back to family</Link>} />
      </>
    );

  const admin = isAdmin(family);
  const canManage = (m: FamilyMember) => admin && m.user_id !== userId && m.role !== "owner" && (m.role === "member" || family.role === "owner");

  return (
    <>
      <PageHeader title="Members" back privacy={false} subtitle={family.name} />
      <div className="space-y-4 px-4 pb-8">
        <Card className="divide-y divide-line p-0">
          {family.members.map((m) => {
            const me = m.user_id === userId;
            const manage = canManage(m) || (family.role === "owner" && !me);
            const row = (
              <>
                <MemberAvatar member={m} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{memberName(m)}{me && <span className="text-ink-3"> (you)</span>}</p>
                  <p className="truncate text-xs text-ink-3">Joined {formatDayLong(m.joined_at.slice(0, 10))}</p>
                </div>
                <RoleBadge role={m.role} />
              </>
            );
            return manage ? (
              <HapticButton key={m.user_id} type="button" onClick={() => setSelected(m)} wrapperClassName="grid" className="flex w-full items-center gap-3 p-4 text-left active:bg-pale">
                {row}
              </HapticButton>
            ) : (
              <div key={m.user_id} className="flex items-center gap-3 p-4">{row}</div>
            );
          })}
        </Card>
        {admin && (
          <ButtonLink href={`/family/invite?id=${family.id}`} variant="secondary" wrapperClassName="grid">
            <QrCode className="size-4" /> Invite people
          </ButtonLink>
        )}
        <p className="px-1 text-xs text-ink-3">
          Owners and admins approve requests and manage members. Only the owner can remove admins or hand over ownership.
        </p>
      </div>
      <Sheet open={!!selected} onClose={() => setSelected(undefined)} title={selected ? memberName(selected) : undefined}>
        {selected && <MemberActions family={family} member={selected} canManage={canManage(selected)} onDone={() => setSelected(undefined)} />}
      </Sheet>
    </>
  );
}

function RoleBadge({ role }: { role: FamilyMember["role"] }) {
  return (
    <span className={cx("rounded-full px-2.5 py-1 text-xs font-medium", role === "owner" ? "bg-gold/15 text-gold" : role === "admin" ? "bg-pale text-brand" : "text-ink-3")}>
      {ROLE_LABEL[role]}
    </span>
  );
}

function MemberActions({ family, member, canManage, onDone }: { family: Family; member: FamilyMember; canManage: boolean; onDone: () => void }) {
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const name = memberName(member);

  async function run(fn: () => Promise<unknown>, done: string, confirm?: Parameters<typeof confirmDialog>[0]) {
    if (confirm && !(await confirmDialog(confirm))) return;
    setBusy(true);
    try {
      await fn();
      noticeToast(done);
      onDone();
    } catch (e) {
      noticeToast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const actions = [
    canManage && member.role === "member" && {
      icon: Shield,
      label: "Make admin",
      run: () => run(() => setMemberRole(family.id, member.user_id, "admin"), `${name} is now an admin`),
    },
    canManage && member.role === "admin" && {
      icon: ShieldOff,
      label: "Remove admin rights",
      run: () => run(() => setMemberRole(family.id, member.user_id, "member"), `${name} is now a member`),
    },
    family.role === "owner" && {
      icon: Crown,
      label: "Make owner",
      run: () =>
        run(() => transferOwnership(family.id, member.user_id), `${name} now owns ${family.name}`, {
          title: `Make ${name} the owner?`,
          body: "You become an admin. Only the owner can delete the family or remove admins.",
          confirmLabel: "Make owner",
        }),
    },
    canManage && {
      icon: UserMinus,
      label: `Remove from ${family.name}`,
      danger: true,
      run: () =>
        run(() => removeMember(family.id, member.user_id), `${name} was removed`, {
          title: `Remove ${name}?`,
          body: "They lose access to this family and the accounts they shared stop showing here. Their own ledger isn't touched.",
          confirmLabel: "Remove",
          danger: true,
        }),
    },
  ].filter(Boolean) as { icon: typeof Crown; label: string; danger?: boolean; run: () => void }[];

  return (
    <div className="space-y-3 pb-2">
      {!online && <p className="px-1 text-sm text-ink-3">You&apos;re offline. These actions need a connection.</p>}
      <nav className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
        {actions.map((a) => (
          <HapticButton key={a.label} type="button" disabled={busy || !online} onClick={a.run} wrapperClassName="grid"
            className={cx("flex min-h-14 w-full items-center gap-3 px-4 text-left font-medium active:bg-pale disabled:opacity-40", a.danger && "text-expense")}>
            <a.icon className="size-4.5" /> {a.label}
          </HapticButton>
        ))}
      </nav>
    </div>
  );
}
