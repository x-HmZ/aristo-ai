import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ writes: [] as Array<{ client: string; table: string; op: string }> }));
const assess = vi.hoisted(() => ({ evaluateShortAnswer: vi.fn() }));

function chain(client: string, table: string) {
  const c: Record<string, unknown> = {};
  for (const m of ["select", "eq"]) c[m] = () => c;
  c.maybeSingle = async () => ({ data: null, error: null });
  for (const op of ["upsert", "insert"]) {
    c[op] = async () => {
      db.writes.push({ client, table, op });
      return { error: null };
    };
  }
  return c;
}
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: (t: string) => chain("user", t), rpc: async () => ({ error: null }) }),
  createServiceClient: () => ({
    from: (t: string) => chain("service", t),
    rpc: async () => {
      db.writes.push({ client: "service", table: "increment_misconception", op: "rpc" });
      return { error: null };
    },
  }),
}));
vi.mock("@/lib/auth/approval", () => ({ requireApproved: async () => ({ user: { id: "u1" }, error: null }) }));
vi.mock("@/lib/guard", () => ({ guardSpend: async () => null }));
const rate = vi.hoisted(() => ({ allowed: true, calls: [] as string[] }));
vi.mock("@/lib/guard/rate", () => ({
  enforceRate: async (_u: string, feature: string) => {
    rate.calls.push(feature);
    return rate.allowed ? { allowed: true } : { allowed: false, reason: "limit", retryAfterSeconds: 5 };
  },
  rateLimitedResponse: () => new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 }),
}));
vi.mock("@/lib/agents/assessment", async () => {
  const local = await import("@/lib/quiz/localEval");
  return { evaluateObjective: local.evaluateObjective, evaluateShortAnswer: assess.evaluateShortAnswer };
});

import { POST } from "@/app/api/quiz/submit/route";
import { signQuestion } from "@/lib/quiz/sign";

const Q = {
  id: "q1", concept_id: "fractions", question_type: "multiple_choice", question: "1/2 + 1/2 ?", correct_answer: "1", difficulty: 0.4,
};

function body(over: Record<string, unknown> = {}) {
  return {
    questionId: Q.id, conceptId: Q.concept_id, questionType: Q.question_type, question: Q.question,
    correctAnswer: Q.correct_answer, difficulty: Q.difficulty, userAnswer: "1", answerSig: signQuestion(Q), ...over,
  };
}
const req = (b: unknown) => new Request("http://x/api/quiz/submit", { method: "POST", body: JSON.stringify(b) }) as never;

beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  db.writes = [];
  rate.allowed = true;
  rate.calls = [];
  assess.evaluateShortAnswer.mockReset();
});

describe("/api/quiz/submit signed keys", () => {
  it("grades a question the server issued", async () => {
    const res = await POST(req(body()));
    expect(res.status).toBe(200);
    expect((await res.json()).is_correct).toBe(true);
  });

  it("rejects a forged correct answer", async () => {
    const res = await POST(req(body({ correctAnswer: "banana", userAnswer: "banana" })));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_question" });
    expect(db.writes).toEqual([]);
  });

  it("rejects an altered difficulty, type, concept or question", async () => {
    for (const over of [{ difficulty: 1 }, { questionType: "fill_blank" }, { conceptId: "other" }, { question: "easy?" }]) {
      expect((await POST(req(body(over)))).status, JSON.stringify(over)).toBe(400);
    }
  });

  it("rejects a missing or malformed signature", async () => {
    expect((await POST(req(body({ answerSig: undefined })))).status).toBe(400);
    expect((await POST(req(body({ answerSig: "0".repeat(64) })))).status).toBe(400);
  });

  it("rejects unknown keys and an oversized answer", async () => {
    expect((await POST(req(body({ extra: 1 })))).status).toBe(400);
    expect((await POST(req(body({ userAnswer: "x".repeat(2001) })))).status).toBe(400);
  });
});

describe("/api/quiz/submit rate limit", () => {
  it("limits objective answers after validation and writes nothing when refused", async () => {
    rate.allowed = false;
    const res = await POST(req(body()));
    expect(res.status).toBe(429);
    expect(rate.calls).toEqual(["quiz_submit_objective"]);
    expect(db.writes).toEqual([]);
  });

  it("does not count a forged answer against the limit", async () => {
    await POST(req(body({ correctAnswer: "banana" })));
    expect(rate.calls).toEqual([]);
  });
});

describe("/api/quiz/submit writes", () => {
  it("writes mastery and the attempt with the service client only", async () => {
    await POST(req(body()));
    const writes = db.writes.map((w) => `${w.client}:${w.table}:${w.op}`);
    expect(writes).toContain("service:user_concept_mastery:upsert");
    expect(writes).toContain("service:quiz_attempts:insert");
    expect(db.writes.every((w) => w.client === "service")).toBe(true);
  });

  it("a detected misconception is recorded through the service client", async () => {
    const q = { ...Q, question_type: "short_answer" };
    assess.evaluateShortAnswer.mockResolvedValue({ is_correct: false, score: 0, feedback: "f", misconception_detected: "adds denominators" });
    await POST(req(body({ questionType: "short_answer", answerSig: signQuestion(q) })));
    expect(db.writes.some((w) => w.table === "increment_misconception" && w.client === "service")).toBe(true);
    expect(db.writes.every((w) => w.client === "service")).toBe(true);
  });
});
