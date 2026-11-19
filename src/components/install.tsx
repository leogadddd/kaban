"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, Download, ExternalLink, Hash, Link2, MoreHorizontal, Plus, Share, Smartphone, SquarePlus, Zap } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
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

// ---------- Quick-add Shortcut builder ----------

const PRESETS = [
  { key: "expense", label: "Expense", type: "expense" },
  { key: "income", label: "Income", type: "income" },
  { key: "card_payment", label: "Card payment", type: "card_payment" },
] as const;

const useOrigin = () => useSyncExternalStore(() => () => {}, () => window.location.origin, () => "https://your-kaban-link");

/** Builds the deep link for an iPhone Shortcut and shows the Shortcuts actions it needs. */
export function ShortcutBuilder() {
  const origin = useOrigin();
  const [preset, setPreset] = useState<(typeof PRESETS)[number]["key"]>("expense");
  const [account, setAccount] = useState("");
  const [copied, setCopied] = useState(false);

  const params = new URLSearchParams({ type: PRESETS.find((p) => p.key === preset)!.type });
  if (account.trim()) params.set("account", account.trim());
  const base = `${origin}/add?${params.toString()}&amount=`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(base);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = base;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
      {/* Builder */}
      <div className="space-y-4 rounded-[2rem] border border-line bg-white p-5 shadow-soft sm:p-6">
        <div>
          <p className="mb-2 text-sm font-medium text-ink-2">What should the shortcut add?</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Transaction type">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                role="radio"
                aria-checked={preset === p.key}
                onClick={() => setPreset(p.key)}
                className={cx(
                  "min-h-10 rounded-full border px-4 text-sm font-medium transition",
                  preset === p.key ? "border-brand bg-brand text-white" : "border-line bg-white text-ink-2 hover:bg-pale",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink-2">Default account name (optional)</span>
          <input
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            placeholder={preset === "card_payment" ? "e.g. Savings" : "e.g. Family Card"}
            className="min-h-12 w-full rounded-2xl border border-line bg-bg px-4 text-[16px] outline-none focus:border-brand-2 focus:ring-4 focus:ring-brand-2/15"
          />
          <span className="mt-1 block text-xs text-ink-3">Matches the name you gave the account in Kaban, ignoring case.</span>
        </label>
        <div>
          <p className="mb-2 text-sm font-medium text-ink-2">Your link</p>
          <div className="flex items-stretch gap-2">
            <code className="num min-w-0 flex-1 truncate rounded-2xl bg-pale px-3 py-3.5 text-xs text-brand-deep" title={base}>
              {base}
            </code>
            <button onClick={copy} className="grid min-w-12 place-items-center rounded-2xl bg-brand px-3 text-white active:scale-95" aria-label="Copy link">
              <AnimatePresence mode="wait" initial={false}>
                {copied ? (
                  <motion.span key="ok" initial={{ scale: 0.5 }} animate={{ scale: 1 }} exit={{ scale: 0.5 }}>
                    <Check className="size-5" />
                  </motion.span>
                ) : (
                  <motion.span key="copy" initial={{ scale: 0.5 }} animate={{ scale: 1 }} exit={{ scale: 0.5 }}>
                    <Copy className="size-5" />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
          <p className={cx("mt-1 text-xs", copied ? "text-income" : "text-ink-3")} role="status">
            {copied ? "Copied. Paste it into the URL action." : "The Shortcut adds the amount you type to the end."}
          </p>
        </div>
        <a href={`${base}150`} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
          Try it with ₱150 <ExternalLink className="size-3.5" />
        </a>
      </div>

      {/* Shortcuts-app style recipe */}
      <ol className="space-y-2.5" aria-label="Shortcut actions">
        {[
          { icon: Plus, color: "#7B6CD9", t: "New Shortcut", d: "Open the Shortcuts app and tap +." },
          { icon: Hash, color: "#E07A3F", t: "Ask for Input", d: "Input type: Number · Prompt: “Amount”." },
          { icon: Link2, color: "#3B7DD8", t: "URL", d: "Paste your link, then tap the end and insert “Provided Input”." },
          { icon: ExternalLink, color: "#3B7DD8", t: "Open URLs", d: "Opens Kaban on the pre-filled form. Pick a category and save." },
          { icon: Zap, color: "#1E8A5A", t: "Make it one tap", d: "Share → Add to Home Screen, or Settings → Accessibility → Touch → Back Tap." },
        ].map(({ icon: Icon, color, t, d }, i) => (
          <motion.li
            key={t}
            initial={{ opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.07 }}
            className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-soft ring-1 ring-line"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: color }}>
              <Icon className="size-4.5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{t}</p>
              <p className="text-xs text-ink-2">{d}</p>
            </div>
          </motion.li>
        ))}
        <li className="rounded-2xl bg-gold/10 p-3.5 text-xs text-ink-2">
          <b className="text-ink">Heads-up:</b> iOS can open Shortcut links in Safari rather than the Home Screen app, and the two keep separate data. Test it once after installing. If it opens in Safari, either use Kaban in Safari, or add entries with the + button in the Home Screen app.
        </li>
      </ol>
    </div>
  );
}
