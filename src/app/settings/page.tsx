"use client";

import { HapticButton, HapticLink } from "@/components/haptic-button";
import { alertDialog, confirmDialog, confirmSignOut } from "@/components/dialog";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cloud, Info, LogOut, Moon, Palette, Smartphone, SunMoon, Sun, Trash2, UserRound } from "lucide-react";
import { InstallSheet, requestInstall, useInstall } from "@/components/install";
import { TwoFactorCard } from "@/components/two-factor";
import { Button, Card, cx, PageHeader, SectionTitle } from "@/components/ui";
import { isActiveDatabase, useLedgerDatabase } from "@/lib/db";
import { LogoMark } from "@/lib/logo";
import { wipeAll } from "@/lib/repo";
import { deleteCloudData, friendlyAuthError, signOut, useSyncState } from "@/lib/sync";
import { setThemePref, useThemePref, type ThemePref } from "@/lib/theme";

const VERSION = "0.1";

export default function SettingsPage() {
  const sync = useSyncState();
  const signedIn = !!sync.userId && sync.phase !== "mfa";
  const install = useInstall();
  const installed = install.standalone || install.installed;

  return (
    <>
      <PageHeader title="Settings" back="/home" privacy={false} />
      <div className="space-y-5 px-4 pb-4">
        <Appearance />
        {sync.configured && <AccountSection signedIn={signedIn} email={sync.email} />}

        {!installed && (
          <Card className="space-y-3">
            <SectionTitle><span className="flex items-center gap-1.5"><Smartphone className="size-4 text-brand" /> Install Kaban</span></SectionTitle>
            <p className="text-sm text-ink-3">
              {install.platform === "ios"
                ? "Add Kaban to your Home Screen from Safari. It opens full screen and works offline."
                : install.platform === "android"
                  ? "Install Kaban from Chrome. It opens like an app and works offline."
                  : "Install Kaban from Chrome or Edge, or add it to your phone's Home Screen."}
            </p>
            <Button variant="secondary" wrapperClassName="w-full" onClick={() => void requestInstall()}>
              {install.platform === "desktop" ? "Install Kaban" : "Add to Home Screen"}
            </Button>
            <InstallSheet />
          </Card>
        )}

        <About installed={installed} />
        {!signedIn && <EraseDevice />}
      </div>
    </>
  );
}

function AccountSection({ signedIn, email }: { signedIn: boolean; email?: string }) {
  const router = useRouter();
  const db = useLedgerDatabase();

  if (!signedIn)
    return (
      <Card className="space-y-3">
        <SectionTitle><span className="flex items-center gap-1.5"><UserRound className="size-4 text-brand" /> Account</span></SectionTitle>
        <p className="text-sm text-ink-3">Sign in to back up your records and use Kaban on more than one device. Everything still saves here first.</p>
        <div className="grid grid-cols-2 gap-3">
          <HapticLink href="/signup" wrapperClassName="grid" className="flex min-h-12 items-center justify-center rounded-2xl bg-brand font-medium text-on-brand shadow-soft">Create account</HapticLink>
          <Link href="/login" className="flex min-h-12 items-center justify-center rounded-2xl bg-pale font-medium text-brand">Sign in</Link>
        </div>
      </Card>
    );

  async function doSignOut() {
    if (!(await confirmSignOut()) || !isActiveDatabase(db)) return;
    await signOut();
    router.replace("/welcome");
  }

  async function doDeleteCloud() {
    const ok = await confirmDialog({
      title: "Delete your cloud data?",
      body: "Delete your account’s cloud records and reset sync on all your devices. This browser keeps a recovery copy you can export from Sync & backup.",
      confirmLabel: "Delete cloud data",
      danger: true,
      typeToConfirm: "DELETE",
    });
    if (!ok || !isActiveDatabase(db)) return;
    try {
      await deleteCloudData();
    } catch (e) {
      await alertDialog({ title: "Couldn't delete cloud data", body: friendlyAuthError(e), danger: true });
    }
  }

  return (
    <section className="space-y-3">
      <SectionTitle>Account</SectionTitle>
      <Card className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-pale text-brand"><UserRound className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{email}</p>
          <Link href="/sync" className="flex items-center gap-1 text-sm text-brand"><Cloud className="size-3.5" /> Sync &amp; backup</Link>
        </div>
      </Card>
      <TwoFactorCard />
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={doSignOut}><LogOut className="size-4" /> Sign out</Button>
        <Button variant="danger" onClick={doDeleteCloud}><Trash2 className="size-4" /> Delete cloud data</Button>
      </div>
    </section>
  );
}

