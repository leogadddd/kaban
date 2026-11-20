"use client";

import { Ban, EyeOff, Moon, Sun, SunMoon } from "lucide-react";
import { HapticButton } from "@/components/haptic-button";
import { usePrivacy } from "@/components/privacy-toggle";
import { SettingsGroup, SettingsSwitch } from "@/components/settings-ui";
import { cx, PageHeader } from "@/components/ui";
import { useHideVoided } from "@/lib/display-prefs";
import { setThemePref, useThemePref, type ThemePref } from "@/lib/theme";

export default function GeneralSettingsPage() {
  const [hidden, toggleHidden] = usePrivacy();
  const [hideVoided, setHideVoided] = useHideVoided();
  return (
    <>
      <PageHeader title="General" back="/settings" privacy={false} />
      <div className="space-y-6 px-4 pb-6">
        <SettingsGroup title="Theme" footer="System follows your device. Saved on this device only.">
          <div className="p-3">
            <ThemePicker />
          </div>
        </SettingsGroup>

        <SettingsGroup title="Privacy" footer="Masks every balance and amount, e.g. when someone's looking at your screen.">
          <SettingsSwitch icon={EyeOff} label="Hide amounts" checked={hidden} onChange={() => toggleHidden()} />
        </SettingsGroup>

        <SettingsGroup title="Transactions" footer="Voided transactions stay saved and never count toward balances. Find them in Activity with the “Show voided” filter.">
          <SettingsSwitch icon={Ban} label="Hide voided transactions" detail="On Home, account and card pages" checked={hideVoided} onChange={setHideVoided} />
        </SettingsGroup>
      </div>
    </>
  );
}

const THEMES: { value: ThemePref; label: string; icon: typeof Sun; preview: string }[] = [
  { value: "light", label: "Light", icon: Sun, preview: "bg-[#F7FAF7] [--pv-card:#FFFFFF] [--pv-accent:#176B4D]" },
  { value: "dark", label: "Dark", icon: Moon, preview: "bg-[#141816] [--pv-card:#202622] [--pv-accent:#4CD38F]" },
  { value: "system", label: "System", icon: SunMoon, preview: "bg-[linear-gradient(90deg,#F7FAF7_50%,#141816_50%)] [--pv-card:linear-gradient(90deg,#FFFFFF_50%,#202622_50%)] [--pv-accent:linear-gradient(90deg,#176B4D_50%,#4CD38F_50%)]" },
];

/** Light / Dark / System. Device-only: stored locally, applied before first paint by the layout script. */
function ThemePicker() {
  const pref = useThemePref();
  return (
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
              "flex w-full flex-col items-center gap-2 rounded-2xl border-[1.5px] p-2 text-sm font-medium transition active:scale-[0.98]",
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
  );
}
