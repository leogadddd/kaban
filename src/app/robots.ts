import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Crawlers may fetch everything; app screens opt out of indexing with a noindex meta tag
// (set in the root layout) so only the public landing page appears in search results.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
