"use client";

import { motion } from "motion/react";
import { Check, Download, MoreHorizontal, Share, Smartphone, SquarePlus } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useMeta } from "@/lib/hooks";
import { cx, Sheet } from "./ui";

// ---------- Install prompt (Android / desktop Chromium) ----------

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
let sheetOpen = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

// Registered at module load so we don't miss an event fired before React mounts.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    emit();
  });
}

type Platform = "ios" | "android" | "desktop";
interface InstallState {
  platform: Platform;
  standalone: boolean;
  canPrompt: boolean;
  installed: boolean;
  sheetOpen: boolean;
}

const SERVER: InstallState = { platform: "desktop", standalone: false, canPrompt: false, installed: false, sheetOpen: false };
let cached: InstallState = SERVER;

function readState(): InstallState {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const next: InstallState = {
    platform: ios ? "ios" : /Android/i.test(ua) ? "android" : "desktop",
    standalone: window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true,
    canPrompt: !!deferred,
    installed,
    sheetOpen,
  };
  // keep referential stability for useSyncExternalStore
  if (JSON.stringify(next) !== JSON.stringify(cached)) cached = next;
  return cached;
}

export function useInstall() {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    readState,
    () => SERVER,
  );
}

/** True on phones/tablets that haven't installed Kaban yet: they should save it to the Home Screen first. */
export function shouldInstallFirst(s: InstallState) {
  return s.platform !== "desktop" && !s.standalone && !s.installed;
}

function setSheet(open: boolean) {
  sheetOpen = open;
  emit();
}

/** Start saving to the Home Screen: the browser's own prompt where offered, otherwise the how-to sheet. */
export async function requestInstall() {
  if (deferred) {
    const d = deferred;
    await d.prompt();
    const { outcome } = await d.userChoice;
    if (outcome === "accepted") installed = true;
    deferred = null;
    emit();
    if (outcome === "accepted") return;
  }
  setSheet(true);
}

/** The shared how-to sheet. Render once per page that offers installing. */
export function InstallSheet() {
  const s = useInstall();
  const mode = useMeta<string>("mode");
  const href = typeof mode === "string" ? "/home" : "/welcome";
  return (
    <Sheet open={s.sheetOpen} onClose={() => setSheet(false)} title={s.platform === "desktop" ? "Install Kaban" : "Add to Home Screen"}>
      <InstallSteps platform={s.platform} />
      {s.platform !== "desktop" && (
        <Link href={href} onClick={() => setSheet(false)} className="mt-1 flex min-h-11 items-center justify-center text-sm font-medium text-ink-3 hover:text-ink">
          Continue in browser instead
        </Link>
      )}
    </Sheet>
  );
}

/** "Add to Home Screen" button. */
export function InstallButton({ className, variant = "light" }: { className?: string; variant?: "light" | "dark" | "outline" }) {
  const s = useInstall();
  const done = s.standalone || s.installed;
  const onClick = () => requestInstall();

  return (
    <>
      <button
        onClick={onClick}
        disabled={done}
        className={cx(
          "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 font-medium transition active:scale-[0.98] disabled:opacity-70",
          variant === "light" && "bg-white text-brand hover:bg-pale",
          variant === "dark" && "bg-ink text-white hover:bg-brand-deep",
          variant === "outline" && "border border-line bg-white text-ink hover:bg-pale",
          className,
        )}
      >
        {done ? <Check className="size-4" /> : s.platform === "desktop" && !s.canPrompt ? <Download className="size-4" /> : <SquarePlus className="size-4" />}
        {done ? "Installed on this device" : s.platform === "desktop" ? "Install Kaban" : "Add to Home Screen"}
      </button>
    </>
  );
}

function InstallSteps({ platform }: { platform: Platform }) {
  const steps =
    platform === "ios"
      ? [
          { icon: Share, t: "Tap Share", d: "The square-and-arrow button in Safari's toolbar (bottom on iPhone, top on iPad)." },
          { icon: SquarePlus, t: "Choose “Add to Home Screen”", d: "Scroll down the share sheet if you don't see it. Make sure “Open as Web App” is on." },
          { icon: Check, t: "Tap Add", d: "Kaban appears on your Home Screen. Open it once while online and it then works offline." },
        ]
      : platform === "android"
        ? [
            { icon: MoreHorizontal, t: "Open the browser menu", d: "The ⋮ button in Chrome's top-right corner." },
            { icon: Smartphone, t: "Tap “Install app” or “Add to Home screen”", d: "Then confirm. Long-press the icon later for a quick “Add transaction” shortcut." },
          ]
        : [
            { icon: Download, t: "Use the install icon", d: "In Chrome or Edge, click the install icon at the right end of the address bar." },
            { icon: Smartphone, t: "On your phone", d: "Open this page in Safari (iPhone) or Chrome (Android) and come back to this button." },
          ];
  return (
    <ol className="space-y-3 pb-2">
      {steps.map(({ icon: Icon, t, d }, i) => (
        <motion.li
          key={t}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 * i }}
          className="flex items-start gap-3 rounded-2xl border border-line bg-white p-4"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-pale text-brand">
            <Icon className="size-5" />
          </span>
          <div>
            <p className="font-semibold">
              <span className="num mr-1.5 text-ink-3">{i + 1}.</span>
              {t}
            </p>
            <p className="text-sm text-ink-2">{d}</p>
          </div>
        </motion.li>
      ))}
      {platform === "ios" && (
        <p className="px-1 text-xs text-ink-3">
          Works in Safari, and in Chrome or Edge on iOS 16.4+. If you opened this link inside another app (Messenger, Gmail), tap “Open in browser” first.
        </p>
      )}
    </ol>
  );
}
