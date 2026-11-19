"use client";

// Undo toasts for reversible destructive actions (void, remove, archive). Call undoToast() right after
// the change lands; the toast counts down and the Undo button reverts it while the same ledger is open.
import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import { isActiveDatabase, useLedgerDatabase, visibleDatabase } from "@/lib/db";
import { useThemePref } from "@/lib/theme";
import { alertDialog } from "@/components/dialog";
import { HapticButton } from "@/components/haptic-button";

const UNDO_MS = 6000;
const RING = 2 * Math.PI * 9;

export function undoToast(title: string, undo: () => Promise<unknown>) {
  const db = visibleDatabase();
  toast.custom((id) => <UndoCard id={id} title={title} onUndo={async () => {
    toast.dismiss(id);
    if (!isActiveDatabase(db)) return; // the ledger switched accounts; don't touch the new one
    try {
      await undo();
    } catch (e) {
      void alertDialog({ title: "Couldn't undo that", body: (e as Error).message });
    }
  }} />, { duration: Infinity });
}

function UndoCard({ id, title, onUndo }: { id: string | number; title: string; onUndo: () => void }) {
  const [left, setLeft] = useState(UNDO_MS);
  useEffect(() => {
    const end = Date.now() + UNDO_MS;
    const tick = setInterval(() => {
      const ms = end - Date.now();
      if (ms <= 0) {
        clearInterval(tick);
        toast.dismiss(id);
      }
      setLeft(Math.max(0, ms));
    }, 100);
    return () => clearInterval(tick);
  }, [id]);
  const secs = Math.ceil(left / 1000);
  return (
    <div className="flex w-[min(calc(100vw-2rem),24rem)] items-center gap-3 rounded-2xl bg-night py-2.5 pr-2 pl-3 text-white shadow-soft dark:border dark:border-line">
      <span className="relative grid size-7 shrink-0 place-items-center" aria-hidden>
        <svg viewBox="0 0 22 22" className="absolute inset-0 -rotate-90">
          <circle cx="11" cy="11" r="9" fill="none" stroke="currentColor" strokeOpacity={0.2} strokeWidth={2} />
          <circle
            cx="11" cy="11" r="9" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"
            strokeDasharray={RING} strokeDashoffset={RING * (1 - left / UNDO_MS)}
            className="transition-[stroke-dashoffset] duration-100 ease-linear"
          />
        </svg>
        <span className="num text-[0.7rem] font-semibold">{secs}</span>
      </span>
      <p className="min-w-0 flex-1 truncate text-sm font-medium">{title}</p>
      <HapticButton
        type="button"
        onClick={onUndo}
        className="flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-mint active:bg-white/10"
      >
        <RotateCcw className="size-4" /> Undo
      </HapticButton>
    </div>
  );
}

/** Mounted once in the app shell. `aboveNav` lifts it clear of the phone bottom navigation. */
export function UndoToaster({ aboveNav }: { aboveNav: boolean }) {
  const pref = useThemePref();
  const db = useLedgerDatabase();
  useEffect(() => () => void toast.dismiss(), [db]); // switching ledgers drops pending undos
  return (
    <Toaster
      position="bottom-center"
      theme={pref}
      gap={8}
      offset={{ bottom: "1.5rem" }}
      mobileOffset={{ bottom: aboveNav ? "calc(6.5rem + var(--safe-bottom))" : "calc(5.5rem + var(--safe-bottom))" }}
      toastOptions={{ unstyled: true }}
    />
  );
}
