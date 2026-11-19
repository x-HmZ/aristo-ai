import { beforeEach, describe, expect, it, vi } from "vitest";

const st = vi.hoisted(() => ({ concept: null as Record<string, unknown> | null }));

function chain(table: string, kind: "user" | "service") {
  const c: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "neq", "order", "limit", "contains"]) c[m] = () => c;
  c.maybeSingle = async () => ({ data: table === "concepts" && kind === "user" ? st.concept : null, error: null });
  c.upsert = async () => ({ error: null });
  // Awaiting the chain itself (prerequisites) yields no rows.
  c.then = (res: (v: unknown) => unknown) => res({ data: [], error: null });
  return c;
}
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: (t: string) => chain(t, "user") }),
  createServiceClient: () => ({ from: (t: string) => chain(t, "service"), rpc: async () => ({ error: null }) }),
}));
vi.mock("@/lib/billing/entitlements", () => ({
  requireEntitlement: async () => ({ user: { id: "u1" }, entitlement: {}, error: null }),
  spendAllowance: async () => ({ error: null, consumed: null }),
  releaseConsumed: async () => undefined,
}));
vi.mock("@/lib/guard", () => ({ guardSpend: async () => null }));
vi.mock("@/lib/rag/retrieve", () => ({ loadConceptScope: async () => ({}), retrieveChunks: async () => ({ chunks: [] }) }));
vi.mock("@/lib/rag/credits", () => ({ loadLessonSources: async () => [] }));
vi.mock("@/lib/admin/moderation-rules", () => ({
  decideModeration: async () => ({ status: "pending" }),
  profileSignature: () => "sig",
}));
vi.mock("@/lib/agents/teaching", () => ({
  generateLesson: async () => ({ segments: [{ text: "Hello there" }], metadata: {} }),
}));

import { GET } from "@/app/api/learn/lesson/[conceptId]/route";

const call = (id: string) =>
  GET(new Request("http://x") as never, { params: Promise.resolve({ conceptId: id }) });

beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  st.concept = null;
});

describe("/api/learn/lesson narration tokens", () => {
  it("mints narration tokens for a concept in the knowledge graph", async () => {
    st.concept = { id: "fractions", name: "Fractions", description: "d", domain: "math" };
    const body = await (await call("fractions")).json();
    expect(Object.keys(body.narration_tokens ?? {}).length).toBeGreaterThan(0);
  });

  it("mints none for a free-form topic, so its narration is live and never cached", async () => {
    const res = await call("Whatever the child typed");
    expect(res.status).toBe(200);
    expect((await res.json()).narration_tokens).toBeUndefined();
  });
});
