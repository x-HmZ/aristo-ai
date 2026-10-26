/**
 * The page a generated widget runs in.
 *
 * `buildWidgetDoc` returns the `srcdoc` for a sandboxed iframe
 * (`sandbox="allow-scripts"`, never `allow-same-origin`). Three things live here:
 *   - the CSP, which is what stops a widget from reaching the network;
 *   - the house kit (tokens, controls, `window.ARISTO` helpers) so every widget
 *     looks like the app and the generator writes less;
 *   - the bridge that tells the parent whether the widget started or threw.
 *
 * Pure string building: no DOM, so it is unit-tested in node.
 */

import type { InteractiveParts } from "./spec";

export type WidgetTheme = "light" | "dark";

/** The only window.postMessage shape the parent accepts from a widget. */
export const WIDGET_MESSAGE_TYPE = "aristo-widget";
/**
 * What the frame's bridge tells the page. `stopped`: the loop guard ended a widget that ran too long, a failure even
 * after `ready`. `escape`: Esc was pressed inside. `touch`: the learner's first pointer press inside.
 */
export type WidgetEvent = "ready" | "error" | "escape" | "stopped" | "touch";

/** The bridge's tick that guard.ts puts at the top of every loop and function body. */
export const LOOP_GUARD = "__aristoTick";

/** How long one synchronous run of widget code may last before the widget is stopped for good. */
export const WIDGET_RUN_BUDGET_MS = 1000;

/** Elements that open a nested browsing context; the bridge refuses to insert them (WebRTC, decisions.md). */
export const FRAME_TAGS = ["iframe", "frame", "frameset", "object", "embed", "fencedframe", "portal"] as const;

/** True when `html` opens one of FRAME_TAGS as a whole tag name (`<embed ` yes, `<embedded-x>` no). The bridge mirrors it. */
export function hasFrameTag(html: string): boolean {
  const l = html.toLowerCase();
  return FRAME_TAGS.some((t) => new RegExp(`<${t}(?=[\\s/>]|$)`).test(l));
}

/** `allow-scripts` alone: an opaque origin with no storage, cookies or parent access. */
export const WIDGET_SANDBOX = "allow-scripts";

/**
 * Every request type is off except inline style, data: images and ONE script: the page's own, allowed by its
 * sha256. No other script can run, so no inline handler, no script element the widget builds, no
 * `javascript:` URL, and nothing in a nested srcdoc document (it inherits this policy) except a copy of the
 * same script, which starts with the bridge. Two things are NOT governed here: navigation (navigate-to was never
 * shipped; the host page's `frame-src 'none'` in next.config.mjs does it, and InteractiveFrame unmounts a frame
 * that loads twice) and WebRTC (the `webrtc` directive is not honoured by Chromium, so the bridge removes the
 * constructors and refuses every nested frame, which would bring fresh ones).
 */
export function widgetCsp(scriptHash: string): string {
  return `default-src 'none'; script-src '${scriptHash}'; style-src 'unsafe-inline'; ` +
    "img-src data:; base-uri 'none'; form-action 'none'";
}

/** Runs that each stay under WIDGET_RUN_BUDGET_MS but add up to more than this in one window stop the widget. */
export const WIDGET_BUSY_MS = 1800;
export const WIDGET_BUSY_WINDOW_MS = 3000;

/** Mirrors the semantic tokens in src/app/globals.css (a test keeps them equal). */
export const WIDGET_TOKENS: Record<WidgetTheme, Record<string, string>> = {
  light: {
    bg: "#F3F4F6", surface: "#FCFCFD", sunk: "#EAECF0", line: "#DCDFE5",
    ink: "#0E1117", body: "#3E4452", muted: "#5A6170",
    accent: "#F97B2F", accentHover: "#FA8C47", accentInk: "#3D2110", accentText: "#A94C1B",
    success: "#166534", warning: "#92400E", danger: "#B91C1C", info: "#1D4ED8",
  },
  dark: {
    bg: "#0E1117", surface: "#151922", sunk: "#0B0D12", line: "#252B36",
    ink: "#ECEDEF", body: "#B7BDC7", muted: "#8F97A4",
    accent: "#E98A52", accentHover: "#F0A070", accentInk: "#2A160A", accentText: "#EF9A66",
    success: "#4ADE80", warning: "#FBBF24", danger: "#F87171", info: "#60A5FA",
  },
};

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

