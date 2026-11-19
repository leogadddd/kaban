import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
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
