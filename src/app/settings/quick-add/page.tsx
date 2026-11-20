"use client";

import { Check, Copy, KeyRound, Plus, Trash2, Zap } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { alertDialog, confirmDialog } from "@/components/dialog";
import { SettingsGroup, SettingsRow } from "@/components/settings-ui";
import { Button, Card, Field, inputCls, PageHeader, Sheet } from "@/components/ui";
import { createToken, listTokens, QUICK_ADD_URL, revokeToken, type QuickToken } from "@/lib/quick-add";
import { useSyncState } from "@/lib/sync";

export default function QuickAddPage() {
  const sync = useSyncState();
  const signedIn = !!sync.userId && sync.phase !== "mfa";

  return (
    <>
      <PageHeader title="Quick add" back="/settings" privacy={false} />
      <div className="space-y-6 px-4 pb-6">
        <Card className="space-y-2">
          <p className="flex items-center gap-2 font-semibold"><Zap className="size-4 text-brand" /> Add from Shortcuts</p>
          <p className="text-sm text-ink-3">
            Log an expense from the iPhone Shortcuts app, a home-screen shortcut or the Action Button, without opening Kaban. Every entry
            waits for your approval the next time you open the app. Nothing is saved until you approve it.
          </p>
        </Card>
        {signedIn ? <Tokens /> : <p className="rounded-2xl bg-pale p-3 text-sm text-ink-2">Sign in to use quick add. It needs a free account so Shortcuts can reach you.</p>}
      </div>
    </>
  );
}

function Tokens() {
  const [tokens, setTokens] = useState<QuickToken[] | null>(null);
  const [error, setError] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<string>();

  const refresh = () =>
    listTokens()
      .then((t) => {
        setTokens(t);
        setError(undefined);
      })
      .catch((e: Error) => setError(e.message));
  useEffect(() => {
    void refresh();
  }, []);

  async function revoke(t: QuickToken) {
    const ok = await confirmDialog({
      title: `Revoke “${t.name}”?`,
      body: "Shortcuts using this token stop working right away. Entries it already sent stay in your approval list.",
      confirmLabel: "Revoke",
      danger: true,
    });
    if (!ok) return;
    try {
      await revokeToken(t.id);
      await refresh();
    } catch (e) {
      await alertDialog({ title: "Couldn't revoke the token", body: (e as Error).message, danger: true });
    }
  }

  return (
    <>
      <SettingsGroup
        title="Tokens"
        footer="A token can only send entries for you to approve. It can't see your balances or change anything. Anyone with it can send entries, so don't share your shortcut."
      >
        {tokens === null && !error && <SettingsRow label="Loading…" />}
        {error && <SettingsRow label="Couldn't load tokens" detail={error} tone="danger" />}
        {tokens?.length === 0 && <SettingsRow icon={KeyRound} tone="muted" label="No tokens yet" detail="Create one to set up a shortcut" />}
        {tokens?.map((t) => (
          <SettingsRow
            key={t.id}
            icon={KeyRound}
            label={t.name}
            detail={`••••${t.hint} · ${t.last_used_at ? `Last used ${new Date(t.last_used_at).toLocaleDateString()}` : "Never used"}`}
            trailing={
              <button type="button" onClick={() => void revoke(t)} aria-label={`Revoke ${t.name}`} className="grid size-10 place-items-center rounded-full text-expense active:bg-expense/10">
                <Trash2 className="size-4" />
              </button>
            }
          />
        ))}
      </SettingsGroup>

      <Button variant="secondary" wrapperClassName="w-full" className="w-full" disabled={!tokens || tokens.length >= 5} onClick={() => setCreating(true)}>
        <Plus className="size-4" /> Create token
      </Button>
      {tokens && tokens.length >= 5 && <p className="-mt-4 px-1 text-xs text-ink-3">You can have up to 5 tokens. Revoke one to make another.</p>}

      <CreateSheet
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(token) => {
          setCreating(false);
          setCreated(token);
          void refresh();
        }}
      />
      <TokenSheet token={created} onClose={() => setCreated(undefined)} />
    </>
  );
}

function CreateSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (token: string) => void }) {
  const [name, setName] = useState("iPhone Shortcut");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <Sheet open={open} onClose={onClose} title="New token">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(undefined);
          try {
            onCreated((await createToken(name)).token);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Name" hint="Shown on entries it sends, so you know where they came from." error={error}>
          {(id) => <input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className={inputCls} autoComplete="off" />}
        </Field>
        <Button type="submit" wrapperClassName="w-full" className="w-full" disabled={busy || !name.trim()}>Create token</Button>
      </form>
    </Sheet>
  );
}

function CopyRow({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <p className="px-1 text-xs font-medium text-ink-3">{label}</p>
      <div className="flex items-center gap-2 rounded-2xl border border-line bg-field p-2 pl-3">
        <span className={`num min-w-0 flex-1 text-sm break-all select-all ${secret ? "text-ink" : "text-ink-2"}`}>{value}</span>
        <button
          type="button"
          aria-label={`Copy ${label.toLowerCase()}`}
          onClick={async () => {
            await navigator.clipboard?.writeText(value).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-pale text-brand"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-pale text-xs font-semibold text-brand">{n}</span>
      <span className="min-w-0 flex-1 text-sm text-ink-2">{children}</span>
    </li>
  );
}

const B = ({ children }: { children: ReactNode }) => <span className="font-medium text-ink">{children}</span>;

function TokenSheet({ token, onClose }: { token?: string; onClose: () => void }) {
  return (
    <Sheet open={!!token} onClose={onClose} title="Your token">
      {token && (
        <div className="space-y-4">
          <p className="rounded-2xl bg-gold/15 p-3 text-sm text-ink-2">Copy it now. Kaban only shows it once. If you lose it, revoke it and make a new one.</p>
          <CopyRow label="Token" value={token} secret />
          <CopyRow label="Address" value={QUICK_ADD_URL} />

          <div className="space-y-3">
            <p className="font-semibold">Set up the shortcut</p>
            <ol className="space-y-3">
              <Step n={1}>Open the <B>Shortcuts</B> app and tap <B>+</B> to make a new shortcut.</Step>
              <Step n={2}>Add <B>Ask for Input</B>, set it to <B>Number</B>, prompt “Amount”.</Step>
              <Step n={3}>Add another <B>Ask for Input</B> (Text), prompt “What for?”.</Step>
              <Step n={4}>
                Add <B>Get Contents of URL</B> with the address above. Tap <B>Show More</B>: Method <B>POST</B>, add header <B>Authorization</B> ={" "}
                <B>Bearer</B> followed by a space and your token. Request Body <B>JSON</B> with <B>amount</B> = the first input and <B>description</B> = the second.
              </Step>
              <Step n={5}>Add <B>Get Dictionary Value</B> for key <B>message</B>, then <B>Show Notification</B> with it.</Step>
              <Step n={6}>Tap the shortcut’s name → <B>Add to Home Screen</B>, or set it on the Action Button.</Step>
            </ol>
            <p className="text-xs text-ink-3">
              Optional JSON fields: <span className="num">type</span> (expense or income), <span className="num">category</span>, <span className="num">account</span> (the account’s name), <span className="num">date</span> (YYYY-MM-DD). You can change any of them when you approve.
            </p>
          </div>
          <Button wrapperClassName="w-full" className="w-full" onClick={onClose}>Done</Button>
        </div>
      )}
    </Sheet>
  );
}