function About({ installed }: { installed: boolean }) {
  return (
    <Card className="space-y-4">
      <SectionTitle><span className="flex items-center gap-1.5"><Info className="size-4 text-brand" /> About</span></SectionTitle>
      <div className="flex items-center gap-3">
        <LogoMark size={44} />
        <div>
          <p className="font-semibold">Kaban</p>
          <p className="text-sm text-ink-3">Version {VERSION} · Philippine peso · {installed ? "Installed app" : "Running in browser"}</p>
        </div>
      </div>
      <p className="text-sm text-ink-2">
        Kaban is a personal finance tracker for your cash, bank and e-wallet accounts, credit cards, instalments and the money people owe you. It
        works offline: records are saved on this device first, and cloud sync is optional.
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-ink-3">Storage</dt>
        <dd className="text-right">On this device (IndexedDB)</dd>
        <dt className="text-ink-3">Cloud</dt>
        <dd className="text-right">Optional, with two-factor sign-in</dd>
        <dt className="text-ink-3">Price</dt>
        <dd className="text-right">Free</dd>
      </dl>
      <Link href="/" className="block text-sm font-medium text-brand">Visit the Kaban website →</Link>
    </Card>
  );
}

function EraseDevice() {
  const router = useRouter();
  const db = useLedgerDatabase();
  return (
    <Card className="space-y-2">
      <SectionTitle>Danger zone</SectionTitle>
      <p className="text-sm text-ink-3">Erase every account, transaction and person on this device. Export a backup first.</p>
      <Button
        variant="danger"
        wrapperClassName="w-full"
        onClick={async () => {
          const ok = await confirmDialog({
            title: "Erase everything on this device?",
            body: "Every account, transaction and person is deleted from this device. This can't be undone — export a backup first if you might need it.",
            confirmLabel: "Erase everything",
            danger: true,
            typeToConfirm: "ERASE",
          });
          if (!ok || !db || !isActiveDatabase(db)) return;
          await wipeAll(db);
          router.replace("/welcome");
        }}
      >
        <Trash2 className="size-4" /> Erase all data
      </Button>
    </Card>
  );
}

const THEMES: { value: ThemePref; label: string; icon: typeof Sun; preview: string }[] = [
  { value: "light", label: "Light", icon: Sun, preview: "bg-[#F7FAF7] [--pv-card:#FFFFFF] [--pv-accent:#176B4D]" },
  { value: "dark", label: "Dark", icon: Moon, preview: "bg-[#141816] [--pv-card:#242A26] [--pv-accent:#4CD38F]" },
  { value: "system", label: "System", icon: SunMoon, preview: "bg-[linear-gradient(90deg,#F7FAF7_50%,#141816_50%)] [--pv-card:linear-gradient(90deg,#FFFFFF_50%,#242A26_50%)] [--pv-accent:linear-gradient(90deg,#176B4D_50%,#4CD38F_50%)]" },
];

/** Light / Dark / System picker. Device-only: stored locally, applied before first paint by the layout script. */
function Appearance() {
  const pref = useThemePref();
  return (
    <Card className="space-y-3">
      <SectionTitle><span className="flex items-center gap-1.5"><Palette className="size-4 text-brand" /> Appearance</span></SectionTitle>
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
        {THEMES.map(({ value, label, icon: Icon, preview }) => {
          const active = pref === value;
          return (
            <HapticButton
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setThemePref(value)}
              className={cx(
                "flex flex-col items-center gap-2 rounded-2xl border-[1.5px] p-2 text-sm font-medium transition active:scale-[0.98]",
                active ? "border-brand bg-pale text-ink" : "border-line bg-field text-ink-2",
              )}
            >
              <span className={cx("relative h-14 w-full overflow-hidden rounded-xl ring-1 ring-black/5", preview)} aria-hidden="true">
                <span className="absolute inset-x-2 top-2 h-2.5 rounded [background:var(--pv-card)]" />
                <span className="absolute top-6 right-6 left-2 h-2.5 rounded [background:var(--pv-card)]" />
                <span className={cx("absolute bottom-2 h-2 rounded [background:var(--pv-accent)]", value === "system" ? "left-[calc(50%-1.1rem)] w-9" : "left-2 w-5")} />
              </span>
              <span className="flex items-center gap-1"><Icon className={cx("size-3.5", active && "text-brand")} /> {label}</span>
            </HapticButton>
          );
        })}
      </div>
      <p className="text-xs text-ink-3">System follows your phone&apos;s light or dark setting. Saved on this device only.</p>
    </Card>
  );
}
