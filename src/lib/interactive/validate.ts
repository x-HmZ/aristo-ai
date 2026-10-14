/**
 * Content checks for generated widget code.
 *
 * This is the SECOND layer. The boundary is the iframe sandbox (no
 * allow-same-origin) plus the CSP in shell.ts; this layer exists so a widget
 * that tries to leave is rejected and regenerated rather than shown half
 * working, and so the log gets a precise reason. Static pattern checks cannot
 * stop an obfuscated attempt, and are not expected to.
 */

import { PARTS_LIMITS, type InteractiveParts } from "./spec";

export type WidgetCheck = { ok: true } | { ok: false; reason: string };

/** Namespaces SVG needs; the only URLs a widget may contain. */
const ALLOWED_URLS = ["http://www.w3.org/2000/svg", "http://www.w3.org/1999/xlink"];

function stripAllowedUrls(s: string): string {
  let out = s;
  for (const u of ALLOWED_URLS) out = out.split(u).join("");
  return out;
}

/**
 * Blank out comments and string/template literals so keyword checks read code,
 * not prose: a label that says "the location of the point" must not fail. A
 * hand-written single pass, linear in the input however it is malformed (the
 * regex it replaced backtracked on unterminated input, and this runs on
 * 40 KB an attacker chose). A regex literal holding a quote can confuse it,
 * which is fine for a second layer.
 */
export function codeOnly(js: string): string {
  const n = js.length;
  let out = "";
  let i = 0;
  while (i < n) {
    const c = js[i];
    const d = js[i + 1];
    if (c === "/" && d === "/") {
      const nl = js.indexOf("\n", i);
      i = nl === -1 ? n : nl;
      out += '""';
    } else if (c === "/" && d === "*") {
      const end = js.indexOf("*/", i + 2);
      i = end === -1 ? n : end + 2;
      out += '""';
    } else if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < n && js[j] !== c && (c === "`" || js[j] !== "\n")) j += js[j] === "\\" ? 2 : 1;
      i = j < n && js[j] === c ? j + 1 : Math.min(j, n);
      out += '""';
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
}

const FORBIDDEN_TAGS =
  /<\s*(script|style|iframe|frame|frameset|object|embed|link|meta|base|form|template|portal|dialog)\b/i;

/** Checked against code with literals blanked. */
const FORBIDDEN_JS: Array<[RegExp, string]> = [
  [/\bfetch\s*\(/,                                  "network: fetch"],
  [/\bXMLHttpRequest\b/,                            "network: XMLHttpRequest"],
  [/\b(WebSocket|EventSource|WebTransport|RTCPeerConnection)\b/, "network: socket"],
  [/\bsendBeacon\b/,                                "network: sendBeacon"],
  [/\b(importScripts|Worker|SharedWorker|ServiceWorker)\b/, "workers"],
  [/\bimport\s*[(\s{*]/,                            "module import"],
  [/\beval\s*\(/,                                   "eval"],
  [/\bnew\s+Function\b|\bFunction\s*\(/,            "Function constructor"],
  [/\b(localStorage|sessionStorage|indexedDB|caches)\b/, "storage"],
  [/\bdocument\s*\.\s*cookie\b/,                    "cookies"],
  [/\bwindow\s*\.\s*open\b|(?<![.\w$])open\s*\(/,   "window.open"],
  [/(?<![.\w$])location\b|\b(?:window|document|self|top|parent)\s*\.\s*location\b/, "location"],
  [/\b(?:window|self)\s*\.\s*(?:top|parent|opener|frames)\b|(?<![.\w$])(?:top|parent|opener)\s*\./, "frame access"],
  [/\bpostMessage\b/,                               "postMessage (the bridge owns it)"],
  [/\bdocument\s*\.\s*(write|writeln)\b/,           "document.write"],
  [/\b(contentWindow|contentDocument|srcdoc|attachShadow|setHTMLUnsafe|parseHTMLUnsafe|execCommand)\b/, "nested frame or shadow DOM"],
  [/__aristo/,                                      "reserved name (the bridge owns it)"],
  [/\bwith\s*\(/,                                   "with statement"],
  [/\bwhile\s*\(\s*(true|1)\s*\)|\bfor\s*\(\s*;\s*;\s*\)/, "unbounded loop"],
];

/** An inline event handler: HTML needs no space before it (`<svg/onload=...>`, `class="x"onclick=...`). */
export const INLINE_HANDLER = /[\s"'\/]on[a-z]+\s*=/i;

export function validateWidget(parts: InteractiveParts): WidgetCheck {
  const { markup, css, js } = parts;

  if (markup.length + css.length + js.length > PARTS_LIMITS.total) {
    return { ok: false, reason: "too large" };
  }
  // No legitimate page needs a run of hundreds of blanks; it is what a slow-regex attack looks like.
  if (/\s{300,}/.test(markup + css + js)) return { ok: false, reason: "long whitespace run" };

  // ── markup ────────────────────────────────────────────────────────────────
  if (FORBIDDEN_TAGS.test(markup)) return { ok: false, reason: "markup: forbidden element" };
  if (INLINE_HANDLER.test(markup)) return { ok: false, reason: "markup: inline event handler" };
  if (/<!--/.test(markup)) return { ok: false, reason: "markup: html comment" };
  if (/\bsrcdoc\s*=/i.test(markup)) return { ok: false, reason: "markup: srcdoc" };
  if (/javascript\s*:/i.test(markup) || /javascript\s*:/i.test(css)) {
    return { ok: false, reason: "javascript: url" };
  }
  // Every reference must be a fragment or an inline image.
  const markupUrls = stripAllowedUrls(markup);
  if (/(?:src|href|action|formaction|poster|xlink:href)\s*=\s*(?:["']\s*)?(?!#|data:image\/)(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(markupUrls)) {
    return { ok: false, reason: "markup: external reference" };
  }

  // ── css ───────────────────────────────────────────────────────────────────
  const cssClean = stripAllowedUrls(css);
  if (/@import\b/i.test(cssClean)) return { ok: false, reason: "css: @import" };
  if (/https?:\/\//i.test(cssClean)) return { ok: false, reason: "css: external url" };
  if (/url\s*\((?!\s*(?:["']\s*)?(?:data:image\/|#))/i.test(cssClean)) {
    return { ok: false, reason: "css: non-data url()" };
  }

  // ── js ────────────────────────────────────────────────────────────────────
  // These can break out of the <script> element, so they are checked raw.
  if (/<\/\s*script/i.test(js) || /<!--/.test(js)) return { ok: false, reason: "js: script close tag" };
  if (/https?:\/\//i.test(stripAllowedUrls(js))) return { ok: false, reason: "js: external url" };

  const code = codeOnly(js);
  for (const [re, label] of FORBIDDEN_JS) {
    if (re.test(code)) return { ok: false, reason: `js: ${label}` };
  }

  return { ok: true };
}
