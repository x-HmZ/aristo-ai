import { parse } from "acorn";
import { describe, expect, it } from "vitest";
import { guardWidgetJs, guardWidgetParts } from "./guard";
import { INTERACTIVE_FIXTURES } from "./fixtures";
import { LOOP_GUARD } from "./shell";

const parses = (js: string) => parse(js, { ecmaVersion: "latest", sourceType: "script" });
const ticks = (js: string) => js.split(`${LOOP_GUARD}()`).length - 1;

/** Runs guarded code with a tick that throws after `limit` calls, as the bridge does once a run is too long. */
function runWithLimit(js: string, limit = 10_000): { result: unknown; stoppedAfter: number | null } {
  let n = 0;
  const tick = () => { if (++n > limit) throw new Error("stopped"); };
  try {
    const result = new Function(LOOP_GUARD, `${guardWidgetJs(js)}\n;return typeof out === "undefined" ? undefined : out;`)(tick);
    return { result, stoppedAfter: null };
  } catch (e) {
    if (e instanceof Error && e.message === "stopped") return { result: undefined, stoppedAfter: n };
    throw e;
  }
}

describe("guardWidgetJs", () => {
  it.each([
    ["while", "while (1 < 2) {}"],
    ["for", "for (var i = 0; i >= 0; i++) {}"],
    ["for without braces", "for (;;) x = 1; var x;"],
    ["do-while", "do {} while (true);"],
    ["for-of over an endless generator", "function* g() { for (;;) yield 1; } for (const v of g()) {}"],
    ["recursion", "function f() { return f() + 1; } f();"],
    ["arrow recursion", "const f = () => f(); f();"],
    ["mutual recursion", "function a() { b(); } function b() { a(); } a();"],
    ["a loop under a try that swallows", "for (;;) { try { while (true) {} } catch (e) {} }"],
  ])("stops %s", (_, js) => {
    expect(runWithLimit(js).stoppedAfter).not.toBeNull();
  });

  it("keeps finite code working the same", () => {
    const js = `
      "use strict";
      var out = [];
      for (let i = 0; i < 3; i++) out.push(i);
      for (const k in { a: 1 }) out.push(k);
      let j = 0; while (j < 2) j++; out.push(j);
      do j--; while (j > 0); out.push(j);
      const sq = (x) => x * x, obj = () => ({ v: sq(3) });
      out.push(obj().v);
      class C { #p = 2; get p() { return this.#p; } static s() { return "s"; } }
      out.push(new C().p, C.s());
      label: for (;;) { for (;;) break label; }
      out.push(async function () {} instanceof Function);`;
    expect(runWithLimit(js).result).toEqual([0, 1, 2, "a", 2, 0, 9, 2, "s", true]);
  });

  it("puts a tick in every loop and function body and still parses", () => {
    const js = "function f(){ for(;;) for(;;) g(); } const g = () => h => h; while (a) if (b) do c(); while (d);";
    const out = guardWidgetJs(js);
    expect(() => parses(out)).not.toThrow();
    expect(ticks(out)).toBe(7);
  });

  it("wraps a concise arrow body that is an object literal or a sequence", () => {
    expect(runWithLimit("var out = [(() => ({ a: 1 }))().a, (() => (1, 2))()];").result).toEqual([1, 2]);
  });

  it("keeps a function's use strict directive in force", () => {
    const out = guardWidgetJs(`function f(){ "use strict"\n return this; }`);
    expect(out).toMatch(/"use strict"\s*;/);
    expect(runWithLimit(`function f(){ "use strict"\n return this; } var out = f();`).result).toBeUndefined();
  });

  it("stops recursive construction through class field initializers", () => {
    expect(runWithLimit("class A { static d = 0; x = (A.d++ < 30) ? [new A(), new A(), A.d--] : A.d--; } new A();").stoppedAfter).not.toBeNull();
  });

  it("refuses a with statement, which could shadow the tick", () => {
    expect(() => guardWidgetJs("with ({}) { while (1 < 2) {} }")).toThrow(/with/);
  });

  it("refuses the bridge's reserved names", () => {
    expect(() => guardWidgetJs(`var ${LOOP_GUARD} = function () {};`)).toThrow(/reserved/);
    expect(() => guardWidgetJs("function f(__aristoReady) {}")).toThrow(/reserved/);
  });

  it("throws on code that does not parse", () => {
    expect(() => guardWidgetJs("for (;; {")).toThrow();
  });

  it("guards every fixture", () => {
    for (const f of INTERACTIVE_FIXTURES) {
      const out = guardWidgetJs(f.parts.js);
      expect(() => parses(out), f.id).not.toThrow();
      expect(ticks(out), f.id).toBeGreaterThan(0);
    }
  });
});

describe("guardWidgetParts", () => {
  const base = { title: "t", css: "", js: "var a = 1;" };
  it.each(["<iframe srcdoc=x>", "<IFRAME>", "<object>", "<embed src=x>", "<frameset>"])("refuses %s in markup", (m) => {
    expect(() => guardWidgetParts({ ...base, markup: `<div>${m}</div>` })).toThrow(/markup/);
  });
  it.each(['<svg/onload="for(;;);">', '<b class="x"onclick="f()">', "<i onmouseover=f()>"])("refuses the inline handler in %s", (m) => {
    expect(() => guardWidgetParts({ ...base, markup: m })).toThrow(/handler/);
  });
  it("matches frame tags as whole names only", () => {
    expect(() => guardWidgetParts({ ...base, markup: "<embedded-x></embedded-x><objective></objective>" })).not.toThrow();
    expect(() => guardWidgetParts({ ...base, markup: "<embed/>" })).toThrow(/frame|forbidden/);
  });
  it("runs the validator too, so nothing reaches the frame unchecked", () => {
    expect(() => guardWidgetParts({ ...base, markup: "<div>x</div>", js: "fetch('/x')" })).toThrow(/network/);
  });
  it("passes plain markup through", () => {
    expect(guardWidgetParts({ ...base, markup: "<div><canvas></canvas></div>" }).markup).toBe("<div><canvas></canvas></div>");
  });
});
