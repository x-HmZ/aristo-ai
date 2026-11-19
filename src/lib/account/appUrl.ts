/**
 * The public origin used in links Supabase puts in emails (confirmation, password reset).
 * APP_URL wins; otherwise the request's own host. Supabase only honours a redirect that is on its allow-list
 * (Authentication, URL Configuration), so a wrong value here fails closed rather than redirecting elsewhere.
 */
export function appOrigin(headers: { get(name: string): string | null }, env: Record<string, string | undefined> = process.env): string {
  const configured = env.APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!host) return "http://localhost:3000";
  const proto = headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
