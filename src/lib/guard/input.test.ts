import { describe, expect, it } from "vitest";
import { z } from "zod";
import { classifyAssetUrl, verifyAssetUrl } from "@/lib/guard/assets";
import { conceptIdSchema, parseJsonBody, parseValue, profileSchema } from "@/lib/guard/input";

const post = (body: string, headers: Record<string, string> = { "Content-Type": "application/json" }) =>
  new Request("http://x/api", { method: "POST", body, headers });

describe("conceptIdSchema", () => {
  it("accepts KG ids and plain topic titles", () => {
    for (const ok of ["python_variables", "fractions-1", "Photosynthesis in plants", "What is 2+2?", "Rock/Mineral", "L’eau", "Les étoiles"]) {
      expect(conceptIdSchema.safeParse(ok).success, ok).toBe(true);
    }
  });
  it("rejects markup, quotes, control characters, empty and oversized", () => {
    for (const bad of ["", " leading", "a<script>", 'say "hi"', "a\nb", "a{b}", "a`b`", "a\\b", "100%", "x".repeat(101), "-start"]) {
      expect(conceptIdSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });
});

describe("parseJsonBody", () => {
  const schema = z.object({ a: z.string().max(5) }).strict();

  it("415 unless the Content-Type is application/json", async () => {
    const bad: Record<string, string>[] = [{}, { "Content-Type": "text/plain" }, { "Content-Type": "application/x-www-form-urlencoded" }];
    for (const headers of bad) {
      const r = await parseJsonBody(post('{"a":"hi"}', headers), schema);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.response.status).toBe(415);
    }
    expect((await parseJsonBody(post('{"a":"hi"}', { "Content-Type": "Application/JSON; charset=utf-8" }), schema)).ok).toBe(true);
  });

  it("returns the data for a valid body", async () => {
    const r = await parseJsonBody(post('{"a":"hi"}'), schema);
    expect(r).toEqual({ ok: true, data: { a: "hi" } });
  });
  it("400 for unknown keys, too-long strings, bad JSON", async () => {
    for (const body of ['{"a":"hi","b":1}', '{"a":"toolong"}', "{nope"]) {
      const r = await parseJsonBody(post(body), schema);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.response.status).toBe(400);
    }
  });
  it("413 over the byte cap, by header or by size", async () => {
    const big = JSON.stringify({ a: "x".repeat(200) });
    const byHeader = await parseJsonBody(post("{}", { "Content-Type": "application/json", "content-length": "999999" }), schema);
    const bySize = await parseJsonBody(post(big), schema, 100);
    for (const r of [byHeader, bySize]) {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.response.status).toBe(413);
    }
  });
  it("parseValue wraps a non-body value", () => {
    expect(parseValue(conceptIdSchema, "ok").ok).toBe(true);
    expect(parseValue(conceptIdSchema, "a<b").ok).toBe(false);
  });
  it("profile schema is strict", () => {
    expect(profileSchema.safeParse({ pace: "fast", extra: 1 }).success).toBe(false);
  });
});

const SUPA = "https://proj.supabase.co";

describe("classifyAssetUrl", () => {
  it("accepts the own public bucket and fal media hosts, and strips query and fragment", () => {
    expect(classifyAssetUrl(`${SUPA}/storage/v1/object/public/generated-assets/flux_source/abc.png?n=1#x`, SUPA)).toEqual({
      kind: "own", url: `${SUPA}/storage/v1/object/public/generated-assets/flux_source/abc.png`, path: "flux_source/abc.png",
    });
    expect(classifyAssetUrl("https://v3.fal.media/files/a/b.png?x=1", SUPA)).toEqual({ kind: "fal", url: "https://v3.fal.media/files/a/b.png" });
    expect(classifyAssetUrl("https://fal.media/files/b.png", SUPA)?.kind).toBe("fal");
    expect(classifyAssetUrl("https://storage.googleapis.com/falserverless/x.png", SUPA)?.kind).toBe("fal");
  });
  it("rejects everything else", () => {
    for (const bad of [
      "http://v3.fal.media/a.png",
      "https://evil.example/a.png",
      "https://fal.media.evil.example/a.png",
      "https://evilfal.media/a.png",
      "https://user:pw@v3.fal.media/a.png",
      "https://v3.fal.media:8443/a.png",
      "https://storage.googleapis.com/other/x.png",
      `${SUPA}/storage/v1/object/public/other-bucket/x.png`,
      `${SUPA}/storage/v1/object/public/generated-assets/../x.png`,
      "not a url",
    ]) {
      expect(classifyAssetUrl(bad, SUPA), bad).toBeNull();
    }
  });
});

describe("verifyAssetUrl", () => {
  const client = (row: { storage_path: string } | null, error: unknown = null) => ({
    from: () => {
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "limit"]) chain[m] = () => chain;
      chain.maybeSingle = async () => ({ data: row, error });
      return chain;
    },
  });
  const own = `${SUPA}/storage/v1/object/public/generated-assets/flux_source/abc.png?n=2`;

  it("own-bucket URL needs a generated_assets row", async () => {
    expect(await verifyAssetUrl(own, client({ storage_path: "flux_source/abc.png" }), SUPA)).toBe(
      `${SUPA}/storage/v1/object/public/generated-assets/flux_source/abc.png`,
    );
    expect(await verifyAssetUrl(own, client(null), SUPA)).toBeNull();
    expect(await verifyAssetUrl(own, client(null, { message: "db" }), SUPA)).toBeNull();
  });
  it("fal URL passes without a row, query stripped", async () => {
    expect(await verifyAssetUrl("https://v3.fal.media/f/a.png?n=9", client(null), SUPA)).toBe("https://v3.fal.media/f/a.png");
  });
});
