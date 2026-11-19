"use client";

// In-app replacements for window.confirm / window.alert. Call confirmDialog() / alertDialog() from any
// event handler and await the answer; <DialogHost /> (mounted once in the app shell) renders it as a
// Sheet, so it looks like the rest of Kaban: bottom sheet on phones, centered card on desktop.
import { AlertTriangle, Info } from "lucide-react";
import { useState, useSyncExternalStore, type ReactNode } from "react";
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
  kind: "confirm" | "alert";
  resolve: (ok: boolean) => void;
}

let current: Pending | null = null;
let seq = 0;
let open = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function show(p: Omit<Pending, "id">) {
  current?.resolve(false); // a new dialog replaces (and cancels) one still open
  current = { ...p, id: ++seq };
  open = true;
  emit();
}

function settle(ok: boolean) {
  if (!current || !open) return;
  current.resolve(ok);
  open = false; // keep `current` so the content stays put during the exit animation
  emit();
}

/** Ask a yes/no question. Resolves true only if the user picks the main button. */
export function confirmDialog(opts: DialogOptions): Promise<boolean> {
  return new Promise((resolve) => show({ ...opts, kind: "confirm", resolve }));
}

/** "Sign out?" with a count of changes that would be lost. Resolves true when the user confirms. */
export async function confirmSignOut(unsynced: number): Promise<boolean> {
  return confirmDialog({
    title: "Sign out of Kaban?",
    body: (
      <>
        <p>Kaban data will be erased from this device. Your cloud copy stays, and comes back when you sign in again.</p>
        {unsynced > 0 && (
          <p className="mt-2 font-medium text-expense">
            {unsynced} change{unsynced === 1 ? " hasn't" : "s haven't"} reached the cloud yet and will be lost.
          </p>
        )}
      </>
    ),
    confirmLabel: "Sign out",
    danger: unsynced > 0,
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
  const isOpen = useSyncExternalStore(subscribe, () => open, () => false);
  const d = useSyncExternalStore(subscribe, () => current, () => null);
  return (
    <Sheet open={isOpen} onClose={() => settle(false)}>
      {/* Keyed so the typed confirmation word resets for every new dialog. */}
      {d && <DialogBody key={d.id} d={d} />}
    </Sheet>
  );
}

function DialogBody({ d }: { d: Pending }) {
  const [typed, setTyped] = useState("");
  const locked = !!d.typeToConfirm && typed.trim().toUpperCase() !== d.typeToConfirm.toUpperCase();
  const Icon = d.danger ? AlertTriangle : Info;
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
          <h2 className="text-lg leading-snug font-semibold">{d.title}</h2>
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
        <Button type="submit" className="w-full" autoFocus>{d.confirmLabel ?? "OK"}</Button>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="secondary" onClick={() => settle(false)}>{d.cancelLabel ?? "Cancel"}</Button>
          <Button type="submit" variant={d.danger ? "destructive" : "primary"} disabled={locked} autoFocus={!d.typeToConfirm}>
            {d.confirmLabel ?? "OK"}
          </Button>
        </div>
      )}
    </form>
  );
}
