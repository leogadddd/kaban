"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { HapticButton, HapticLink } from "@/components/haptic-button";
import { cx } from "@/components/ui";

/** A titled block of rows, iOS-settings style: one card, rows split by hairlines. */
export function SettingsGroup({ title, footer, children, className }: { title?: string; footer?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      {title && <h2 className="mb-1.5 px-4 text-xs font-semibold tracking-wide text-ink-3 uppercase">{title}</h2>}
      <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface shadow-soft">{children}</div>
      {footer && <p className="mt-1.5 px-4 text-xs text-ink-3">{footer}</p>}
    </section>
  );
}

type Tone = "brand" | "danger" | "gold" | "muted";
const TONES: Record<Tone, string> = {
  brand: "bg-pale text-brand",
  danger: "bg-expense/10 text-expense",
  gold: "bg-gold/15 text-gold",
  muted: "bg-line/60 text-ink-2",
};

function RowBody({ icon: Icon, label, detail, tone = "brand", trailing, chevron }: RowProps & { chevron?: boolean }) {
  return (
    <>
      {Icon && (
        <span className={cx("grid size-9 shrink-0 place-items-center rounded-xl", TONES[tone])}>
          <Icon className="size-[1.1rem]" />
        </span>
      )}
      <span className="min-w-0 flex-1 text-left">
        <span className={cx("block truncate font-medium", tone === "danger" && "text-expense")}>{label}</span>
        {detail && <span className="block text-sm text-ink-3">{detail}</span>}
      </span>
      {trailing}
      {chevron && <ChevronRight className="size-4 shrink-0 text-ink-3" />}
    </>
  );
}

interface RowProps {
  icon?: LucideIcon;
  label: ReactNode;
  detail?: ReactNode;
  tone?: Tone;
  trailing?: ReactNode;
}

const rowCls = "flex min-h-14 w-full items-center gap-3 px-4 py-2.5 transition-colors active:bg-pale lg:hover:bg-pale/60";

export function SettingsLink({ href, ...p }: RowProps & { href: string }) {
  return (
    <HapticLink href={href} wrapperClassName="block" className={rowCls}>
      <RowBody {...p} chevron />
    </HapticLink>
  );
}

export function SettingsAction({ onClick, disabled, ...p }: RowProps & { onClick: () => void; disabled?: boolean }) {
  return (
    <HapticButton type="button" onClick={onClick} disabled={disabled} wrapperClassName="block" className={cx(rowCls, "disabled:opacity-40")}>
      <RowBody {...p} />
    </HapticButton>
  );
}

/** A row that just shows something (or holds its own control in `trailing`). */
export function SettingsRow(p: RowProps) {
  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-2.5">
      <RowBody {...p} />
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <HapticButton
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      wrapperClassName="shrink-0"
      className={cx("relative h-7 w-12 rounded-full transition-colors disabled:opacity-40", checked ? "bg-brand" : "bg-line")}
    >
      <span className={cx("absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow-soft transition-transform", checked && "translate-x-5")} />
    </HapticButton>
  );
}

/** A switch row: the whole row is the label, the switch is the control. */
export function SettingsSwitch({ checked, onChange, disabled, ...p }: Omit<RowProps, "trailing"> & { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return <SettingsRow {...p} trailing={<Switch checked={checked} onChange={onChange} disabled={disabled} label={typeof p.label === "string" ? p.label : "Toggle"} />} />;
}

/** Everything Settings search can find. `page` is where it lives; keywords are extra words people might type. */
export interface SettingsEntry {
  label: string;
  page: string;
  href: string;
  keywords: string;
  signedIn?: boolean;
}

export const SETTINGS_INDEX: SettingsEntry[] = [
  { label: "Theme", page: "General", href: "/settings/general", keywords: "appearance dark mode light system colour color" },
  { label: "Hide amounts", page: "General", href: "/settings/general", keywords: "privacy blur mask balances money hidden" },
  { label: "Hide voided transactions", page: "General", href: "/settings/general", keywords: "void voided cancelled deleted remove hide clutter" },
  { label: "Show archived items", page: "General", href: "/settings/general", keywords: "archive archived restore hidden old accounts people unarchive" },
  { label: "Payday", page: "Payday", href: "/settings/payday", keywords: "paydays pay schedule salary income weekend friday safe to spend budgeting" },
  { label: "Payment reminders", page: "Notifications", href: "/settings/notifications", keywords: "notifications alerts credit card due date remind" },
  { label: "Notifications", page: "Notifications", href: "/settings/notifications", keywords: "push alerts permission" },
  { label: "Automatic sync", page: "Sync", href: "/settings/sync", keywords: "cloud background auto" },
  { label: "Sync frequency", page: "Sync", href: "/settings/sync", keywords: "how often interval minutes cloud" },
  { label: "Sync & backup", page: "Sync & backup", href: "/sync", keywords: "export import backup restore cloud storage sync now" },
  { label: "Two-factor sign-in", page: "Security", href: "/settings/security", keywords: "2fa mfa authenticator code totp", signedIn: true },
  { label: "Change password", page: "Security", href: "/settings/security/password", keywords: "password security", signedIn: true },
  { label: "Quick add", page: "Quick add", href: "/settings/quick-add", keywords: "shortcuts siri action button token api widget iphone", signedIn: true },
  { label: "Profile", page: "Account", href: "/profile", keywords: "name photo birthday email avatar", signedIn: true },
  { label: "Sign out", page: "Settings", href: "/settings#danger", keywords: "log out logout", signedIn: true },
  { label: "Delete cloud data", page: "Settings", href: "/settings#danger", keywords: "remove erase reset cloud", signedIn: true },
  { label: "Delete account", page: "Delete account", href: "/settings/delete-account", keywords: "close remove erase account leave recover", signedIn: true },
  { label: "Erase this device", page: "Settings", href: "/settings#danger", keywords: "wipe reset delete local data", signedIn: false },
  { label: "Install Kaban", page: "Settings", href: "/settings#install", keywords: "home screen app pwa add" },
  { label: "About Kaban", page: "About", href: "/settings/about", keywords: "version info website terms privacy policy" },
];

export function searchSettings(query: string, signedIn: boolean): SettingsEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return SETTINGS_INDEX.filter((e) => e.signedIn === undefined || e.signedIn === signedIn).filter((e) => {
    const hay = `${e.label} ${e.page} ${e.keywords}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
