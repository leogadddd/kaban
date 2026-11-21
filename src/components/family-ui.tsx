"use client";

import qrcode from "qrcode-generator";
import { Check, X } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  cancelJoinRequest,
  isAdmin,
  memberName,
  respondJoinRequest,
  useFamilies,
  type FamilyMember,
  type ShareSetting,
  type ShareVisibility,
} from "@/lib/family";
import { LogoMark } from "@/lib/logo";
import { HapticButton } from "./haptic-button";
import { Button, Field, inputCls, SectionTitle, Segmented, cx } from "./ui";
import { noticeToast } from "./undo-toast";

export const FAMILY_ICONS = ["🏠", "🏡", "👨‍👩‍👧", "👪", "❤️", "🌿", "⭐", "🐾", "🍚", "🏝️", "🚗", "🎓"];
export const FAMILY_COLORS = ["#2D936C", "#176B4D", "#3C6E71", "#4A90A4", "#7B6CD9", "#C94B4B", "#E07A3F", "#C9A227"];

/** A person's photo, or their initials on a tinted circle. */
export function PersonAvatar({ name, avatar, size = 40, className }: { name?: string | null; avatar?: string | null; size?: number; className?: string }) {
  const initials = (name ?? "")
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  if (avatar)
    // eslint-disable-next-line @next/next/no-img-element -- small inline data URL, nothing to optimise
    return <img src={avatar} alt="" width={size} height={size} className={cx("shrink-0 rounded-full object-cover", className)} style={{ width: size, height: size }} />;
  return (
    <span aria-hidden="true" className={cx("grid shrink-0 place-items-center rounded-full bg-pale font-semibold text-brand", className)} style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials || "?"}
    </span>
  );
}

export function MemberAvatar({ member, size = 40, className }: { member?: Pick<FamilyMember, "display_name" | "avatar">; size?: number; className?: string }) {
  return <PersonAvatar name={memberName(member, "?")} avatar={member?.avatar} size={size} className={className} />;
}

export function FamilyMark({ icon, color, size = 44 }: { icon: string; color: string; size?: number }) {
  return (
    <span aria-hidden="true" className="grid shrink-0 place-items-center rounded-2xl" style={{ width: size, height: size, background: `${color}22`, fontSize: size * 0.5 }}>
      {icon}
    </span>
  );
}

export function FamilyBadge() {
  return <span className="inline-flex shrink-0 items-center rounded-full bg-pale px-2 py-0.5 text-xs font-medium text-brand">Family</span>;
}

export const ROLE_LABEL = { owner: "Owner", admin: "Admin", member: "Member" } as const;

/**
 * Invite QR code drawn with round dots and the Kaban mark in the middle. Error correction H leaves room
 * for the logo; the three corner finders stay solid rounded squares so every camera locks on quickly.
 */
export function InviteQr({ value, size = 232 }: { value: string; size?: number }) {
  const { count, dots } = useMemo(() => {
    const qr = qrcode(0, "H");
    qr.addData(value);
    qr.make();
    const count = qr.getModuleCount();
    const finder = (r: number, c: number) => (r < 8 && c < 8) || (r < 8 && c >= count - 8) || (r >= count - 8 && c < 8);
    const hole = Math.ceil(count * 0.22);
    const lo = Math.floor((count - hole) / 2);
    const center = (r: number, c: number) => r >= lo && r < lo + hole && c >= lo && c < lo + hole;
    const dots: [number, number][] = [];
    for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (qr.isDark(r, c) && !finder(r, c) && !center(r, c)) dots.push([r, c]);
    return { count, dots };
  }, [value]);
  const pad = 2;
  const box = count + pad * 2;
  const finders = [
    [0, 0],
    [0, count - 7],
    [count - 7, 0],
  ];
  return (
    <div className="relative mx-auto rounded-[1.75rem] bg-white p-3 shadow-soft" style={{ width: size + 24 }}>
      <svg viewBox={`0 0 ${box} ${box}`} width={size} height={size} role="img" aria-label="Invite QR code">
        <g transform={`translate(${pad} ${pad})`} fill="#0F3D2E">
          {dots.map(([r, c]) => (
            <circle key={`${r}-${c}`} cx={c + 0.5} cy={r + 0.5} r={0.43} />
          ))}
          {finders.map(([r, c]) => (
            <g key={`${r}-${c}`}>
              <rect x={c + 0.5} y={r + 0.5} width={6} height={6} rx={2} fill="none" stroke="#0F3D2E" strokeWidth={1} />
              <rect x={c + 2} y={r + 2} width={3} height={3} rx={1} fill="#176B4D" />
            </g>
          ))}
        </g>
      </svg>
      <span className="absolute top-1/2 left-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl bg-white p-1">
        <LogoMark size={Math.round(size * 0.17)} />
      </span>
    </div>
  );
}

