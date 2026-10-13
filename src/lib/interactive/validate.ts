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
 * crude tokenizer (a regex literal holding a quote can confuse it) is fine for
 * a second layer.
 */
const LITERALS =
  /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g;

export function codeOnly(js: string): string {
  return js.replace(LITERALS, '""');
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
  [/\bwhile\s*\(\s*(true|1)\s*\)|\bfor\s*\(\s*;\s*;\s*\)/, "unbounded loop"],
];

export function validateWidget(parts: InteractiveParts): WidgetCheck {
  const { markup, css, js } = parts;

  if (markup.length + css.length + js.length > PARTS_LIMITS.total) {
    return { ok: false, reason: "too large" };
  }

  // ── markup ────────────────────────────────────────────────────────────────
  if (FORBIDDEN_TAGS.test(markup)) return { ok: false, reason: "markup: forbidden element" };
  if (/\son[a-z]+\s*=/i.test(markup)) return { ok: false, reason: "markup: inline event handler" };
  if (/<!--/.test(markup)) return { ok: false, reason: "markup: html comment" };
  if (/\bsrcdoc\s*=/i.test(markup)) return { ok: false, reason: "markup: srcdoc" };
  if (/javascript\s*:/i.test(markup) || /javascript\s*:/i.test(css)) {
    return { ok: false, reason: "javascript: url" };
  }
  // Every reference must be a fragment or an inline image.
  const markupUrls = stripAllowedUrls(markup);
  if (/(?:src|href|action|formaction|poster|xlink:href)\s*=\s*["']?\s*(?!#|data:image\/)(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(markupUrls)) {
    return { ok: false, reason: "markup: external reference" };
  }

  // ── css ───────────────────────────────────────────────────────────────────
  const cssClean = stripAllowedUrls(css);
  if (/@import\b/i.test(cssClean)) return { ok: false, reason: "css: @import" };
  if (/https?:\/\//i.test(cssClean)) return { ok: false, reason: "css: external url" };
  if (/url\s*\(\s*(?!["']?\s*(?:data:image\/|#))/i.test(cssClean)) {
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
