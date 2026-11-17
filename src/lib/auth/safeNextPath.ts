export const DEFAULT_NEXT_PATH = "/learn";

/**
 * Turns the `next` query parameter of an auth redirect into a path on this origin.
 *
 * `next` comes from the URL, so it is attacker-controlled. Appending it to the origin unchecked let
 * "?next=@evil.example" or "?next=//evil.example" send a freshly signed-in user to another site.
 * Only a path on this origin is accepted; anything else falls back to the default.
 */
export function safeNextPath(next: string | null | undefined, origin: string): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return DEFAULT_NEXT_PATH;
  }
  try {
    const url = new URL(next, origin);
    if (url.origin !== origin) return DEFAULT_NEXT_PATH;
    // "/.//host" normalises to a pathname of "//host"; one leading slash keeps the result a plain path
    // even for a caller that redirects to it without the origin in front.
    const pathname = url.pathname.replace(/^\/{2,}/, "/");
    return `${pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_NEXT_PATH;
  }
}
