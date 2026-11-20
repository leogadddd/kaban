"use client";

import { Check, ChevronDown, Copy, KeyRound, Plus, Trash2, Zap } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { alertDialog, confirmDialog } from "@/components/dialog";
import { SettingsGroup, SettingsRow } from "@/components/settings-ui";
import { Button, Card, Field, inputCls, PageHeader, Sheet } from "@/components/ui";
import { createToken, listTokens, QUICK_ADD_SHORTCUT_URL, QUICK_ADD_URL, revokeToken, type QuickToken } from "@/lib/quick-add";
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
        {signedIn && (
          <Card>
            <p className="mb-3 font-semibold">Set it up on your iPhone</p>
            <ShortcutGuide />
          </Card>
        )}
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
  const [copied, setCopied] = useState<"yes" | "failed">();
  const textRef = useRef<HTMLSpanElement>(null);
  return (
    <div className="space-y-1">
      <p className="px-1 text-xs font-medium text-ink-3">{label}</p>
      <div className="flex items-center gap-2 rounded-2xl border border-line bg-field p-2 pl-3">
        <span ref={textRef} translate="no" className={`num min-w-0 flex-1 text-sm break-all select-all ${secret ? "text-ink" : "text-ink-2"}`}>{value}</span>
        <button
          type="button"
          aria-label={`Copy ${label.toLowerCase()}`}
          onClick={async () => {
            try {
              if (!navigator.clipboard) throw new Error("no clipboard");
              await navigator.clipboard.writeText(value);
              setCopied("yes");
            } catch {
              // Couldn't copy: select the text so a long-press → Copy takes all of it.
              const el = textRef.current;
              if (el) window.getSelection()?.selectAllChildren(el);
              setCopied("failed");
            }
            setTimeout(() => setCopied(undefined), 2500);
          }}
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-pale text-brand"
        >
          {copied === "yes" ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      </div>
      {copied === "yes" && <p className="px-1 text-xs text-brand">Copied. Paste it as is, without changing any characters.</p>}
      {copied === "failed" && <p className="px-1 text-xs text-expense">Couldn&apos;t copy automatically. It&apos;s selected: long-press it and tap Copy.</p>}
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
          <ShortcutGuide hasToken />
          <Button wrapperClassName="w-full" className="w-full" onClick={onClose}>Done</Button>
        </div>
      )}
    </Sheet>
  );
}

