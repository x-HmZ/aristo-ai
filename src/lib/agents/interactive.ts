/**
 * InteractiveAgent (V10)
 *
 * Writes one small self-contained interactive page (markup, css, js) for a
 * topic, from the spec the teaching agent chose. The page runs in the sandboxed
 * frame described in `src/lib/interactive/shell.ts`; this file only produces it.
 *
 * The prompt quotes the three hand-written fixtures as the standard to match
 * (`src/lib/interactive/fixtures.ts`), so what was approved by eye on
 * /dev/interactive is what the model is asked to write. The output is checked
 * by `validateWidget`; one invalid answer is retried once with the reason, a
 * second throws and the caller falls back to the image.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "./models";
import { getAnthropic } from "@/lib/llm/anthropic";
import {
  INTERACTIVE_PARTS_SCHEMA,
  parseInteractiveParts,
  type InteractiveParts,
  type InteractiveSpec,
} from "@/lib/interactive/spec";
import { validateWidget } from "@/lib/interactive/validate";
import { INTERACTIVE_FIXTURES } from "@/lib/interactive/fixtures";

const client = getAnthropic();

const tool: Anthropic.Tool = {
  name: "deliver_interactive",
  description: "Return the interactive page: a title, the body markup, the css and the javascript.",
  input_schema: INTERACTIVE_PARTS_SCHEMA,
};

function example(i: number): string {
  const f = INTERACTIVE_FIXTURES[i];
  return [
    `<example id="${f.id}">`,
    `<spec>${JSON.stringify(f.spec)}</spec>`,
    `<title>${f.parts.title}</title>`,
    `<markup>\n${f.parts.markup}\n</markup>`,
    `<css>\n${f.parts.css}\n</css>`,
    `<js>\n${f.parts.js}\n</js>`,
    `</example>`,
  ].join("\n");
}

const SYSTEM_PROMPT = `You write one small interactive page that helps a grade 6 to 8 learner understand a topic by changing an input and watching the result. A teacher avatar talks while the learner plays, so the page itself carries almost no text. Return it by calling deliver_interactive.

WHERE IT RUNS
- A sandboxed iframe on the learner's screen. On a laptop it is about 380 px wide and 370 px tall; the large view is up to 900 px wide. The picture AND every control must be visible without scrolling at 380 x 370. Budget it: a one-line readout (about 30 px), the picture, one .controls block (about 80 px; up to 3 controls share its row), at most one button row (about 50 px), at most one hint line, 10 px between blocks. That leaves the picture about 150 px at 360 px wide: give the canvas the ratio its content needs, 0.3 for a number line or a single row of shapes, at most 0.45 for a graph or a diagram.
- No network, no storage, no cookies, no external files, no fonts, no libraries. Plain HTML, CSS and JavaScript only. Draw with <canvas> or inline SVG, or build the picture from divs.
- Every colour comes from the kit (below). Never write a hex colour.

THE KIT (already in the page)
- CSS variables: --bg --surface --sunk --line --ink --body --muted --accent --accent-hover --accent-ink --accent-text --success --warning --danger --info.
- Classes: .stack (column of blocks), .row (wrapping row), .stage (a framed picture area), .controls (a grid of .control), .control (a label above an input), .value (the live number beside a label), .readout (a large live line of text), .hint (small muted text), .chip.
- Styled elements: button, button.primary, button[aria-pressed="true"] (a chosen option), select, input[type=range], h1 h2 h3 p.
- JavaScript: ARISTO.colors (the same palette as hex strings: bg surface sunk line ink body muted accent accentHover accentInk accentText success warning danger info) and ARISTO.canvas(canvasElement, function (ctx, w, h) { ... }, heightOverWidth) which sizes the canvas for the screen, calls your draw function in CSS pixels now and on every resize, and returns { redraw }. Call redraw() after any input changes. Use ARISTO.colors.accentText for the key line or mark: it is the accent that passes contrast. Use line for grids, muted for axes, ink and body for text.

WHAT TO BUILD
- Implement every control in the spec, labelled with EXACTLY the spec's label text, with a real <label for> tied to the input id. A "slider" is input[type=range], a "toggle" is a button with aria-pressed, a "stepper" is a button, a "choice" is a group of buttons with aria-pressed or a select.
- Show a live text readout (class readout or value) that says the current numbers or state in words, in an element with aria-live="polite". Give every canvas role="img" and an aria-label.
- The first thing the learner sees must already be meaningful: start at the spec's starting state, never empty.
- One idea only. No paragraphs of instruction: at most one short hint line. The teacher explains.
- Say each thing once: a button's own text is its label, so never put the same words in a label above it; the readout states the current state without repeating itself ("2/4 of the pizza", not "1/2 of the pizza (same as 1/2)").
- Show only what really happens. A picture of code or of a process must follow its real semantics step by step: never mark as tested, run or true anything the language or process skips (an elif or else after a branch has run, a loop body after its condition is false, a later case after a match). A learner trusts the picture more than the words, so a wrong mark teaches the misconception the lesson is fighting.
- The maths and the code must be correct. Clamp ranges, avoid dividing by zero, round displayed numbers sensibly. Text on a canvas is at least 12 px and never overlaps other text.
- Animation only when it teaches, driven by requestAnimationFrame, bounded, with a Pause button and no autoplay when matchMedia('(prefers-reduced-motion: reduce)').matches.
- Keep the whole answer under 24,000 characters.

FORBIDDEN (the page is rejected and rewritten if it contains any of these)
- In markup: <script> <style> <iframe> <link> <meta> <form> <object> <embed> <template> <dialog>, inline on... handlers, HTML comments, any src or href that is not "#..." or a data:image URI.
- In js: fetch, XMLHttpRequest, WebSocket, EventSource, import, eval, Function(), Worker, localStorage, sessionStorage, indexedDB, document.cookie, document.write, location, window.open, top, parent, opener, postMessage, while(true), for(;;), and any http or https URL (only the SVG namespace http://www.w3.org/2000/svg is allowed).
- In css: @import, a url() that is not a data:image URI.
- Never write the text "</script" or "<!--" anywhere.

THE STANDARD TO MATCH
Three finished pages follow. Match their quality, structure, density and restraint, not their topics.

${example(0)}

${example(1)}

${example(2)}`;

function userMessage(topic: string, spec: InteractiveSpec): string {
  return `<topic>${topic}</topic>
<spec>${JSON.stringify(spec)}</spec>
Build the interactive page for this topic and spec.`;
}

export async function generateInteractive(opts: {
  topic:   string;
  spec:    InteractiveSpec;
  userId?: string | null;
}): Promise<InteractiveParts> {
  const base = userMessage(opts.topic, opts.spec);
  let lastReason = "model did not return a tool_use block";

  for (let attempt = 0; attempt < 2; attempt++) {
    const retry = attempt === 1;
    const response = await client.messages.create(
      {
        model:      MODELS.interactive,
        max_tokens: 10_000,
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        tools:       [tool],
        tool_choice: { type: "tool", name: "deliver_interactive" },
        messages: [{
          role: "user",
          content: retry
            ? `${base}\n\n<correction_notice>Your previous page was rejected: ${lastReason}. Fix exactly that and keep everything else.</correction_notice>`
            : base,
        }],
      },
      {
        feature:  retry ? "lesson.interactive.retry" : "lesson.interactive",
        userId:   opts.userId ?? null,
        metadata: { topic: opts.topic.slice(0, 120) },
      },
    );

    const block = response.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") {
      lastReason = "model did not return a tool_use block";
      continue;
    }
    const parts = parseInteractiveParts(block.input);
    if (!parts) {
      lastReason = response.stop_reason === "max_tokens"
        ? "the answer was cut off; write a shorter page"
        : "the answer was missing a part or too large";
      continue;
    }
    const check = validateWidget(parts);
    if (check.ok) return parts;
    lastReason = check.reason;
    console.warn(`[InteractiveAgent] attempt ${attempt + 1}/2 rejected for "${opts.topic}": ${check.reason}`);
  }

  throw new Error(`InteractiveAgent: no valid page for "${opts.topic}" after retry (${lastReason})`);
}
