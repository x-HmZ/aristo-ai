import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/legal/siteUrl";
import { DISALLOWED_PATHS } from "@/lib/legal/seo";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: [...DISALLOWED_PATHS] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
