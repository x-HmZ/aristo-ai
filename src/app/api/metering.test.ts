/**
 * Allowance wiring on the paid routes (METRICS.md): the guard's error is returned unchanged, a validation failure
 * never consumes, a paid call consumes once, and a failure after consumption releases once. The entitlement
 * library is mocked; nothing here touches a database or a paid API.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const ent = vi.hoisted(() => ({
  requireEntitlement: vi.fn(),
  spendAllowance: vi.fn(),
  releaseConsumed: vi.fn(),
}));
const db = vi.hoisted(() => ({
  concept: { id: "c1", name: "Fractions", description: "d", domain: "math" } as Record<string, unknown> | null,
  cached: null as { id: string; payload: unknown } | null,
}));
const mocks = vi.hoisted(() => ({
  generateLesson: vi.fn(),
  explainMore: vi.fn(),
  generateCourse: vi.fn(),
  generate3dModel: vi.fn(),
  generateInfographic: vi.fn(),
  generate3dSourceImageDetailed: vi.fn(),
  anthropicCreate: vi.fn(),
}));

vi.mock("@/lib/billing/entitlements", () => ent);

function table(name: string, service: boolean) {
  const result = () => {
    if (name === "concepts") return { data: db.concept, error: null };
    if (name === "cached_lessons" && service) return { data: db.cached, error: null };
    return { data: null, error: null };
  };
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "insert", "upsert"]) chain[m] = () => chain;
  chain.maybeSingle = async () => result();
  chain.single = async () => ({ data: { id: "x" }, error: null });
  chain.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(res);
  return chain;
}
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: (n: string) => table(n, false) }),
  createServiceClient: () => ({ from: (n: string) => table(n, true), rpc: () => undefined }),
}));
vi.mock("@/lib/agents/teaching", () => ({ generateLesson: mocks.generateLesson, explainMore: mocks.explainMore }));
vi.mock("@/lib/agents/curriculum", () => ({ generateCourse: mocks.generateCourse }));
vi.mock("@/lib/rag/retrieve", () => ({
  loadConceptScope: async () => ({ sourceId: null, pageRanges: null }),
  retrieveChunks: async () => ({ chunks: [] }),
}));
vi.mock("@/lib/rag/reference", () => ({ formatChunk: () => "" }));
vi.mock("@/lib/rag/credits", () => ({ loadLessonSources: async () => [] }));
vi.mock("@/lib/admin/moderation-rules", () => ({
  decideModeration: async () => ({ status: "auto_approved" }),
  profileSignature: () => "sig",
}));
vi.mock("@/lib/llm/anthropic", () => ({ getAnthropic: () => ({ messages: { create: mocks.anthropicCreate } }) }));
vi.mock("@/lib/imagegen/banana", () => ({
  generate3dModel: mocks.generate3dModel,
  generateInfographic: mocks.generateInfographic,
  generate3dSourceImageDetailed: mocks.generate3dSourceImageDetailed,
}));

import { GET as lessonGET } from "@/app/api/learn/lesson/[conceptId]/route";
import { POST as teachPOST } from "@/app/api/teach/route";
import { POST as explainPOST } from "@/app/api/learn/explain-more/route";
import { POST as challengePOST } from "@/app/api/learn/challenge/route";
import { POST as modelPOST } from "@/app/api/generate-model/route";
import { POST as model3dPOST } from "@/app/api/generate-model/3d/route";
import { POST as coursePOST } from "@/app/api/courses/generate/route";

const CONSUMED = (metric: string, amount = 1) => ({ accountId: "a", periodKey: "p", metric, amount });
const json = (body: unknown) =>
  new Request("http://x/api", { method: "POST", body: JSON.stringify(body) }) as never;
const lessonParams = { params: Promise.resolve({ conceptId: "c1" }) };

beforeEach(() => {
  for (const f of [...Object.values(ent), ...Object.values(mocks)]) f.mockReset();
  db.concept = { id: "c1", name: "Fractions", description: "d", domain: "math" };
  db.cached = null;
  process.env.FAL_KEY = "k";
  ent.requireEntitlement.mockResolvedValue({ user: { id: "u1" }, error: null, entitlement: null, consumed: null });
  ent.spendAllowance.mockImplementation(async (_e: unknown, metric: string, amount = 1) => ({
    error: null,
    consumed: CONSUMED(metric, amount),
  }));
  mocks.generateLesson.mockResolvedValue({ phases: {} });
  mocks.explainMore.mockResolvedValue("more");
  mocks.generateInfographic.mockResolvedValue({ imageUrl: "i", cached: false });
  mocks.generate3dSourceImageDetailed.mockResolvedValue({ url: "s", cached: false });
  mocks.generate3dModel.mockResolvedValue({ modelUrl: "m", cached: false });
  mocks.anthropicCreate.mockResolvedValue({
    content: [{ type: "tool_use", input: { definition: "d" } }, { type: "text", text: '{"is_correct":true,"score":1,"feedback":"ok"}' }],
  });
  mocks.generateCourse.mockResolvedValue({ id: "course", domain: "math", title: "t", description: "d", structure: {}, estimated_hours: 1 });
});

const exhausted = () => NextResponse.json({ error: "allowance_exhausted" }, { status: 402 });

describe("guard errors come back unchanged", () => {
  it("returns the approval/guard error and does nothing else", async () => {
    const err = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    ent.requireEntitlement.mockResolvedValue({ user: null, error: err });
    expect(await teachPOST(json({ topic: "x" }))).toBe(err);
    expect(await lessonGET({} as never, lessonParams)).toBe(err);
    expect(ent.spendAllowance).not.toHaveBeenCalled();
    expect(mocks.anthropicCreate).not.toHaveBeenCalled();
  });
});

describe("lesson route", () => {
  it("cache miss consumes fresh_lessons once, after the cache lookup", async () => {
    const res = await lessonGET({} as never, lessonParams);
    expect(res.status).toBe(200);
    expect(ent.spendAllowance).toHaveBeenCalledTimes(1);
    expect(ent.spendAllowance.mock.calls[0][1]).toBe("fresh_lessons");
    expect(ent.releaseConsumed).not.toHaveBeenCalled();
  });

  it("miss over the cap returns the 402 and does not generate", async () => {
    const err = exhausted();
    ent.spendAllowance.mockResolvedValue({ error: err, consumed: null });
    expect(await lessonGET({} as never, lessonParams)).toBe(err);
    expect(mocks.generateLesson).not.toHaveBeenCalled();
  });

  it("releases once when generation throws", async () => {
    mocks.generateLesson.mockRejectedValue(new Error("llm down"));
    const res = await lessonGET({} as never, lessonParams);
    expect(res.status).toBe(500);
    expect(ent.releaseConsumed).toHaveBeenCalledTimes(1);
    expect(ent.releaseConsumed.mock.calls[0][0]).toMatchObject({ metric: "fresh_lessons" });
  });

  it("cache hit counts a replay and is served even when the replay is exhausted", async () => {
    db.cached = { id: "h", payload: { phases: "cached" } };
    ent.spendAllowance.mockResolvedValue({ error: exhausted(), consumed: null });
    const res = await lessonGET({} as never, lessonParams);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ phases: "cached" });
    expect(ent.spendAllowance.mock.calls.map((c) => c[1])).toEqual(["replays"]);
    expect(mocks.generateLesson).not.toHaveBeenCalled();
  });

  it("cache hit is served when the counter itself fails (503) or throws", async () => {
    db.cached = { id: "h", payload: { phases: "cached" } };
    ent.spendAllowance.mockRejectedValue(new Error("boom"));
    expect((await lessonGET({} as never, lessonParams)).status).toBe(200);
  });
});

describe("chat routes", () => {
  it("teach: 400 costs nothing; success consumes chat_turns once; failure releases once", async () => {
    expect((await teachPOST(json({}))).status).toBe(400);
    expect(ent.spendAllowance).not.toHaveBeenCalled();

    expect((await teachPOST(json({ topic: "x" }))).status).toBe(200);
    expect(ent.spendAllowance).toHaveBeenCalledTimes(1);
    expect(ent.spendAllowance.mock.calls[0][1]).toBe("chat_turns");
    expect(ent.releaseConsumed).not.toHaveBeenCalled();

    mocks.anthropicCreate.mockRejectedValue(new Error("down"));
    expect((await teachPOST(json({ topic: "x" }))).status).toBe(500);
    expect(ent.releaseConsumed).toHaveBeenCalledTimes(1);
  });

  it("explain-more: 400 costs nothing; failure releases once; 402 skips the model", async () => {
    expect((await explainPOST(json({ phase: "explain" }))).status).toBe(400);
    expect(ent.spendAllowance).not.toHaveBeenCalled();

    const body = { phase: "explain", phaseContent: "p", conceptName: "c" };
    mocks.explainMore.mockRejectedValue(new Error("down"));
    expect((await explainPOST(json(body))).status).toBe(500);
    expect(ent.releaseConsumed).toHaveBeenCalledTimes(1);

    const err = exhausted();
    ent.spendAllowance.mockResolvedValue({ error: err, consumed: null });
    mocks.explainMore.mockClear();
    expect(await explainPOST(json(body))).toBe(err);
    expect(mocks.explainMore).not.toHaveBeenCalled();
  });

  it("challenge: 400 costs nothing; success consumes once; failure releases once", async () => {
    expect((await challengePOST(json({ question: "q" }))).status).toBe(400);
    expect(ent.spendAllowance).not.toHaveBeenCalled();

    const body = { question: "q", correctAnswer: "a", userAnswer: "b", conceptName: "c" };
    expect((await challengePOST(json(body))).status).toBe(200);
    expect(ent.spendAllowance.mock.calls[0][1]).toBe("chat_turns");
    expect(ent.releaseConsumed).not.toHaveBeenCalled();

    mocks.anthropicCreate.mockRejectedValue(new Error("down"));
    expect((await challengePOST(json(body))).status).toBe(500);
    expect(ent.releaseConsumed).toHaveBeenCalledTimes(1);
  });
});

describe("3D routes", () => {
  it("3d: 400 costs nothing; a miss consumes once and keeps it", async () => {
    expect((await model3dPOST(json({}))).status).toBe(400);
    expect(ent.spendAllowance).not.toHaveBeenCalled();

    expect((await model3dPOST(json({ imageUrl: "u" }))).status).toBe(200);
    expect(ent.spendAllowance).toHaveBeenCalledTimes(1);
    expect(ent.spendAllowance.mock.calls[0][1]).toBe("models_3d");
    expect(ent.releaseConsumed).not.toHaveBeenCalled();
  });

  it("3d: a cached result releases once; a failure releases once", async () => {
    mocks.generate3dModel.mockResolvedValue({ modelUrl: "m", cached: true });
    expect((await model3dPOST(json({ imageUrl: "u" }))).status).toBe(200);
    expect(ent.releaseConsumed).toHaveBeenCalledTimes(1);

    ent.releaseConsumed.mockClear();
    mocks.generate3dModel.mockRejectedValue(new Error("tripo"));
    expect((await model3dPOST(json({ imageUrl: "u" }))).status).toBe(500);
    expect(ent.releaseConsumed).toHaveBeenCalledTimes(1);
  });

  it("3d: 402 skips generation", async () => {
    const err = exhausted();
    ent.spendAllowance.mockResolvedValue({ error: err, consumed: null });
    expect(await model3dPOST(json({ imageUrl: "u" }))).toBe(err);
    expect(mocks.generate3dModel).not.toHaveBeenCalled();
  });

  it("generate-model: consumes only with a 3D prompt; cache hit and failure release once", async () => {
    const base = { imagePrompt: "p", topic: "t" };
    expect((await modelPOST(json({ topic: "t" }))).status).toBe(400);
    expect((await modelPOST(json(base))).status).toBe(200);
    expect(ent.spendAllowance).not.toHaveBeenCalled();

    expect((await modelPOST(json({ ...base, model3dPrompt: "heart" }))).status).toBe(200);
    expect(ent.spendAllowance).toHaveBeenCalledTimes(1);
    expect(ent.releaseConsumed).not.toHaveBeenCalled();

    mocks.generate3dSourceImageDetailed.mockResolvedValue({ url: "s", cached: true });
    await modelPOST(json({ ...base, model3dPrompt: "heart" }));
    expect(ent.releaseConsumed).toHaveBeenCalledTimes(1);

    ent.releaseConsumed.mockClear();
    mocks.generate3dSourceImageDetailed.mockRejectedValue(new Error("flux"));
    expect((await modelPOST(json({ ...base, model3dPrompt: "heart" }))).status).toBe(500);
    expect(ent.releaseConsumed).toHaveBeenCalledTimes(1);
  });
});

describe("courses/generate", () => {
  it("400 never reaches the guard; the guard carries the metric; failure releases once", async () => {
    expect((await coursePOST(json({}))).status).toBe(400);
    expect(ent.requireEntitlement).not.toHaveBeenCalled();

    ent.requireEntitlement.mockResolvedValue({
      user: { id: "u1" }, error: null, entitlement: null, consumed: CONSUMED("fresh_lessons"),
    });
    mocks.generateCourse.mockRejectedValue(new Error("llm"));
    expect((await coursePOST(json({ domain: "math", goal: "g" }))).status).toBe(500);
    expect(ent.requireEntitlement).toHaveBeenCalledWith({ metric: "fresh_lessons" });
    expect(ent.releaseConsumed).toHaveBeenCalledTimes(1);
  });

  it("returns the guard's 402 unchanged", async () => {
    const err = exhausted();
    ent.requireEntitlement.mockResolvedValue({ user: null, error: err });
    expect(await coursePOST(json({ domain: "math" }))).toBe(err);
    expect(mocks.generateCourse).not.toHaveBeenCalled();
  });
});
