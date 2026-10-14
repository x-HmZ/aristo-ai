import { beforeEach, describe, expect, it, vi } from "vitest";
import { INTERACTIVE_FIXTURES } from "@/lib/interactive/fixtures";
import { createThrottle } from "@/lib/interactive/throttle";

// The agent builds its client at import time, so the mock must exist first.
const create = vi.hoisted(() => vi.fn());
vi.mock("@/lib/llm/anthropic", () => ({ getAnthropic: () => ({ messages: { create } }) }));

import { generateInteractive } from "./interactive";
import { MODELS } from "./models";

const spec = INTERACTIVE_FIXTURES[0].spec;
const good = INTERACTIVE_FIXTURES[1].parts;

const reply = (input: unknown, stop_reason = "tool_use") => ({
  stop_reason,
  content: [{ type: "tool_use", id: "t", name: "deliver_interactive", input }],
});

beforeEach(() => create.mockReset());

describe("generateInteractive", () => {
  it("returns a valid page from the first answer, with the right call shape", async () => {
    create.mockResolvedValueOnce(reply(good));
    const parts = await generateInteractive({ topic: "Fractions", spec, userId: "u1" });
    expect(parts).toEqual(good);
    expect(create).toHaveBeenCalledTimes(1);
    const [params, tag] = create.mock.calls[0];
    expect(params.model).toBe(MODELS.interactive);
    expect(params.tool_choice).toEqual({ type: "tool", name: "deliver_interactive" });
    expect(params.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(tag).toMatchObject({ feature: "lesson.interactive", userId: "u1" });
    expect(params.messages[0].content).toContain("<topic>Fractions</topic>");
  });

  it("quotes every fixture in the prompt so the examples are the standard", async () => {
    create.mockResolvedValueOnce(reply(good));
    await generateInteractive({ topic: "x", spec });
    const system: string = create.mock.calls[0][0].system[0].text;
    for (const f of INTERACTIVE_FIXTURES) expect(system).toContain(`<example id="${f.id}">`);
    expect(system).toContain("ARISTO.canvas");
  });

  it("retries once with the validator's reason when the first page is rejected", async () => {
    create
      .mockResolvedValueOnce(reply({ ...good, js: good.js + "\nfetch('/api/x');" }))
      .mockResolvedValueOnce(reply(good));
    const parts = await generateInteractive({ topic: "x", spec });
    expect(parts).toEqual(good);
    expect(create).toHaveBeenCalledTimes(2);
    const retryText: string = create.mock.calls[1][0].messages[0].content;
    expect(retryText).toContain("js: network: fetch");
    expect(create.mock.calls[1][1].feature).toBe("lesson.interactive.retry");
  });

  it("throws after two rejected answers", async () => {
    create.mockResolvedValue(reply({ ...good, markup: "<script>1</script>" }));
    await expect(generateInteractive({ topic: "x", spec })).rejects.toThrow(/no valid page/);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("treats a missing tool_use and a malformed answer as failures to retry", async () => {
    create
      .mockResolvedValueOnce({ stop_reason: "end_turn", content: [{ type: "text", text: "sorry" }] })
      .mockResolvedValueOnce(reply({ title: "x" }));
    await expect(generateInteractive({ topic: "x", spec })).rejects.toThrow(/no valid page/);
  });

  it("tells the model to shorten a page that was cut off", async () => {
    create
      .mockResolvedValueOnce(reply({ title: "x", markup: "<div>", css: "", js: "" }, "max_tokens"))
      .mockResolvedValueOnce(reply(good));
    await generateInteractive({ topic: "x", spec });
    expect(create.mock.calls[1][0].messages[0].content).toContain("cut off");
  });
});

describe("createThrottle", () => {
  it("allows the limit inside a window, then refuses, then frees up", () => {
    const t = createThrottle(2, 1000);
    expect(t.take("a", 0)).toBe(true);
    expect(t.take("a", 100)).toBe(true);
    expect(t.take("a", 200)).toBe(false);
    expect(t.take("b", 200)).toBe(true);
    expect(t.take("a", 1001)).toBe(true);
  });
});
