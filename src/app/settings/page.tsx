"use client";

import { useRouter } from "next/navigation";
import { Copy, Smartphone, Trash2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { Button, Card, cx, Field, inputCls, PageHeader, SectionTitle } from "@/components/ui";
import { useLedger } from "@/lib/hooks";
import { LogoMark } from "@/lib/logo";
import { wipeAll } from "@/lib/repo";

export default function SettingsPage() {
  const router = useRouter();
  const ledger = useLedger();
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");
  const standalone = useSyncExternalStore(noop, isStandalone, () => false);
  const [acct, setAcct] = useState("");
  const [copied, setCopied] = useState(false);

  const account = ledger.accountById.get(acct);
  const link = `${origin}/add?type=expense${account ? `&account=${encodeURIComponent(account.name)}` : ""}&amount=`;

  return (
    <>
      <PageHeader title="Settings" back="/" />
      <div className="space-y-5 px-4 pb-4">
        <Card className="flex items-center gap-3">
          <LogoMark size={44} />
          <div>
            <p className="font-semibold">Kaban</p>
            <p className="text-sm text-ink-3">v0.1 · PHP · {standalone ? "Installed on Home Screen" : "Running in browser"}</p>
          </div>
        </Card>

        {!standalone && (
          <Card className="space-y-2">
            <SectionTitle>Install on iPhone</SectionTitle>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-2">
              <li>Open this page in Safari.</li>
              <li>Tap the Share button, then <b>Add to Home Screen</b>.</li>
              <li>Open Kaban from the Home Screen once while online — after that it works offline.</li>
            </ol>
          </Card>
        )}

        <Card className="space-y-3">
          <SectionTitle><span className="flex items-center gap-1.5"><Smartphone className="size-4 text-brand" /> iPhone quick-add Shortcut</span></SectionTitle>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-2">
            <li>In the Shortcuts app, create a shortcut with <b>Ask for Input</b> (Number, “Amount”).</li>
            <li>Add <b>Open URLs</b> with the link below, inserting the <i>Provided Input</i> at the end.</li>
            <li>Add it to your Home Screen or Back Tap for one-tap entry.</li>
          </ol>
          <Field label="Default account (optional)">
            {(id) => (
              <select id={id} className={inputCls} value={acct} onChange={(e) => setAcct(e.target.value)}>
                <option value="">Ask in the app</option>
                {ledger.activeAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            )}
          </Field>
          <div className="flex gap-2">
            <code className="min-w-0 flex-1 truncate rounded-2xl bg-pale px-3 py-3 text-xs">{link}</code>
            <Button
              variant="secondary"
              className="px-3"
              aria-label="Copy link"
              onClick={async () => {
                await navigator.clipboard?.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              <Copy className="size-4" />
            </Button>
          </div>
          <p className={cx("text-xs", copied ? "text-income" : "text-ink-3")}>
            {copied ? "Copied!" : "Also supports &category=, &description= and &date=YYYY-MM-DD. Shortcuts may open Safari instead of the installed app depending on iOS version — test on your device."}
          </p>
        </Card>

        <Card className="space-y-2">
          <SectionTitle>Danger zone</SectionTitle>
          <p className="text-sm text-ink-3">Erase every account, transaction and person on this device. Export a backup first.</p>
          <Button
            variant="danger"
            className="w-full"
            onClick={async () => {
              if (!confirm("Erase all Kaban data on this device? This cannot be undone.")) return;
              if (!confirm("Really erase everything?")) return;
              await wipeAll();
              router.replace("/welcome");
            }}
          >
            <Trash2 className="size-4" /> Erase all data
          </Button>
        </Card>
      </div>
    </>
  );
}

const noop = () => () => {};
function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}
