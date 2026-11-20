"use client";

import { useRouter } from "next/navigation";
import { FamilyForm, pickFamily } from "@/components/family-ui";
import { Card, PageHeader } from "@/components/ui";
import { createFamily, useFamilies } from "@/lib/family";
import { useOnline } from "@/lib/hooks";

export default function Page() {
  const router = useRouter();
  const state = useFamilies();
  const online = useOnline();
  const atLimit = !!state && state.families.length >= state.max_families;

  return (
    <>
      <PageHeader title="New family" back privacy={false} />
      <div className="space-y-4 px-4 pb-8">
        <p className="px-1 text-sm text-ink-3">You&apos;ll be the owner. Invite others with a QR code next. Your family is active once someone joins.</p>
        {atLimit && (
          <Card className="bg-pale text-sm">
            You&apos;re already in {state.families.length === 1 ? "a family" : `${state.families.length} families`}. Your plan allows {state.max_families}. Leave one first to start another.
          </Card>
        )}
        {!online && <Card className="bg-pale text-sm">Creating a family needs a connection.</Card>}
        <FamilyForm
          submitLabel="Create family"
          disabled={atLimit || !online}
          onSubmit={async (v) => {
            const id = await createFamily(v);
            pickFamily(id);
            router.replace(`/family/invite?id=${id}&new=1`);
          }}
        />
      </div>
    </>
  );
}
