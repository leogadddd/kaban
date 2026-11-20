import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Only the public pages (landing, Terms, Privacy) are indexable; app screens hold personal, device-local data.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/`,
      changeFrequency: "monthly",
      priority: 1,
      images: [`${SITE_URL}/opengraph-image`],
    },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
