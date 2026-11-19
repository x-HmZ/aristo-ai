import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.hoisted(() => vi.fn());
const logUsage = vi.hoisted(() => vi.fn());

vi.mock("openai", () => ({
  default: class { audio = { transcriptions: { create } }; },
}));
vi.mock("@/lib/auth/approval", () => ({
  requireApproved: async () => ({ user: { id: "u1" }, error: null }),
}));
vi.mock("@/lib/llm/usage", () => ({ logUsage }));
vi.mock("@/lib/guard", () => ({ guardSpend: async () => null }));
const refuseUnlessAllowed = vi.hoisted(() => vi.fn(async (): Promise<Response | null> => null));
vi.mock("@/lib/account/capabilityGuard", () => ({ refuseUnlessAllowed }));

import { POST } from "@/app/api/stt/route";

function req(parts: { audio?: Blob | string; language?: string }) {
  const form = new FormData();
  if (parts.audio !== undefined) {
    form.set("audio", parts.audio instanceof Blob ? new File([parts.audio], "a.webm", { type: parts.audio.type }) : parts.audio);
  }
  if (parts.language !== undefined) form.set("language", parts.language);
  return new Request("http://x/api/stt", { method: "POST", body: form }) as never;
}

const webm = (n = 100) => new Blob([new Uint8Array(n)], { type: "audio/webm;codecs=opus" });

beforeEach(() => {
  create.mockReset();
  logUsage.mockClear();
  process.env.OPENAI_API_KEY = "k";
});

describe("/api/stt", () => {
  it("503 when no key is configured", async () => {
    delete process.env.OPENAI_API_KEY;
    const res = await POST(req({ audio: webm() }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "stt_unavailable" });
  });

  it("400 without an audio field", async () => {
    expect((await POST(req({}))).status).toBe(400);
  });

  it("415 for a wrong type", async () => {
    const res = await POST(req({ audio: new Blob(["x"], { type: "text/plain" }) }));
    expect(res.status).toBe(415);
    expect(create).not.toHaveBeenCalled();
  });

  it("403 when the guardian has voice input turned off, before any provider call", async () => {
    refuseUnlessAllowed.mockResolvedValueOnce(Response.json({ code: "capability_off" }, { status: 403 }));
    const res = await POST(req({ audio: webm(1000) }));
    expect(res.status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it("413 over the size cap", async () => {
    const res = await POST(req({ audio: webm(512 * 1024 + 1) }));
    expect(res.status).toBe(413);
    expect(create).not.toHaveBeenCalled();
  });

  it("400 for a bad language", async () => {
    const res = await POST(req({ audio: webm(), language: "english" }));
    expect(res.status).toBe(400);
  });

  it("returns the text and logs one usage row without it", async () => {
    create.mockResolvedValue({ text: "the answer is four" });
    const res = await POST(req({ audio: webm(), language: "en" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "the answer is four" });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].language).toBe("en");
    expect(logUsage).toHaveBeenCalledTimes(1);
    const ev = logUsage.mock.calls[0][0];
    expect(ev).toMatchObject({ provider: "openai", feature: "stt", user_id: "u1" });
    expect(JSON.stringify(ev)).not.toContain("answer");
  });

  it("generic 500 when the provider fails", async () => {
    create.mockRejectedValue(new Error("secret detail"));
    const res = await POST(req({ audio: webm() }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
  });
});
