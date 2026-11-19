/** Public pages and crawler rules, kept out of the route files so they can be tested and so those files export only what Next expects. */

/** Public pages only, as paths. The legal pages are listed only once they are in force (a draft is noindex). */
export function sitemapPaths(opts: { legalInForce: boolean; imprintInForce: boolean }): string[] {
  const paths = ["/", "/demo", "/pricing", "/credits"];
  if (opts.legalInForce) paths.push("/privacy", "/terms", "/parents");
  if (opts.imprintInForce) paths.push("/imprint");
  return paths;
}

/** Paths crawlers must not fetch: the app itself, the API, admin, accounts and development pages. */
export const DISALLOWED_PATHS = [
  "/admin",
  "/api",
  "/account",
  "/learn",
  "/pending",
  "/dev",
  "/sign-in",
  "/sign-up",
  "/create-teacher",
] as const;
