import { describe, expect, it } from "vitest";
import { resolveSiteUrl } from "./siteUrl";
import robots from "@/app/robots";
import { DISALLOWED_PATHS, sitemapPaths } from "./seo";

describe("site url", () => {
  it("prefers APP_URL, strips a trailing slash and falls back in order", () => {
    expect(resolveSiteUrl({ APP_URL: "https://aristo.test/", VERCEL_URL: "x.vercel.app" })).toBe("https://aristo.test");
    expect(resolveSiteUrl({ NEXT_PUBLIC_APP_URL: "https://pub.test" })).toBe("https://pub.test");
    expect(resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "prod.vercel.app" })).toBe("https://prod.vercel.app");
    expect(resolveSiteUrl({})).toBe("http://localhost:3000");
  });
});

describe("sitemap", () => {
  it("lists only public pages and holds back draft legal pages", () => {
    const draft = sitemapPaths({ legalInForce: false, imprintInForce: false });
    expect(draft).toEqual(["/", "/demo", "/pricing", "/credits"]);
    const live = sitemapPaths({ legalInForce: true, imprintInForce: true });
    expect(live).toEqual(expect.arrayContaining(["/privacy", "/terms", "/parents", "/imprint"]));
    for (const p of live) {
      for (const hidden of ["/admin", "/api", "/account", "/learn", "/pending", "/dev"]) {
        expect(p.startsWith(hidden)).toBe(false);
      }
    }
  });
});

describe("robots", () => {
  it("disallows the private areas and points at the sitemap", () => {
    for (const p of ["/admin", "/api", "/account", "/learn", "/pending", "/dev"]) {
      expect(DISALLOWED_PATHS).toContain(p);
    }
    const r = robots();
    expect(r.sitemap).toMatch(/\/sitemap\.xml$/);
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rule.userAgent).toBe("*");
  });
});