/** Empty-state art: a little house with three people. Uses theme colors so it works in light and dark. */
export function FamilyIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 160" className={className} aria-hidden="true">
      <ellipse cx="110" cy="146" rx="92" ry="9" fill="var(--color-pale)" />
      <path d="M48 76 110 30l62 46v66H48z" fill="var(--color-surface)" stroke="var(--color-line)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M38 80 110 26l72 54" fill="none" stroke="var(--color-brand)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="96" y="104" width="28" height="38" rx="6" fill="var(--color-pale)" />
      <circle cx="80" cy="96" r="9" fill="var(--color-brand-2)" />
      <path d="M64 132c0-11 7-20 16-20s16 9 16 20z" fill="var(--color-brand-2)" />
      <circle cx="140" cy="96" r="9" fill="#C9A227" />
      <path d="M124 132c0-11 7-20 16-20s16 9 16 20z" fill="#C9A227" />
      <circle cx="110" cy="112" r="7" fill="var(--color-brand)" />
      <path d="M98 138c0-9 5-15 12-15s12 6 12 15z" fill="var(--color-brand)" />
      <path d="M110 58c-5 3.6-6 9.4-2.2 13.8 1.1 1.2 3.3 1.2 4.4 0 3.8-4.4 2.8-10.2-2.2-13.8z" fill="var(--color-brand-2)" />
    </svg>
  );
}

/** Join requests waiting for this user (as an admin) and the ones they sent, for the Notifications list. */
export function useFamilyRequests() {
  const state = useFamilies();
  return {
    incoming: state?.families.filter(isAdmin).flatMap((f) => f.requests.map((r) => ({ ...r, family: f }))) ?? [],
    mine: state?.my_requests ?? [],
  };
}

