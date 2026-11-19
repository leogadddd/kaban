import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Only the public landing page is indexable; app screens hold personal, device-local data.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/`,
      changeFrequency: "monthly",
      priority: 1,
      images: [`${SITE_URL}/opengraph-image`],
    },
  ];
}
