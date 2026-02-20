import type { MetadataRoute } from "next";
import { getAllKeywords } from "@/lib/getKeywords";

export default function sitemap(): MetadataRoute.Sitemap {
  const keywords = getAllKeywords();

  const pseoPages: MetadataRoute.Sitemap = keywords.map((row) => ({
    url: `https://clipperfox.com/${row.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [
    {
      url: "https://clipperfox.com",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...pseoPages,
  ];
}
