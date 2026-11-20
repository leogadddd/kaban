"use client";

import { ChevronRight, LogOut, QrCode, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { confirmDialog } from "@/components/dialog";
import { FamilyForm, useCurrentFamily } from "@/components/family-ui";
import { noticeToast } from "@/components/undo-toast";
import { Button, Card, EmptyState, Loading, PageHeader, SectionTitle } from "@/components/ui";
import { deleteFamily, isAdmin, leaveFamily, updateFamily } from "@/lib/family";
import { useOnline } from "@/lib/hooks";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Settings />
    </Suspense>
  );
}

function Settings() {
  const router = useRouter();
  const online = useOnline();
  const { state, family } = useCurrentFamily(useSearchParams().get("id"));
  const [busy, setBusy] = useState(false);

  if (state === null) return <Loading />;
  if (!family)
    return (
      <>
        <PageHeader title="Family settings" back="/family" privacy={false} />
        <EmptyState title="Family not found" action={<Link href="/family" className="text-brand">Back to family</Link>} />
      </>
    );

  const owner = family.role === "owner";
  const alone = family.members.length === 1;

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await fn();
      noticeToast(done);
      router.replace("/family");
    } catch (e) {
      noticeToast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Family settings" back privacy={false} />
      <div className="space-y-6 px-4 pb-10">
        <nav className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
          <Link href={`/family/members?id=${family.id}`} className="flex min-h-14 items-center gap-3 px-4 font-medium active:bg-pale">
            <span className="grid size-9 place-items-center rounded-xl bg-pale text-brand"><Users className="size-4.5" /></span>
            <span className="flex-1">Members</span>
            <span className="text-sm text-ink-3">{family.members.length}</span>
            <ChevronRight className="size-4 text-ink-3" />
          </Link>
          {isAdmin(family) && (
            <Link href={`/family/invite?id=${family.id}`} className="flex min-h-14 items-center gap-3 px-4 font-medium active:bg-pale">
              <span className="grid size-9 place-items-center rounded-xl bg-pale text-brand"><QrCode className="size-4.5" /></span>
              <span className="flex-1">Invite code</span>
              <ChevronRight className="size-4 text-ink-3" />
            </Link>
          )}
        </nav>

        {isAdmin(family) ? (
          <section>
            <SectionTitle>Details</SectionTitle>
            <Card>
              <FamilyForm
                key={family.id}
                initial={{ name: family.name, description: family.description ?? "", icon: family.icon, color: family.color }}
                submitLabel="Save changes"
                disabled={!online}
                onSubmit={async (v) => {
                  await updateFamily(family.id, v);
                  noticeToast("Family updated");
                }}
              />
            </Card>
          </section>
        ) : (
          <p className="px-1 text-sm text-ink-3">Only admins can change the family&apos;s name and look.</p>
        )}

        <section className="space-y-2">
          <SectionTitle>Leave or delete</SectionTitle>
          {!online && <p className="px-1 text-sm text-ink-3">You&apos;re offline. These need a connection.</p>}
          {(!owner || alone) && (
            <Button
              variant="danger"
              disabled={busy || !online}
              wrapperClassName="grid"
              onClick={async () => {
                const ok = await confirmDialog({
                  title: owner ? `Close ${family.name}?` : `Leave ${family.name}?`,
                  body: owner
                    ? "You're the only member, so leaving closes the family. Your own accounts and records stay exactly as they are."
                    : "You stop seeing the family dashboard and the accounts you shared stop showing to others. Your own accounts and records stay exactly as they are.",
                  confirmLabel: owner ? "Close family" : "Leave",
                  danger: true,
                });
                if (ok) await run(() => leaveFamily(family.id), owner ? "Family closed" : `You left ${family.name}`);
              }}
            >
              <LogOut className="size-4" /> {owner ? "Close family" : "Leave family"}
            </Button>
          )}
          {owner && !alone && (
            <>
              <p className="px-1 text-sm text-ink-3">To leave, first make someone else the owner from Members.</p>
              <Button
                variant="danger"
                disabled={busy || !online}
                wrapperClassName="grid"
                onClick={async () => {
                  const ok = await confirmDialog({
                    title: `Delete ${family.name}?`,
                    body: "Everyone is removed and shared accounts stop showing. Each member's own accounts and records are not affected.",
                    confirmLabel: "Delete family",
                    typeToConfirm: family.name,
                    danger: true,
                  });
                  if (ok) await run(() => deleteFamily(family.id), "Family deleted");
                }}
              >
                <Trash2 className="size-4" /> Delete family
              </Button>
            </>
          )}
        </section>
      </div>
    </>
  );
}
