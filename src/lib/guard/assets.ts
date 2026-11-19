/**
 * Which image URLs /api/generate-model/3d may send to fal.ai/Tripo: only ones this app produced.
 *
 *   - the project's own public `generated-assets` bucket (Supabase), and for those a matching `generated_assets`
 *     row must exist, so a user cannot upload nothing and point at it;
 *   - fal's own media hosts, which is where a freshly generated image lives when storage persistence failed.
 *
 * The URL is returned WITHOUT its query string and fragment, which is also what the 3D cache key is hashed from,
 * so `?n=1`, `?n=2` cannot force a paid cache miss every time.
 */

const BUCKET_PREFIX = "/storage/v1/object/public/generated-assets/";

export type AssetUrl =
  | { kind: "own"; url: string; path: string }
  | { kind: "fal"; url: string };

/** Pure part: parse, check the host and path shape, strip query and fragment. Null when not allowed. */
export function classifyAssetUrl(raw: string, supabaseUrl: string | undefined): AssetUrl | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
  const clean = `${u.protocol}//${u.host}${u.pathname}`;

  if (supabaseUrl) {
    let own: URL | null = null;
    try {
      own = new URL(supabaseUrl);
    } catch {
      own = null;
    }
    if (own && u.host === own.host && u.pathname.startsWith(BUCKET_PREFIX)) {
      const path = decodeURIComponent(u.pathname.slice(BUCKET_PREFIX.length));
      if (!path || path.includes("..")) return null;
      return { kind: "own", url: clean, path };
    }
  }

  const host = u.hostname.toLowerCase();
  if (host === "fal.media" || host.endsWith(".fal.media")) return { kind: "fal", url: clean };
  if (host === "storage.googleapis.com" && u.pathname.startsWith("/falserverless/")) return { kind: "fal", url: clean };
  return null;
}

/** The slice of the Supabase client used here, so tests can pass a fake. */
export interface AssetClient {
  from(table: string): any;
}

/**
 * The cleaned URL when the app produced it, otherwise null. Own-bucket URLs also need a generated_assets row of
 * an image kind; a database error counts as "not verified" (null).
 */
export async function verifyAssetUrl(raw: string, client: AssetClient, supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL): Promise<string | null> {
  const asset = classifyAssetUrl(raw, supabaseUrl);
  if (!asset) return null;
  if (asset.kind === "fal") return asset.url;
  try {
    const { data, error } = await client
      .from("generated_assets")
      .select("storage_path")
      .eq("storage_path", asset.path)
      .in("kind", ["flux_source", "infographic"])
      .limit(1)
      .maybeSingle();
    return !error && data?.storage_path ? asset.url : null;
  } catch {
    return null;
  }
}
