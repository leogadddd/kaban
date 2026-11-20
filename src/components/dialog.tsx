"use client";

// In-app replacements for window.confirm / window.alert. Call confirmDialog() / alertDialog() from any
// event handler and await the answer; <DialogHost /> (mounted once in the app shell) renders it as a
// Sheet, so it looks like the rest of Kaban: bottom sheet on phones, centered card on desktop.
import { AlertTriangle, Info } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useLedgerDatabase, visibleDatabase, type KabanDB } from "@/lib/db";
import { Button, cx, inputCls, Sheet } from "@/components/ui";

interface DialogOptions {
  title: string;
  body?: ReactNode;
  /** Label of the main button. */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red main button and warning icon, for destructive actions. */
  danger?: boolean;
  /** For irreversible actions: the main button unlocks only after this word is typed. */
  typeToConfirm?: string;
}

interface Pending extends DialogOptions {
  id: number;
  db: KabanDB | null;
  kind: "confirm" | "alert";
  resolve: (ok: boolean) => void;
}

let current: Pending | null = null;
let seq = 0;
let open = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function show(p: Omit<Pending, "id" | "db">) {
  current?.resolve(false); // a new dialog replaces (and cancels) one still open
  current = { ...p, id: ++seq, db: visibleDatabase() };
  open = true;
  emit();
}

function settle(ok: boolean) {
  if (!current || !open) return;
  current.resolve(ok && current.db === visibleDatabase());
  open = false; // keep `current` so the content stays put during the exit animation
  emit();
}

/** Ask a yes/no question. Resolves true only if the user picks the main button. */
export function confirmDialog(opts: DialogOptions): Promise<boolean> {
  return new Promise((resolve) => show({ ...opts, kind: "confirm", resolve }));
}

export function confirmSignOut(): Promise<boolean> {
  return confirmDialog({
    title: "Sign out of Kaban?",
    body: "Your account's records and pending changes stay in this browser and are available in Kaban when you sign in again.",
    confirmLabel: "Sign out",
  });
}

/** Show a message with a single OK button. */
export function alertDialog(opts: Omit<DialogOptions, "cancelLabel" | "typeToConfirm">): Promise<void> {
  return new Promise((resolve) => show({ ...opts, kind: "alert", resolve: () => resolve() }));
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function DialogHost() {
  const db = useLedgerDatabase();
  useEffect(() => () => settle(false), [db]);
  const isOpen = useSyncExternalStore(subscribe, () => open, () => false);
  const d = useSyncExternalStore(subscribe, () => current, () => null);
  return (
    <Sheet open={isOpen && d?.db === db} onClose={() => settle(false)}>
      {/* Keyed so the typed confirmation word resets for every new dialog. */}
      {d?.db === db && <DialogBody key={d.id} d={d} />}
    </Sheet>
  );
}

function DialogBody({ d }: { d: Pending }) {
  const [typed, setTyped] = useState("");
  const titleRef = useRef<HTMLHeadingElement>(null);
  const locked = !!d.typeToConfirm && typed.trim().toUpperCase() !== d.typeToConfirm.toUpperCase();
  const Icon = d.danger ? AlertTriangle : Info;

  useEffect(() => {
    if (!d.typeToConfirm) titleRef.current?.focus({ preventScroll: true });
  }, [d.typeToConfirm]);

  return (
    <form
      className="space-y-4 pt-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (!locked) settle(true);
      }}
    >
      <div className="flex gap-3">
        <span className={cx("grid size-11 shrink-0 place-items-center rounded-2xl", d.danger ? "bg-expense/10 text-expense" : "bg-pale text-brand")}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 pt-0.5">
          <h2 ref={titleRef} tabIndex={-1} className="text-lg leading-snug font-semibold focus:outline-none!">{d.title}</h2>
          {d.body && <div className="mt-1 text-sm text-ink-2">{d.body}</div>}
        </div>
      </div>
      {d.typeToConfirm && (
        <label className="block space-y-1.5">
          <span className="block px-1 text-sm text-ink-2">
            Type <b className="num text-ink">{d.typeToConfirm}</b> to confirm
          </span>
          <input
            className={inputCls}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
        </label>
      )}
      {d.kind === "alert" ? (
        <Button type="submit" wrapperClassName="w-full">{d.confirmLabel ?? "OK"}</Button>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="secondary" onClick={() => settle(false)}>{d.cancelLabel ?? "Cancel"}</Button>
          <Button type="submit" variant={d.danger ? "destructive" : "primary"} disabled={locked}>
            {d.confirmLabel ?? "OK"}
          </Button>
        </div>
      )}
    </form>
  );
}
