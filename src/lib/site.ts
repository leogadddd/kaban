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
export const SITE_TAGLINE = "Every peso on the family card, accounted for";
export const SITE_DESCRIPTION =
  "Kaban is a free, offline-first money tracker for the Philippines. Track cash, debit and a shared family credit card: billing cycles, instalments, split expenses and who still owes you. Installs on iPhone and Android.";

export const SITE_KEYWORDS = [
  "credit card tracker Philippines",
  "shared credit card tracker",
  "family expense tracker",
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