function tokenCss(theme: WidgetTheme): string {
  return Object.entries(WIDGET_TOKENS[theme]).map(([k, v]) => `--${kebab(k)}:${v};`).join("");
}

/**
 * The kit the generator is told about (interactive.ts mirrors this list):
 * .stack .row .split .stage .controls .control .readout .value .hint .chip, plus
 * styled button, button.primary, [aria-pressed], input[type=range], select.
 */
const KIT_CSS = `
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0}
body{background:var(--surface);color:var(--ink);font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:10px;-webkit-text-size-adjust:100%;min-height:100vh;display:flex;flex-direction:column;justify-content:center}
h1,h2,h3{margin:0 0 6px;font-weight:600;line-height:1.25;color:var(--ink)}
h1{font-size:18px}h2{font-size:16px}h3{font-size:15px}
p{margin:0 0 8px;color:var(--body)}
.stack{display:flex;flex-direction:column;gap:10px}
.row{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.split{display:grid;grid-template-columns:minmax(0,3fr) minmax(190px,2fr);gap:12px;align-items:center}
.split .controls{grid-template-columns:1fr}
@media (max-width:560px){.split{grid-template-columns:1fr}}
.stage{background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:8px;overflow:hidden}
.stage canvas,.stage svg{display:block;width:100%;height:auto}
.controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:2px 16px;background:var(--sunk);border-radius:12px;padding:6px 12px 2px}
.control{display:flex;flex-direction:column;gap:0;min-width:0}
.control>label,.control>.label{font-size:13px;font-weight:600;color:var(--body);display:flex;justify-content:space-between;gap:8px}
.value{font-variant-numeric:tabular-nums;color:var(--accent-text);font-weight:600}
.readout{font-variant-numeric:tabular-nums;font-size:20px;font-weight:600;color:var(--ink);overflow-wrap:anywhere}
.hint{font-size:13px;color:var(--muted)}
.chip{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:999px;background:var(--sunk);color:var(--body);font-size:13px}
button,select{font:inherit;color:var(--ink);min-height:44px;padding:0 16px;border-radius:10px;border:1px solid var(--line);background:var(--sunk);cursor:pointer}
button:hover:not(:disabled){border-color:var(--muted)}
button:disabled{opacity:.5;cursor:default}
button.primary{background:var(--accent);color:var(--accent-ink);border-color:transparent;font-weight:600}
button.primary:hover:not(:disabled){background:var(--accent-hover)}
button[aria-pressed="true"]{background:var(--accent);color:var(--accent-ink);border-color:transparent;font-weight:600}
select{padding-right:8px}
input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:44px;margin:0;background:transparent;cursor:pointer}
input[type=range]::-webkit-slider-runnable-track{height:4px;border-radius:2px;background:var(--muted)}
input[type=range]::-moz-range-track{height:4px;border-radius:2px;background:var(--muted)}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:24px;height:24px;margin-top:-10px;border-radius:50%;background:var(--accent);border:2px solid var(--surface);box-shadow:0 0 0 1px var(--accent-text)}
input[type=range]::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:var(--accent);border:2px solid var(--surface);box-shadow:0 0 0 1px var(--accent-text)}
:focus-visible{outline:2px solid var(--accent-text);outline-offset:2px;border-radius:6px}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`.trim();

