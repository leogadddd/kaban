// Public site identity used for SEO metadata, the sitemap and structured data.

/**
 * Absolute site URL. Set NEXT_PUBLIC_SITE_URL for a custom domain; on Vercel the production
 * domain is picked up automatically (VERCEL_PROJECT_PRODUCTION_URL is set at build time).
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/$/, "");

export const SITE_NAME = "Kaban";
export const SITE_TAGLINE = "Every peso, accounted for";
export const SITE_DESCRIPTION =
  "Kaban is a free, offline-first personal finance tracker for the Philippines. Track cash, bank and e-wallet accounts, credit cards and pay-later plans: billing cycles, instalments, split bills and who still owes you, with optional sync across devices and dark mode. Installs on iPhone and Android.";

export const SITE_KEYWORDS = [
  "personal finance app Philippines",
  "expense tracker Philippines",
  "budget tracker app",
  "credit card tracker Philippines",
  "split expenses app",
  "who owes me app",
  "instalment tracker",
  "credit card billing cycle",
  "offline budget app",
  "PHP expense tracker",
  "peso money tracker",
  "GCash expense tracker",
  "BDO BPI credit card tracker",
];

/** Where people reach us about their data or the policies. Set NEXT_PUBLIC_CONTACT_EMAIL to show it on the legal pages. */
export const SITE_CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "";
