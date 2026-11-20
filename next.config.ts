import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Pages are client components fed from IndexedDB, and AppShell holds them back until the local ledger
    // opens, so the server-side instant check only ever sees an empty segment and warns on every route.
    // Validate just the segments that opt in with `export const instant`.
    instantInsights: { validationLevel: "manual-warning" },
  },
  // Baked in at build time; lets the client tell the service worker to refresh the offline shell after a deploy.
  env: { NEXT_PUBLIC_BUILD_ID: String(Date.now()) },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
