import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  row: null as null | { storage_path: string },
  uploads: [] as string[],
  upserts: [] as unknown[],
  uploadError: null as null | Error,
  lookupThrows: false,
}));
const logUsage = vi.hoisted(() => vi.fn());

vi.mock("next/server", async (orig) => {
  const mod = await orig<typeof import("next/server")>();
  return { ...mod, after: (fn: () => unknown) => { void fn(); } };
});
const billing = vi.hoisted(() => ({
  spendAllowance: vi.fn(),
  releaseConsumed: vi.fn(),
}));
vi.mock("@/lib/guard", () => ({ guardSpend: async () => null }));
vi.mock("@/lib/billing/entitlements", () => ({
  requireEntitlement: async () => ({ user: { id: "u1" }, error: null, entitlement: null, consumed: null }),
  spendAllowance: billing.spendAllowance,
  releaseConsumed: billing.releaseConsumed,
}));
vi.mock("@/lib/llm/usage", () => ({ logUsage }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({
        maybeSingle: async () => {
          if (state.lookupThrows) throw new Error("db down");
          return { data: state.row, error: null };
        },
      }) }) }),
      upsert: async (r: unknown) => { state.upserts.push(r); return { error: null }; },
    }),
    storage: { from: () => ({
      getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn.test/${p}` } }),
      upload: async (p: string) => {
        state.uploads.push(p);
        return { error: state.uploadError };
      },
    }) },
  }),
}));

import { POST } from "@/app/api/tts/route";

const ALIGN = { characters: ["h"], character_start_times_seconds: [0], character_end_times_seconds: [0.1] };

function req(body: unknown) {
  return new Request("http://x/api/tts", { method: "POST", body: JSON.stringify(body) }) as never;
}

let elevenCalls: number;
function mockFetch(opts: { align?: boolean } = {}) {
  const align = opts.align ?? true;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("api.elevenlabs.io")) {
      elevenCalls++;
      if (url.endsWith("/with-timestamps")) {
        return new Response(
          JSON.stringify({ audio_base64: Buffer.from("mp3").toString("base64"), alignment: align ? ALIGN : null }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("mp3", { status: 200 });
    }
    if (init?.method === "HEAD") return new Response(null, { status: 200 });
    if (url.endsWith(".json")) return new Response(JSON.stringify(ALIGN), { status: 200 });
    return new Response("x", { status: 200 });
  }));
}

const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  state.row = null; state.uploads = []; state.upserts = []; state.uploadError = null; state.lookupThrows = false;
  elevenCalls = 0;
  logUsage.mockClear();
  billing.spendAllowance.mockReset();
  billing.spendAllowance.mockResolvedValue({ error: null, consumed: { accountId: "a", periodKey: "p", metric: "voice_chars", amount: 1 } });
  billing.releaseConsumed.mockReset();
  process.env.ELEVENLABS_API_KEY = "k";
  delete process.env.TTS_TIMESTAMPS;
  mockFetch();
});

describe("/api/tts cache", () => {
  it("live scope never touches storage", async () => {
    const res = await POST(req({ text: "Hi Sam", scope: "live" }));
    expect(res.status).toBe(200);
    expect(elevenCalls).toBe(1);
    await tick();
    expect(state.uploads).toEqual([]);
    expect(state.upserts).toEqual([]);
  });

  it("missing or invalid scope is live", async () => {
    await POST(req({ text: "a" }));
    await POST(req({ text: "b", scope: "weird" }));
    await tick();
    expect(state.uploads).toEqual([]);
  });

  it("miss: calls upstream once, stores mp3 and alignment, logs usage without text", async () => {
    const res = await POST(req({ text: "Photosynthesis", scope: "lesson" }));
    const body = await res.json();
    expect(body.audio).toBeTypeOf("string");
    expect(elevenCalls).toBe(1);
    await tick();
    expect(state.uploads.some((p) => p.endsWith(".mp3"))).toBe(true);
    expect(state.uploads.some((p) => p.endsWith(".json"))).toBe(true);
    expect(state.upserts).toHaveLength(1);
    expect(logUsage).toHaveBeenCalledTimes(1);
    const ev = logUsage.mock.calls[0][0];
    expect(ev.provider).toBe("elevenlabs");
    expect(JSON.stringify(ev)).not.toContain("Photosynthesis");
  });

  it("hit: no upstream call, no usage, returns the public url", async () => {
    state.row = { storage_path: "tts/abc.mp3" };
    const res = await POST(req({ text: "Photosynthesis", scope: "lesson" }));
    const body = await res.json();
    expect(body.cached).toBe(true);
    expect(body.audioUrl).toBe("https://cdn.test/tts/abc.mp3");
    expect(body.alignment).toEqual(ALIGN);
    expect(elevenCalls).toBe(0);
    expect(logUsage).not.toHaveBeenCalled();
  });

  it("lookup failure falls through to generation", async () => {
    state.lookupThrows = true;
    const res = await POST(req({ text: "Photosynthesis", scope: "lesson" }));
    expect(res.status).toBe(200);
    expect(elevenCalls).toBe(1);
  });

  it("store failure does not break the response", async () => {
    state.uploadError = new Error("bucket full");
    const res = await POST(req({ text: "Photosynthesis", scope: "lesson" }));
    expect(res.status).toBe(200);
    await tick();
    expect(state.upserts).toEqual([]);
  });

  it("does not cache a result that came without alignment", async () => {
    mockFetch({ align: false });
    await POST(req({ text: "Photosynthesis", scope: "lesson" }));
    await tick();
    expect(state.uploads).toEqual([]);
  });

  it("with TTS_TIMESTAMPS=off, plain audio is cached", async () => {
    process.env.TTS_TIMESTAMPS = "off";
    const res = await POST(req({ text: "Photosynthesis", scope: "lesson" }));
    expect(res.headers.get("content-type")).toBe("audio/mpeg");
    await tick();
    expect(state.uploads).toHaveLength(1);
    expect(state.upserts).toHaveLength(1);
  });
});

describe("/api/tts metering", () => {
  it("live scope consumes voice_chars by text length once", async () => {
    const res = await POST(req({ text: "Hello there", scope: "live" }));
    expect(res.status).toBe(200);
    expect(billing.spendAllowance).toHaveBeenCalledTimes(1);
    expect(billing.spendAllowance.mock.calls[0].slice(1)).toEqual(["voice_chars", 11]);
    expect(billing.releaseConsumed).not.toHaveBeenCalled();
  });

  it("lesson scope consumes nothing", async () => {
    await POST(req({ text: "Photosynthesis", scope: "lesson" }));
    expect(billing.spendAllowance).not.toHaveBeenCalled();
  });

  it("validation failures consume nothing", async () => {
    expect((await POST(req({ text: "   ", scope: "live" }))).status).toBe(400);
    expect((await POST(req({ text: "x".repeat(4001), scope: "live" }))).status).toBe(413);
    expect(billing.spendAllowance).not.toHaveBeenCalled();
  });

  it("returns the 402 unchanged and makes no ElevenLabs call", async () => {
    const { NextResponse } = await import("next/server");
    const err = NextResponse.json({ error: "allowance_exhausted" }, { status: 402 });
    billing.spendAllowance.mockResolvedValue({ error: err, consumed: null });
    const res = await POST(req({ text: "Hello", scope: "live" }));
    expect(res).toBe(err);
    expect(elevenCalls).toBe(0);
  });

  it("releases once when ElevenLabs fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    const res = await POST(req({ text: "Hello", scope: "live" }));
    expect(res.status).toBe(500);
    expect(billing.releaseConsumed).toHaveBeenCalledTimes(1);
    expect(billing.releaseConsumed.mock.calls[0][0]).toMatchObject({ metric: "voice_chars" });
  });
});
