import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.hoisted(() => vi.fn());
vi.mock("@/lib/llm/anthropic", () => ({ getAnthropic: () => ({ messages: { create } }) }));
vi.mock("@/lib/guard", () => ({ guardSpend: async () => null }));
vi.mock("@/lib/billing/entitlements", () => ({
  requireEntitlement: async () => ({ user: { id: "u1" }, error: null, entitlement: null, consumed: null }),
  spendAllowance: async () => ({ error: null, consumed: null }),
  releaseConsumed: async () => undefined,
}));

import { POST } from "@/app/api/learn/challenge/route";

const req = (b: unknown) => new Request("http://x/api/learn/challenge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }) as never;
const ok = { question: "q", correctAnswer: "a", userAnswer: "b", conceptName: "c" };
const tool = (input: unknown) => ({ content: [{ type: "tool_use", name: "deliver_evaluation", input }] });

beforeEach(() => create.mockReset());

describe("/api/learn/challenge", () => {
  it("uses tool_use with a forced tool and tags the user", async () => {
    create.mockResolvedValue(tool({ is_correct: true, score: 0.9, feedback: "Nice." }));
    const res = await POST(req(ok));
    expect(await res.json()).toEqual({ is_correct: true, score: 0.9, feedback: "Nice." });
    const [params, tag] = create.mock.calls[0];
    expect(params.tool_choice).toEqual({ type: "tool", name: "deliver_evaluation" });
    expect(tag).toMatchObject({ feature: "learn.challenge", userId: "u1" });
  });

  it("returns only the three fields, clamped, whatever the model adds", async () => {
    create.mockResolvedValue(tool({ is_correct: false, score: 7, feedback: "x".repeat(900), admin: true }));
    const body = await (await POST(req(ok))).json();
    expect(Object.keys(body).sort()).toEqual(["feedback", "is_correct", "score"]);
    expect(body.score).toBe(1);
    expect(body.feedback).toHaveLength(600);
  });

  it("falls back safely when the model returns no usable tool call", async () => {
    create.mockResolvedValue({ content: [{ type: "text", text: '{"is_correct":true}' }] });
    expect(await (await POST(req(ok))).json()).toEqual({ is_correct: false, score: 0, feedback: "Keep thinking about it!" });
  });

  it("400 for oversized or unknown fields, before any model call", async () => {
    expect((await POST(req({ ...ok, userAnswer: "x".repeat(2001) }))).status).toBe(400);
    expect((await POST(req({ ...ok, extra: 1 }))).status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });
});
