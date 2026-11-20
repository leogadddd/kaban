"use client";

import { Camera, Lock, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { PersonAvatar } from "@/components/family-ui";
import { HapticButton } from "@/components/haptic-button";
import { noticeToast } from "@/components/undo-toast";
import { Button, Field, inputCls, Loading, PageHeader } from "@/components/ui";
import { todayISO } from "@/lib/dates";
import { avatarFromFile, saveProfile, useProfile, type Profile } from "@/lib/family";
import { animatedBack } from "@/lib/nav-direction";
import { useSyncState } from "@/lib/sync";

export default function Page() {
  const profile = useProfile();
  const { userId } = useSyncState();
  // null: the cached profile is still loading. undefined: nothing cached yet (new account).
  if (profile === null || !userId) return <><PageHeader title="Edit profile" back privacy={false} /><Loading /></>;
  return <EditProfile initial={profile} />;
}

function EditProfile({ initial }: { initial?: Profile }) {
  const router = useRouter();
  const { email } = useSyncState();
  const [name, setName] = useState(initial?.display_name ?? "");
  const [birthday, setBirthday] = useState(initial?.birthday ?? "");
  const [avatar, setAvatar] = useState(initial?.avatar ?? null);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  async function pick(f?: File) {
    if (!f) return;
    try {
      setAvatar(await avatarFromFile(f));
    } catch (e) {
      noticeToast((e as Error).message, "error");
    }
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return setError("Add the name your family will see.");
    if (birthday && birthday > todayISO()) return setError("Birthday can't be in the future.");
    setSaving(true);
    try {
      await saveProfile({ display_name: trimmed, birthday: birthday || null, avatar });
      noticeToast("Profile saved");
      animatedBack(() => router.back());
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="Edit profile" back privacy={false} />
      <form
        className="space-y-5 px-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="flex flex-col items-center gap-3 pt-2">
          <div className="relative">
            <PersonAvatar name={name || email} avatar={avatar} size={104} className="ring-4 ring-pale" />
            <HapticButton
              type="button"
              aria-label="Change photo"
              onClick={() => file.current?.click()}
              wrapperClassName="absolute -right-1 -bottom-1"
              className="grid size-10 place-items-center rounded-full bg-brand text-on-brand shadow-soft ring-4 ring-bg"
            >
              <Camera className="size-4.5" />
            </HapticButton>
          </div>
          <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
          {avatar && (
            <HapticButton type="button" onClick={() => setAvatar(null)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm text-ink-2 active:bg-pale">
              <Trash2 className="size-4" /> Remove photo
            </HapticButton>
          )}
        </div>

        <Field label="Name" error={error}>
          {(id) => (
            <input
              id={id}
              className={inputCls}
              value={name}
              maxLength={60}
              autoComplete="name"
              placeholder="What your family calls you"
              onChange={(e) => {
                setName(e.target.value);
                setError(undefined);
              }}
            />
          )}
        </Field>

        <Field label="Birthday" hint="Optional. Only you can see it.">
          {(id) => <input id={id} type="date" className={inputCls} value={birthday} max={todayISO()} min="1900-01-01" onChange={(e) => setBirthday(e.target.value)} />}
        </Field>

        <Field label="Email" hint="Your sign-in email can't be changed here.">
          {(id) => (
            <div className="relative">
              <input id={id} className={`${inputCls} pr-11 text-ink-3`} value={email ?? ""} readOnly aria-readonly="true" />
              <Lock className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
            </div>
          )}
        </Field>

        <Button type="submit" disabled={saving} wrapperClassName="grid">
          Save
        </Button>
        <p className="-mt-2 text-center text-xs text-ink-3">Saves instantly on this device and uploads in the background.</p>
      </form>
    </>
  );
}