/** How to set up the iPhone shortcut: the ready-made one (when published) and the build-it-yourself steps. */
function ShortcutGuide({ hasToken }: { hasToken?: boolean }) {
  const tokenStep = hasToken ? <>Copy your token above.</> : <>Create a token below and copy it. Kaban shows it only once.</>;
  return (
    <div className="space-y-4">
      {QUICK_ADD_SHORTCUT_URL && (
        <div className="space-y-3 rounded-2xl bg-pale/70 p-4">
          <p className="font-semibold">Add the ready-made shortcut</p>
          <ol className="space-y-3">
            <Step n={1}>{tokenStep}</Step>
            <Step n={2}>On your iPhone, tap <B>Add to Shortcuts</B> below. The Shortcuts app opens.</Step>
            <Step n={3}>Tap <B>Set Up Shortcut</B>. When it asks for your Kaban token, paste it, then tap <B>Add Shortcut</B>.</Step>
            <Step n={4}>Run <B>Add to Kaban</B>: type the amount, then what it was for. You&apos;ll see “Sent to Kaban”.</Step>
            <Step n={5}>Open Kaban and tap the <B>bell</B> on Home to approve the entry.</Step>
          </ol>
          <a
            href={QUICK_ADD_SHORTCUT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand font-medium text-on-brand shadow-soft active:scale-[0.98]"
          >
            <Zap className="size-4" /> Add to Shortcuts
          </a>
          <p className="text-xs text-ink-3">Works on iPhone, iPad and Mac. The shortcut holds only your token and sends entries to Kaban, nothing else.</p>
        </div>
      )}

      <details className="group space-y-3" open={!QUICK_ADD_SHORTCUT_URL}>
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between font-semibold [&::-webkit-details-marker]:hidden">
          {QUICK_ADD_SHORTCUT_URL ? "Or build it yourself" : "Build the shortcut (about 3 minutes)"}
          <ChevronDown className="size-4 text-ink-3 transition group-open:rotate-180" />
        </summary>
        <CopyRow label="Address" value={QUICK_ADD_URL} />
        <ol className="space-y-3">
          <Step n={1}>{tokenStep}</Step>
          <Step n={2}>Open the <B>Shortcuts</B> app, tap <B>+</B>, then tap the name at the top and rename it <B>Add to Kaban</B>.</Step>
          <Step n={3}>Tap <B>Add Action</B>, search <B>Ask for Input</B> and add it. Tap <B>Text</B> and change it to <B>Number</B>. Tap <B>Prompt</B> and type <B>Amount</B>.</Step>
          <Step n={4}>Add a second <B>Ask for Input</B>. Leave it as <B>Text</B> and set the prompt to <B>What for?</B></Step>
          <Step n={5}>Add <B>Get Contents of URL</B>. Tap <B>URL</B> and paste the address above. Then tap the <B>›</B> arrow to show more options.</Step>
          <Step n={6}>Set <B>Method</B> to <B>POST</B>. Under <B>Headers</B>, tap <B>Add new header</B>: key <B>Authorization</B>, value <B>Bearer</B>, a space, then paste your token.</Step>
          <Step n={7}>
            Set <B>Request Body</B> to <B>JSON</B>. Tap <B>Add new field</B> → <B>Number</B>: key <B>amount</B>, and for the value tap <B>Select Variable</B> and pick the first
            <B> Provided Input</B>. Add another field → <B>Text</B>: key <B>description</B>, value the second <B>Provided Input</B>.
          </Step>
          <Step n={8}>Add <B>Get Dictionary Value</B>. Set it to get the value for key <B>message</B> in <B>Contents of URL</B>.</Step>
          <Step n={9}>Add <B>Show Notification</B> and set its text to <B>Dictionary Value</B>. Tap <B>Done</B>.</Step>
          <Step n={10}>Run it once to test: you should see “Sent to Kaban”. Approve the entry from the <B>bell</B> on Kaban&apos;s Home.</Step>
        </ol>
        <div className="space-y-1.5 rounded-2xl bg-bg p-3 text-xs text-ink-3">
          <p><span className="font-medium text-ink-2">Quicker access:</span> long-press the shortcut → <B>Share</B> → <B>Add to Home Screen</B>, or on iPhone 15 Pro and later go to Settings → Action Button → Shortcut → Add to Kaban.</p>
          <p>
            <span className="font-medium text-ink-2">Optional fields</span> you can add to the JSON: <span className="num">type</span> (expense or income), <span className="num">category</span>,{" "}
            <span className="num">account</span> (an account&apos;s name), <span className="num">date</span> (YYYY-MM-DD). You can change any of them when you approve.
          </p>
          <p>
            <span className="font-medium text-ink-2">“Kaban didn&apos;t find a token”:</span> the Authorization header is missing or empty. Its value should be Bearer, a
            space, then your token.
          </p>
          <p>
            <span className="font-medium text-ink-2">“The token in your shortcut is incomplete”:</span> the Text holds a placeholder or only part of the token.
            Paste the whole token: kbn_ followed by 64 letters and numbers.
          </p>
          <p>
            <span className="font-medium text-ink-2">“Kaban doesn&apos;t recognise this token”:</span> it was revoked, copied only in part, or made on a different copy of
            Kaban (for example a test site instead of the live one). Make a new token here and paste it again.
          </p>
        </div>
      </details>
    </div>
  );
}
