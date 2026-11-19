
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
