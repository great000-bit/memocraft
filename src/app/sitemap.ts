import type { MetadataRoute } from "next";
import { audiences, SITE_UPDATED, SITE_URL } from "@/lib/site";

// Only public marketing pages. Lastmod is SITE_UPDATED, the last day the public pages really changed.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = SITE_UPDATED;
  return [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/photo-enhancer`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    ...audiences.map((a) => ({
      url: `${SITE_URL}/for/${a.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    { url: `${SITE_URL}/signup`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
}
