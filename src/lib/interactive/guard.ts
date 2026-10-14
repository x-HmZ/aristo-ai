/**
 * Loop protection for generated widget code.
 *
 * A widget that loops forever (`while (1 < 2) {}`) would freeze the whole tab
 * wherever the browser keeps a sandboxed frame in the page's own process. This
 * rewrites the widget's script so every loop body and every function body
 * starts with a call to the bridge's tick (shell.ts), which ends the widget once
 * one synchronous run has lasted longer than WIDGET_RUN_BUDGET_MS. Functions
 * are guarded too, so runaway recursion is caught the same way.
 *
 * InteractiveFrame runs this on every widget before it is shown, whatever its
 * source (the API, the cache, a frozen /demo entry, a fixture); it is loaded
 * lazily there so acorn stays out of the page's first load.
 *
 * What it cannot stop: a single built-in call that runs long by itself (a
 * catastrophic regex, a huge allocation). See decisions.md.
 */

import { parse } from "acorn";
import { FRAME_TAGS, LOOP_GUARD } from "./shell";
import type { InteractiveParts } from "./spec";

const TICK = `${LOOP_GUARD}();`;
const RESERVED = "__aristo";

interface AstNode {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

/** One inserted piece of text; `pair` is the other end of a wrap, used to order ties. */
interface Edit {
  pos:  number;
  text: string;
  kind: "open" | "close";
  pair: number;
}

const LOOPS = new Set(["ForStatement", "ForInStatement", "ForOfStatement", "WhileStatement", "DoWhileStatement"]);
const FUNCTIONS = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"]);

const isNode = (v: unknown): v is AstNode =>
  typeof v === "object" && v !== null && typeof (v as AstNode).type === "string";

/** Insert the tick at the top of a block, after any directive prologue ("use strict"). */
function tickInBlock(block: AstNode, edits: Edit[], directives: boolean) {
  let pos = block.start + 1;
  if (directives) {
    for (const stmt of block.body as AstNode[]) {
      if (stmt.type !== "ExpressionStatement" || typeof stmt.directive !== "string") break;
      pos = stmt.end;
    }
  }
  edits.push({ pos, text: `;${TICK}`, kind: "open", pair: block.end });
}

function guardBody(body: AstNode, edits: Edit[], isFunction: boolean) {
  if (body.type === "BlockStatement") {
    tickInBlock(body, edits, isFunction);
  } else if (isFunction) {
    // Concise arrow body: `x => expr` becomes `x => (tick(), expr)`.
    edits.push({ pos: body.start, text: `(${LOOP_GUARD}(),`, kind: "open", pair: body.end });
    edits.push({ pos: body.end, text: ")", kind: "close", pair: body.start });
  } else {
    // Loop body without braces: `for (;;) x;` becomes `for (;;) {tick(); x;}`.
    edits.push({ pos: body.start, text: `{${TICK}`, kind: "open", pair: body.end });
    edits.push({ pos: body.end, text: "}", kind: "close", pair: body.start });
  }
}

function walk(node: AstNode, edits: Edit[]) {
  if ((node.type === "Identifier" || node.type === "PrivateIdentifier") &&
      typeof node.name === "string" && node.name.startsWith(RESERVED)) {
    throw new Error(`reserved name ${node.name}`);
  }
  if (LOOPS.has(node.type)) guardBody(node.body as AstNode, edits, false);
  else if (FUNCTIONS.has(node.type)) guardBody(node.body as AstNode, edits, true);

  for (const key in node) {
    if (key === "type" || key === "start" || key === "end") continue;
    const v = node[key];
    if (Array.isArray(v)) {
      for (const item of v) if (isNode(item)) walk(item, edits);
    } else if (isNode(v)) {
      walk(v, edits);
    }
  }
}

/**
 * Ties at one position: closes before opens; inner closes before outer ones
 * (the later open is the inner one); outer opens before inner ones.
 */
function byPosition(a: Edit, b: Edit): number {
  if (a.pos !== b.pos) return a.pos - b.pos;
  if (a.kind !== b.kind) return a.kind === "close" ? -1 : 1;
  return b.pair - a.pair;
}

/**
 * What InteractiveFrame shows. The markup is parsed before the bridge runs, so a nested frame in it would
 * get past the bridge's insertion checks; validate.ts rejects one, and this refuses it again on the client.
 */
export function guardWidgetParts(parts: InteractiveParts): InteractiveParts {
  const markup = parts.markup.toLowerCase();
  for (const tag of FRAME_TAGS) {
    if (markup.includes(`<${tag}`)) throw new Error(`markup: <${tag}>`);
  }
  return { ...parts, js: guardWidgetJs(parts.js) };
}

/** Throws on code that does not parse (it would not run either) or that uses a reserved name. */
export function guardWidgetJs(js: string): string {
  const ast = parse(js, { ecmaVersion: "latest", sourceType: "script" }) as unknown as AstNode;
  const edits: Edit[] = [];
  walk(ast, edits);
  edits.sort(byPosition);

  let out = "";
  let at = 0;
  for (const e of edits) {
    out += js.slice(at, e.pos) + e.text;
    at = e.pos;
  }
  return out + js.slice(at);
}
