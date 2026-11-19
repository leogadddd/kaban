// All money is stored as integer minor units (centavos). Never use floats for accounting.

export const CURRENCY = "PHP";

/** Parse a user-entered amount string ("1,234.5") into centavos without float math. */
export function parseMinor(input: string): number | null {
  const clean = input.replace(/[,\s₱]/g, "").trim();
  if (!clean) return null;
  const m = /^(-)?(\d*)(?:\.(\d{0,2})\d*)?$/.exec(clean);
  if (!m) return null;
  const [, neg, whole = "", frac = ""] = m;
  if (!whole && !frac) return null;
  const minor = Number(whole || "0") * 100 + Number((frac + "00").slice(0, 2));
  if (!Number.isSafeInteger(minor)) return null;
  return neg ? -minor : minor;
}

/** Convert centavos to a plain editable string ("1234.50"). */
export function minorToInput(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return `${sign}${whole}${frac ? "." + String(frac).padStart(2, "0") : ""}`;
}

const fmt = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const fmtCompact = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: CURRENCY,
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Format centavos for display. Integer division keeps it exact. */
export function formatMoney(minor: number, opts?: { compact?: boolean; sign?: boolean }): string {
  const value = minor / 100; // display only
  const s = opts?.compact ? fmtCompact.format(Math.abs(value)) : fmt.format(Math.abs(value));
  if (minor < 0) return `−${s}`;
  if (opts?.sign && minor > 0) return `+${s}`;
  return s;
}

/** Split an amount into n parts that sum exactly; remainder centavos go to the first parts. */
export function splitEvenly(totalMinor: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.trunc(totalMinor / n);
  let rem = totalMinor - base * n;
  return Array.from({ length: n }, () => {
    if (rem > 0) {
      rem--;
      return base + 1;
    }
    return base;
  });
}
