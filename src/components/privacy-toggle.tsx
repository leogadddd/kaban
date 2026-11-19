"use client";

import { Eye, EyeOff } from "lucide-react";
import { useEffect } from "react";
import { useMeta } from "@/lib/hooks";
import { setPrivacyOn } from "@/lib/privacy";
import { setMeta } from "@/lib/repo";
// Local helper (not ./ui) so ui.tsx can render this toggle without a circular import.
const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Privacy mode: stored on this device; while on, every amount renders as a fixed-length mask (lib/privacy). */
export function usePrivacy(): [boolean, () => void] {
  const on = useMeta<boolean>("privacy") === true;
  return [on, () => setMeta("privacy", !on)];
}

/** Mirrors the stored setting onto <html data-privacy>. Mount once (app shell). */
export function PrivacySync() {
  const [on] = usePrivacy();
  useEffect(() => {
    setPrivacyOn(on);
    const root = document.documentElement;
    if (on) root.dataset.privacy = "";
    else delete root.dataset.privacy;
  }, [on]);
  return null;
}

export function PrivacyToggle({ className, withLabel = false }: { className?: string; withLabel?: boolean }) {
  const [on, toggle] = usePrivacy();
  const Icon = on ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? "Show amounts" : "Hide amounts"}
      title={on ? "Show amounts" : "Hide amounts"}
      className={cx(
        "flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-full border text-xs font-medium transition active:scale-95",
        on ? "border-brand bg-brand text-white" : "border-line bg-white text-ink-2 hover:bg-pale",
        withLabel ? "px-3" : "w-10",
        className,
      )}
    >
      <Icon className="size-4" />
      {withLabel && (on ? "Amounts hidden" : "Hide amounts")}
    </button>
  );
}
