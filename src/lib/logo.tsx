/** Kaban mark: a coffer (kaban) with a leaf clasp. Used for app icons and in-app logo. */
export function LogoMark({ size = 32, bg = true }: { size?: number; bg?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      {bg && <rect width="64" height="64" rx="16" fill="#176B4D" />}
      <path d="M14 28c0-6.6 5.4-12 12-12h12c6.6 0 12 5.4 12 12v2H14v-2Z" fill="#E8F4EC" opacity="0.65" />
      <rect x="14" y="30" width="36" height="20" rx="5" fill="#E8F4EC" />
      <path d="M32 26c-4.5 3.2-5.5 8.4-2 12.4 1 1.1 2.6 1.1 4 0 3.5-4 2.5-9.2-2-12.4Z" fill="#2D936C" stroke="#176B4D" strokeWidth="1.6" />
      <path d="M32 31v8" stroke="#176B4D" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
