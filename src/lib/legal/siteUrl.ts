/**
 * The public origin of the site, for canonical and Open Graph URLs, the sitemap and robots.txt.
 *
 * APP_URL (also used for links in emails) wins, then NEXT_PUBLIC_APP_URL, then the Vercel production host the platform
 * supplies, then the deployment's own host, then localhost for development. Never a hardcoded host.
 */
export interface SiteUrlEnv {
  APP_URL?: string;
  NEXT_PUBLIC_APP_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  VERCEL_URL?: string;
}

function withScheme(v: string): string {
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export function resolveSiteUrl(env: SiteUrlEnv): string {
  const raw =
    env.APP_URL?.trim() ||
    env.NEXT_PUBLIC_APP_URL?.trim() ||
    env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    env.VERCEL_URL?.trim();
  if (!raw) return "http://localhost:3000";
  return withScheme(raw).replace(/\/+$/, "");
}

export function getSiteUrl(): string {
  return resolveSiteUrl({
    APP_URL: process.env.APP_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    VERCEL_URL: process.env.VERCEL_URL,
  });
}
