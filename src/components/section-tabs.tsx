"use client";

import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { HapticLink } from "./haptic-button";
import { cx } from "./ui";

/** Pages grouped under one bottom-nav tab. Each group shows a segmented row to switch between them. */
export const SECTION_GROUPS = {
  accounts: [
    { href: "/accounts", label: "Accounts" },
    { href: "/people", label: "People" },
    { href: "/owed", label: "Owed to me" },
  ],
  activity: [
    { href: "/activity", label: "All" },
    { href: "/payments", label: "Payments" },
    { href: "/instalments", label: "Instalments" },
  ],
} as const;

export type SectionGroup = keyof typeof SECTION_GROUPS;

export function groupHrefs(group: SectionGroup): string[] {
  return SECTION_GROUPS[group].map((t) => t.href);
}

/** Link-based segmented control shown under a page header. Hidden on desktop, where the sidebar lists every page. */
export function SectionTabs({ group, className }: { group: SectionGroup; className?: string }) {
  const pathname = usePathname();
  const tabs = SECTION_GROUPS[group];
  return (
    <nav aria-label="Section" className={cx("px-4 pb-3 lg:hidden", className)}>
      <div className="flex rounded-2xl bg-pale p-1">
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <HapticLink
              key={t.href}
              href={t.href}
              replace
              aria-current={active ? "page" : undefined}
              wrapperClassName="flex-1"
              className={cx(
                "relative flex min-h-9 items-center justify-center rounded-xl px-2 text-sm font-medium whitespace-nowrap transition-colors",
                active ? "text-ink" : "text-ink-2",
              )}
            >
              {active && <motion.span layoutId={`section-${group}`} className="absolute inset-0 rounded-xl bg-surface shadow-soft" transition={{ type: "spring", bounce: 0.2, duration: 0.4 }} />}
              <span className="relative">{t.label}</span>
            </HapticLink>
          );
        })}
      </div>
    </nav>
  );
}
