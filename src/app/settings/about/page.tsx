"use client";

import { ExternalLink, FileText, Shield } from "lucide-react";
import { useInstall } from "@/components/install";
import { SettingsGroup, SettingsLink, SettingsRow } from "@/components/settings-ui";
import { Card, PageHeader } from "@/components/ui";
import { LogoMark } from "@/lib/logo";

const VERSION = "0.1";

export default function AboutPage() {
  const install = useInstall();
  const installed = install.standalone || install.installed;
  return (
    <>
      <PageHeader title="About" back="/settings" privacy={false} />
      <div className="space-y-6 px-4 pb-6">
        <Card className="flex flex-col items-center py-6 text-center">
          <LogoMark size={56} />
          <p className="mt-3 text-lg font-semibold">Kaban</p>
          <p className="text-sm text-ink-3">Personal finance tracker · Version {VERSION}</p>
        </Card>

        <SettingsGroup>
          <SettingsRow label="Storage" trailing={<span className="text-sm text-ink-3">On this device</span>} />
          <SettingsRow label="Cloud" trailing={<span className="text-sm text-ink-3">Optional</span>} />
          <SettingsRow label="Running as" trailing={<span className="text-sm text-ink-3">{installed ? "Installed app" : "Browser"}</span>} />
          <SettingsRow label="Price" trailing={<span className="text-sm text-ink-3">Free</span>} />
        </SettingsGroup>

        <SettingsGroup>
          <SettingsLink href="/terms" icon={FileText} tone="muted" label="Terms of Service" />
          <SettingsLink href="/privacy" icon={Shield} tone="muted" label="Privacy Policy" />
          <a href="/" target="_blank" rel="noopener noreferrer" className="flex min-h-14 items-center gap-3 px-4 py-2.5 active:bg-pale">
            <span className="grid size-9 place-items-center rounded-xl bg-line/60 text-ink-2"><ExternalLink className="size-[1.1rem]" /></span>
            <span className="flex-1 font-medium">Kaban website</span>
          </a>
        </SettingsGroup>
      </div>
    </>
  );
}