/** Runs first: reports errors to the parent and exposes window.ARISTO. */
function bridgeJs(theme: WidgetTheme): string {
  const colors = JSON.stringify(WIDGET_TOKENS[theme]);
  return `
(function(){
  var failed=false,P=window.parent,Err=Error,Str=String;
  /* P is captured: window.parent is replaceable, and a widget that swapped it could hide its own failure. */
  function post(ev,msg){try{P.postMessage({type:${JSON.stringify(WIDGET_MESSAGE_TYPE)},event:ev,message:msg||''},'*');}catch(e){}}
  window.addEventListener('error',function(e){failed=true;post('error',String(e&&e.message||'error'));});
  window.addEventListener('unhandledrejection',function(e){failed=true;post('error',String(e&&e.reason||'rejected'));});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')post('escape');});
  /* The learner's first touch: the teacher lowers an arm that was pointing at the screen. Captured on the document, so most widgets cannot stop it; a widget that does only keeps the arm up. */
  document.addEventListener('pointerdown',function(){post('touch');},{capture:true,once:true});
  ['RTCPeerConnection','webkitRTCPeerConnection','RTCDataChannel','RTCSessionDescription','RTCIceTransport'].forEach(function(n){
    try{Object.defineProperty(window,n,{value:undefined,configurable:false,writable:false});}catch(e){}
  });
  var apply=Reflect.apply,gopd=Object.getOwnPropertyDescriptor,dp=Object.defineProperty;
  function lock(o,n,v){dp(o,n,{value:v,writable:false,configurable:false,enumerable:false});}

  /* Loop guard: guard.ts calls this at the top of every loop and function body. One synchronous run
     (armed until a MessageChannel task, which hidden tabs do not throttle, marks the next turn) may last
     ${WIDGET_RUN_BUDGET_MS} ms; past that the widget is stopped for good and every later tick throws. Runs that
     each stay under the budget but add up to more than ${WIDGET_BUSY_MS} ms in any ${WIDGET_BUSY_WINDOW_MS} ms
     window (a busy loop split across tasks) are stopped too. */
  var now=performance.now.bind(performance),armed=false,t0=0,last=0,w0=0,busy=0,dead=false;
  var turn=new MessageChannel(),send=MessagePort.prototype.postMessage,port=turn.port2;
  function kill(why){if(!dead){dead=true;failed=true;post('stopped',why);}}
  turn.port1.onmessage=function(){
    armed=false;
    if(t0-w0>${WIDGET_BUSY_WINDOW_MS}){w0=t0;busy=0;}
    busy+=last-t0;
    if(busy>${WIDGET_BUSY_MS})kill('too busy');
  };
  lock(window,${JSON.stringify(LOOP_GUARD)},function(){
    if(dead)throw new Err('widget stopped');
    var t=now();last=t;
    if(!armed){armed=true;t0=t;apply(send,port,[0]);return;}
    if(t-t0>${WIDGET_RUN_BUDGET_MS}){kill('ran too long');throw new Err('widget stopped');}
  });

  /* No nested frames: a child about:blank or srcdoc document would bring a fresh RTCPeerConnection.
     Every way to put an element in the document checks for one first, using built-ins captured
     here, before the widget runs; the HTML-string ways check the text, converted once. */
  try{
    var SEL=${JSON.stringify(FRAME_TAGS.join(","))},TAGS=${JSON.stringify(FRAME_TAGS.map((t) => `<${t}`))};
    var nodeType=gopd(Node.prototype,'nodeType').get,matches=Element.prototype.matches;
    var eqs=Element.prototype.querySelector,fqs=DocumentFragment.prototype.querySelector;
    var lower=String.prototype.toLowerCase,indexOf=String.prototype.indexOf;
    var refuse=function(){throw new Err('nested frames are not allowed');};
    var isNode=function(n){try{apply(nodeType,n,[]);return true;}catch(e){return false;}};
    var hasFrame=function(n){
      var t;try{t=apply(nodeType,n,[]);}catch(e){return false;}
      if(t===1)return apply(matches,n,[SEL])||apply(eqs,n,[SEL])!==null;
      if(t===11)return apply(fqs,n,[SEL])!==null;
      return false;
    };
    /* Objects that are not nodes become strings HERE, before the check: left to the built-in, their
       toString would run widget code after it (and could slip a frame into an argument already checked). */
    var nodes=function(a){
      var out=[];
      for(var i=0;i<a.length;i++){
        var v=a[i];
        if(v!==null&&(typeof v==='object'||typeof v==='function')&&!isNode(v))v=Str(v);
        if(hasFrame(v))refuse();
        dp(out,i,{value:v,writable:true,enumerable:true,configurable:true});
      }
      return out;
    };
    /* Backstop whatever the route: after every wrapped call and on every mutation, any frame element in the
       document is removed and the widget stopped. A srcdoc child commits in a later task, so this runs first. */
    var qsa=Document.prototype.querySelectorAll,rm=Element.prototype.remove;
    var nlLen=gopd(NodeList.prototype,'length').get,nlItem=NodeList.prototype.item;
    var lenD=gopd(window,'length'),frames=lenD&&lenD.get?function(){return apply(lenD.get,window,[]);}:function(){return 0;};
    var sweep=function(){
      var l=apply(qsa,document,[SEL]),n=apply(nlLen,l,[]);
      for(var i=0;i<n;i++)apply(rm,apply(nlItem,l,[i]),[]);
      if(n||frames())kill('nested frame');
    };
    apply(MutationObserver.prototype.observe,new MutationObserver(sweep),[document,{childList:true,subtree:true}]);
    var html=function(v){
      var s=v===null?'':''+v,l=apply(lower,s,[]);
      for(var i=0;i<TAGS.length;i++){var at=0;while((at=apply(indexOf,l,[TAGS[i],at]))!==-1){at+=TAGS[i].length;var c=l.charAt(at);if(c===''||c==='>'||c==='/'||c===' '||c==='\\t'||c==='\\n'||c==='\\r'||c==='\\f')refuse();}}
      return s;
    };
    var wrap=function(o,n,pre){
      var d=o&&gopd(o,n);if(!d||typeof d.value!=='function')return;var f=d.value;
      lock(o,n,function(){var r=apply(f,this,pre(arguments));sweep();return r;});
    };
    var wrapSet=function(o,n,pre){
      var d=o&&gopd(o,n);if(!d||!d.set)return;var s=d.set;
      dp(o,n,{get:d.get,set:function(v){apply(s,this,[pre(v)]);sweep();},configurable:false,enumerable:d.enumerable});
    };
    var one=function(v){return nodes([v])[0];};
    var block=function(o,n){if(o&&gopd(o,n))lock(o,n,refuse);};
    var nul=function(o,n){if(o&&gopd(o,n))dp(o,n,{get:function(){return null;},configurable:false});};
    ['appendChild','insertBefore','replaceChild'].forEach(function(n){wrap(Node.prototype,n,nodes);});
    [Element.prototype,Document.prototype,DocumentFragment.prototype,CharacterData.prototype,DocumentType.prototype].forEach(function(o){
      ['append','prepend','replaceChildren','moveBefore','before','after','replaceWith','insertAdjacentElement'].forEach(function(n){wrap(o,n,nodes);});
    });
    wrap(Range.prototype,'insertNode',nodes);wrap(Range.prototype,'surroundContents',nodes);
    wrapSet(Document.prototype,'body',one);
    ['caption','tHead','tFoot'].forEach(function(n){wrapSet(HTMLTableElement.prototype,n,one);});
    wrap(HTMLSelectElement.prototype,'add',nodes);
    wrapSet(Element.prototype,'innerHTML',html);wrapSet(Element.prototype,'outerHTML',html);
    wrap(Element.prototype,'insertAdjacentHTML',function(a){return[a[0],html(a[1])];});
    wrap(Element.prototype,'setHTML',function(a){return[html(a[0]),a[1]];});
    block(Element.prototype,'setHTMLUnsafe');block(Element.prototype,'attachShadow');block(Document,'parseHTMLUnsafe');
    block(Document.prototype,'write');block(Document.prototype,'writeln');block(Document.prototype,'execCommand');
    [window.HTMLIFrameElement,window.HTMLFrameElement,window.HTMLObjectElement,window.HTMLEmbedElement].forEach(function(c){
      if(!c)return;nul(c.prototype,'contentWindow');nul(c.prototype,'contentDocument');block(c.prototype,'getSVGDocument');
    });
  }catch(e){failed=true;post('error','bridge setup');}

  window.__aristoReady=function(){if(!failed)post('ready');};
  window.ARISTO={
    theme:${JSON.stringify(theme)},
    colors:${colors},
    /* Sizes a canvas to its CSS width for the screen's pixel ratio and calls
       draw(ctx,w,h) in CSS pixels now and whenever the width changes.
       Returns {redraw}. Call redraw() after any control changes. */
    canvas:function(el,draw,ratio){
      var ctx=el.getContext('2d');var r=ratio||0.6;var cw=0;
      function size(){
        var w=Math.max(160,Math.floor(el.getBoundingClientRect().width||el.parentNode.clientWidth||320));
        var h=Math.round(w*r);var d=window.devicePixelRatio||1;
        el.style.height=h+'px';el.width=Math.round(w*d);el.height=Math.round(h*d);
        ctx.setTransform(d,0,0,d,0,0);cw=w;return[w,h];
      }
      function redraw(){var s=size();ctx.clearRect(0,0,s[0],s[1]);draw(ctx,s[0],s[1]);}
      if(window.ResizeObserver){new ResizeObserver(function(){
        var w=Math.floor(el.getBoundingClientRect().width);if(w&&w!==cw)redraw();}).observe(el);}
      /* The first draw waits a microtask, so a draw function may use the object this call returns. */
      queueMicrotask(redraw);return{redraw:redraw};
    }
  };
})();`.trim();
}