/** Approve or decline join requests, and follow or cancel your own. Renders nothing when there are none. */
export function FamilyRequests() {
  const { incoming, mine } = useFamilyRequests();
  const [busy, setBusy] = useState<string>();

  async function run(id: string, fn: () => Promise<unknown>, done: string) {
    setBusy(id);
    try {
      await fn();
      noticeToast(done);
    } catch (e) {
      noticeToast((e as Error).message, "error");
    } finally {
      setBusy(undefined);
    }
  }

  if (!incoming.length && !mine.length) return null;

  return (
    <>
      {incoming.length > 0 && (
        <section>
          <SectionTitle>Join requests</SectionTitle>
          <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface shadow-soft">
            {incoming.map((r) => (
              <li key={r.id} className="flex items-center gap-3 p-3">
                <PersonAvatar name={r.display_name} avatar={r.avatar} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.display_name || "Someone"}</p>
                  <p className="truncate text-xs text-ink-3">Wants to join {r.family.name}</p>
                </div>
                <HapticButton
                  type="button"
                  disabled={busy === r.id}
                  aria-label={`Decline ${r.display_name || "request"}`}
                  onClick={() => run(r.id, () => respondJoinRequest(r.id, false), "Request declined")}
                  className="grid size-10 place-items-center rounded-full bg-pale text-ink-2 disabled:opacity-40"
                >
                  <X className="size-4.5" />
                </HapticButton>
                <HapticButton
                  type="button"
                  disabled={busy === r.id}
                  aria-label={`Approve ${r.display_name || "request"}`}
                  onClick={() => run(r.id, () => respondJoinRequest(r.id, true), `${r.display_name || "They"} joined ${r.family.name}`)}
                  className="grid size-10 place-items-center rounded-full bg-brand text-on-brand disabled:opacity-40"
                >
                  <Check className="size-4.5" />
                </HapticButton>
              </li>
            ))}
          </ul>
        </section>
      )}
      {mine.length > 0 && (
        <section>
          <SectionTitle>Your join requests</SectionTitle>
          <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface shadow-soft">
            {mine.map((r) => (
              <li key={r.id} className="flex items-center gap-3 p-3">
                <FamilyMark icon={r.family_icon} color={r.family_color} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.family_name}</p>
                  <p className={cx("text-xs", r.status === "approved" ? "text-income" : r.status === "declined" ? "text-expense" : "text-ink-3")}>
                    {r.status === "pending" ? "Waiting for an admin" : r.status === "approved" ? "Approved" : r.status === "declined" ? "Declined" : "Cancelled"}
                  </p>
                </div>
                {r.status === "pending" && (
                  <HapticButton
                    type="button"
                    disabled={busy === r.id}
                    onClick={() => run(r.id, () => cancelJoinRequest(r.id), "Request cancelled")}
                    className="min-h-9 rounded-full bg-pale px-3 text-sm font-medium text-ink-2 disabled:opacity-40"
                  >
                    Cancel
                  </HapticButton>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

// ---------- Which family is showing (only matters once someone has more than one) ----------

const PICK_KEY = "kaban:family";
const pickListeners = new Set<() => void>();
function readPick() {
  try {
    return localStorage.getItem(PICK_KEY);
  } catch {
    return null;
  }
}
export function pickFamily(id: string) {
  try {
    localStorage.setItem(PICK_KEY, id);
  } catch {}
  pickListeners.forEach((l) => l());
}
const subscribePick = (l: () => void) => {
  pickListeners.add(l);
  return () => pickListeners.delete(l);
};

/** The family named in the URL, else the last one picked, else the first. */
export function useCurrentFamily(id?: string | null) {
  const state = useFamilies();
  const picked = useSyncExternalStore(subscribePick, readPick, () => null);
  const families = state?.families ?? [];
  const family = families.find((f) => f.id === id) ?? families.find((f) => f.id === picked) ?? families[0];
  return { state, family };
}

// ---------- Create / edit form ----------

export interface FamilyDetails {
  name: string;
  description: string;
  icon: string;
  color: string;
}

export function FamilyForm({ initial, submitLabel, onSubmit, disabled }: { initial?: FamilyDetails; submitLabel: string; onSubmit: (v: FamilyDetails) => Promise<void>; disabled?: boolean }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? FAMILY_ICONS[0]);
  const [color, setColor] = useState(initial?.color ?? FAMILY_COLORS[0]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return setError("Give your family a name.");
        setBusy(true);
        try {
          await onSubmit({ name: name.trim(), description: description.trim(), icon, color });
        } catch (err) {
          noticeToast((err as Error).message, "error");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="flex flex-col items-center gap-2 pt-1">
        <FamilyMark icon={icon} color={color} size={80} />
        <p className="text-sm text-ink-3">{name.trim() || "Your family"}</p>
      </div>
      <Field label="Name" error={error}>
        {(id) => (
          <input id={id} className={inputCls} value={name} maxLength={60} placeholder="The Santos family" onChange={(e) => { setName(e.target.value); setError(undefined); }} />
        )}
      </Field>
      <Field label="Description" hint="Optional. Shown to members.">
        {(id) => <textarea id={id} rows={2} className={cx(inputCls, "py-3")} value={description} maxLength={200} placeholder="Household money in one place" onChange={(e) => setDescription(e.target.value)} />}
      </Field>
      <fieldset>
        <legend className="mb-1.5 px-1 text-sm font-medium text-ink-2">Icon</legend>
        <div className="grid grid-cols-6 gap-2">
          {FAMILY_ICONS.map((i) => (
            <HapticButton key={i} type="button" aria-label={`Icon ${i}`} aria-pressed={icon === i} onClick={() => setIcon(i)}
              className={cx("grid aspect-square w-full place-items-center rounded-2xl border text-2xl", icon === i ? "border-brand bg-pale" : "border-line bg-surface")}>
              {i}
            </HapticButton>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1.5 px-1 text-sm font-medium text-ink-2">Color</legend>
        <div className="flex flex-wrap gap-2.5">
          {FAMILY_COLORS.map((c) => (
            <HapticButton key={c} type="button" aria-label={`Color ${c}`} aria-pressed={color === c} onClick={() => setColor(c)}
              className={cx("size-10 rounded-full ring-offset-2 ring-offset-bg", color === c && "ring-2 ring-brand")} style={{ background: c }} />
          ))}
        </div>
      </fieldset>
      <Button type="submit" disabled={busy || disabled} wrapperClassName="grid">{submitLabel}</Button>
    </form>
  );
}

// ---------- Account sharing (Edit account) ----------

export function ShareWithFamily({ value, onChange }: { value: ShareSetting[]; onChange: (v: ShareSetting[]) => void }) {
  const state = useFamilies();
  const families = state?.families ?? [];
  if (!families.length) return null;
  return (
    <section className="space-y-2">
      <p className="px-1 text-sm font-medium text-ink-2">Share with family</p>
      <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
        {families.map((f) => {
          const share = value.find((s) => s.familyId === f.id);
          return (
            <div key={f.id} className="space-y-3 p-4">
              <label className="flex items-center gap-3">
                <FamilyMark icon={f.icon} color={f.color} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{f.name}</span>
                  <span className="block text-xs text-ink-3">{share ? (share.visibility === "balance" ? "Members see the balance" : "Members see the balance and recent activity") : "Not shared"}</span>
                </span>
                <input
                  type="checkbox"
                  {...{ switch: "" }}
                  className="relative h-7 w-12 shrink-0 cursor-pointer appearance-none rounded-full bg-line transition-colors checked:bg-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none before:absolute before:top-0.5 before:left-0.5 before:size-6 before:rounded-full before:bg-white before:shadow-sm before:transition-transform checked:before:translate-x-5"
                  checked={!!share}
                  onChange={(e) =>
                    onChange(e.target.checked ? [...value, { familyId: f.id, visibility: "balance", allowAdd: true }] : value.filter((s) => s.familyId !== f.id))
                  }
                />
              </label>
              {share && (
                <Segmented<ShareVisibility>
                  size="sm"
                  value={share.visibility}
                  onChange={(v) => onChange(value.map((s) => (s.familyId === f.id ? { ...s, visibility: v } : s)))}
                  options={[
                    { value: "balance", label: "Balance only" },
                    { value: "activity", label: "Balance & activity" },
                  ]}
                />
              )}
              {share && (
                <label className="flex items-center gap-3 rounded-2xl bg-pale px-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">Members can add transactions</span>
                    <span className="block text-xs text-ink-3">What they add shows up in your ledger, with their name.</span>
                  </span>
                  <input
                    type="checkbox"
                    {...{ switch: "" }}
                    className="relative h-7 w-12 shrink-0 cursor-pointer appearance-none rounded-full bg-line transition-colors checked:bg-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none before:absolute before:top-0.5 before:left-0.5 before:size-6 before:rounded-full before:bg-white before:shadow-sm before:transition-transform checked:before:translate-x-5"
                    checked={share.allowAdd !== false}
                    onChange={(e) => onChange(value.map((s) => (s.familyId === f.id ? { ...s, allowAdd: e.target.checked } : s)))}
                  />
                </label>
              )}
            </div>
          );
        })}
      </div>
      <p className="px-1 text-xs text-ink-3">Others can&apos;t edit your records. Your notes and who you split with stay private. Updates upload in the background.</p>
    </section>
  );
}
