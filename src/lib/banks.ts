import type { Account } from "./types";

export interface Bank {
  id: string;
  name: string;
  short: string;
  kind: "bank" | "wallet" | "digital";
  /** Brand colour, used for the account card and the fallback badge. */
  color: string;
  /** Text inside the fallback badge (defaults to `short`). */
  badge?: string;
  /** Badge text colour when there's no logo file. */
  ink?: string;
  /** Bundled icon in /public/banks (each bank's own published site icon). */
  logo?: string;
}

// Logos are the icons each institution publishes on its own website, bundled so they work offline.
// Banks without a usable icon (too small, or not downloadable) fall back to a brand-colour badge.
export const BANKS: Bank[] = [
  { id: "bdo", name: "BDO Unibank", short: "BDO", kind: "bank", color: "#0033A0", logo: "/banks/bdo.png" },
  { id: "bpi", name: "BPI", short: "BPI", kind: "bank", color: "#B11116", logo: "/banks/bpi.png" },
  { id: "metrobank", name: "Metrobank", short: "Metrobank", kind: "bank", color: "#0B4EA2", logo: "/banks/metrobank.png" },
  { id: "landbank", name: "Landbank", short: "Landbank", kind: "bank", color: "#2E7D32", logo: "/banks/landbank.png" },
  { id: "pnb", name: "PNB", short: "PNB", kind: "bank", color: "#0B3D91", logo: "/banks/pnb.png" },
  { id: "securitybank", name: "Security Bank", short: "Security", kind: "bank", color: "#0081C6", logo: "/banks/securitybank.png" },
  { id: "unionbank", name: "UnionBank", short: "UnionBank", badge: "UB", kind: "bank", color: "#F26B21" },
  { id: "rcbc", name: "RCBC", short: "RCBC", kind: "bank", color: "#2F6DB5", logo: "/banks/rcbc.png" },
  { id: "chinabank", name: "China Bank", short: "China Bank", kind: "bank", color: "#D71920", logo: "/banks/chinabank.png" },
  { id: "eastwest", name: "EastWest", short: "EastWest", badge: "EW", kind: "bank", color: "#6A2C91" },
  { id: "gcash", name: "GCash", short: "GCash", kind: "wallet", color: "#007CFF", logo: "/banks/gcash.png" },
  { id: "maya", name: "Maya", short: "Maya", badge: "maya", kind: "wallet", color: "#111111", ink: "#2BE48A" },
  { id: "gotyme", name: "GoTyme", short: "GoTyme", kind: "digital", color: "#00B8CC", logo: "/banks/gotyme.png" },
  { id: "maribank", name: "MariBank (SeaBank)", short: "MariBank", kind: "digital", color: "#EE6A1F", logo: "/banks/maribank.png" },
  { id: "cimb", name: "CIMB", short: "CIMB", kind: "digital", color: "#C8102E" },
  { id: "tonik", name: "Tonik", short: "Tonik", kind: "digital", color: "#7B61FF", logo: "/banks/tonik.png" },
  // Buy-now-pay-later: tracked like a credit line (limit, statements, instalments).
  { id: "atome", name: "Atome", short: "Atome", kind: "digital", color: "#F0FF5F", logo: "/banks/atome.png" },
];

const byId = new Map(BANKS.map((b) => [b.id, b]));
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const ALIASES: Record<string, string> = { seabank: "maribank", bdounibank: "bdo", metropolitanbank: "metrobank", landbankofthephilippines: "landbank", paymaya: "maya", unionbankph: "unionbank", ub: "unionbank" };

export function bankById(id?: string): Bank | undefined {
  return id ? byId.get(id) : undefined;
}

/** The account's bank: explicit pick first, else a match on the free-text issuer (covers older records). */
export function bankFor(a: Pick<Account, "bankId" | "issuer">): Bank | undefined {
  if (a.bankId) return byId.get(a.bankId);
  if (!a.issuer) return undefined;
  const n = norm(a.issuer);
  const alias = ALIASES[n];
  if (alias) return byId.get(alias);
  return BANKS.find((b) => norm(b.name) === n || norm(b.short) === n || b.id === n);
}

export const BANK_LOGOS = BANKS.flatMap((b) => (b.logo ? [b.logo] : []));