const READY_JS = "setTimeout(function(){window.__aristoReady&&window.__aristoReady();},60);";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Defence in depth: validate.ts rejects this already; a stray one must not end the element. */
const safeScript = (s: string) => s.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--");

/**
 * The page's one script: the bridge, then the widget in its own function scope (a top-level `var history = []`,
 * the 2026-10-14 live test, would otherwise hit window.history; the same for name, status, length, top...), then
 * the ready ping. Line breaks are normalised and NULs replaced as the HTML parser would, so the hash matches.
 */
export function widgetScript(js: string, theme: WidgetTheme): string {
  return [bridgeJs(theme), `(function(){\n${safeScript(js)}\n})();`, READY_JS]
    .join("\n")
    .replace(/\r\n?/g, "\n")
    .replace(/\0/g, "�");
}

/** CSP source for a script: 'sha256-<base64>'. Web Crypto, so it runs in the browser and in node tests. */
export async function scriptHash(script: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(script));
  let bin = "";
  for (const b of new Uint8Array(digest)) bin += String.fromCharCode(b);
  return `sha256-${btoa(bin)}`;
}

export async function buildWidgetDoc(parts: InteractiveParts, theme: WidgetTheme): Promise<string> {
  const script = widgetScript(parts.js, theme);
  const csp = widgetCsp(await scriptHash(script));
  return [
    "<!doctype html>",
    `<html lang="en"><head><meta charset="utf-8">`,
    `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
    `<meta name="viewport" content="width=device-width,initial-scale=1">`,
    `<meta name="color-scheme" content="${theme}">`,
    `<meta name="referrer" content="no-referrer">`,
    `<title>${escapeHtml(parts.title)}</title>`,
    `<style>:root{color-scheme:${theme};${tokenCss(theme)}}${KIT_CSS}</style>`,
    `<style>${parts.css.replace(/<\/style/gi, "<\\/style")}</style>`,
    `</head><body>`,
    `<main id="app">${parts.markup}</main>`,
    `<script>${script}</script>`,
    `</body></html>`,
  ].join("\n");
}

/** Read a window message from a widget; null for anything else. */
export function parseWidgetMessage(data: unknown): { event: WidgetEvent; message: string } | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (d.type !== WIDGET_MESSAGE_TYPE) return null;
  if (d.event !== "ready" && d.event !== "error" && d.event !== "escape" && d.event !== "stopped" && d.event !== "touch") return null;
  return { event: d.event, message: typeof d.message === "string" ? d.message.slice(0, 300) : "" };
}
