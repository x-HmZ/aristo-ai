import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/legal/siteUrl";
import { operator } from "@/lib/legal/operator";
import { sitemapPaths } from "@/lib/legal/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  return sitemapPaths({ legalInForce: operator.complete, imprintInForce: operator.imprintComplete }).map((p) => ({
    url: p === "/" ? base : `${base}${p}`,
  }));
}
