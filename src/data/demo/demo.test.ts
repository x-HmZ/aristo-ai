import { describe, expect, it } from "vitest";
import { DEMO_TOPICS } from "./index";
import * as forRange from "./python-for-range";
import { parseInteractiveParts, parseInteractiveSpec } from "@/lib/interactive/spec";
import { validateWidget } from "@/lib/interactive/validate";
import { guardWidgetParts } from "@/lib/interactive/guard";

// /demo makes no API calls, so a demo lesson that asks for an interactive must carry its frozen widget,
// and that widget must pass the same checks a generated one does before it is shown.
describe("demo interactive widgets", () => {
  // python-for-range is checked before it is listed (it waits for its narration).
  const all = [...DEMO_TOPICS, { slug: "python-for-range", lesson: forRange.lesson }];
  const withSpec = all.filter((t) => t.lesson.metadata.interactive);
  it("python-for-range carries its widget", () => expect(withSpec.map((t) => t.slug)).toContain("python-for-range"));

  it.each(withSpec.map((t) => [t.slug, t] as const))("%s carries a frozen widget that passes the checks", (_, t) => {
    expect(parseInteractiveSpec(t.lesson.metadata.interactive)).not.toBeNull();
    const parts = parseInteractiveParts(t.lesson.metadata.demo_interactive);
    expect(parts).not.toBeNull();
    expect(validateWidget(parts!)).toEqual({ ok: true });
    expect(() => guardWidgetParts(parts!)).not.toThrow();
    const explore = (t.lesson.segments ?? []).filter((s) => s.role === "explore");
    expect(explore).toHaveLength(1);
  });

  it("no demo lesson carries a widget without its spec", () => {
    for (const t of DEMO_TOPICS) {
      if (t.lesson.metadata.demo_interactive) expect(t.lesson.metadata.interactive, t.slug).toBeDefined();
    }
  });
});
