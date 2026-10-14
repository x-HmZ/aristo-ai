"use client";

/**
 * InteractivePreview: dev harness for the interactive-visual widgets (V10).
 *
 * Shows the three hand-written fixtures in the sandboxed frame with no API
 * call, in either theme and at a phone or desktop width, plus the two failure
 * paths (a widget that throws, a frame that never answers). Query overrides for
 * scripted checks: ?fixture=slope-line|fraction-bars|for-loop&theme=light|dark
 * &w=360&fail=throws|timeout|forbidden|probe
 *
 * ?view=room shows the real shell pieces (canvas, lesson panel, widget stage) on a
 * synthetic lesson that ends its Demonstrate phase in an explore segment.
 */

import { useEffect, useState } from "react";
import { InteractiveFrame, type FrameStatus } from "@/components/learn/InteractiveFrame";
import InteractiveRoom from "@/components/dev/InteractiveRoom";
import { DEV_MONO, DEV_PANEL, DevButton, DevSection } from "@/components/dev/devKit";
import { INTERACTIVE_FIXTURES, getFixture } from "@/lib/interactive/fixtures";
import { validateWidget } from "@/lib/interactive/validate";
import type { WidgetTheme } from "@/lib/interactive/shell";

const FAILS = [
  "none", "throws", "forbidden", "timeout", "probe", "misc", "rtc-nested", "nav-location", "nav-meta", "nav-anchor", "nav-open",
  "nav-history", "loop", "loop-recursion", "loop-async", "loop-catch", "loop-later",
] as const;
type Fail = (typeof FAILS)[number];

/**
 * Navigation and side-channel probes (security review, V10). Each tries to take the
 * frame, or something outside it, somewhere else. The target is a closed local port,
 * so nothing leaves the machine; the script watches whether a request is even made.
 * Names are built from pieces so validate.ts does not see them.
 */
const NAV_TARGET = "'ht' + 'tp://127.0.0.1:9/'";
const NAV_JS: Record<string, string> = {
  "nav-location": `window['glob' + 'alThis']['loc' + 'ation'] = ${NAV_TARGET} + 'location';`,
  "nav-meta": `var m = document.createElement('meta'); m.httpEquiv = 'refresh'; m.content = '0;url=' + ${NAV_TARGET} + 'meta'; document.head.appendChild(m);`,
  "nav-anchor": `var a = document.createElement('a'); a.href = ${NAV_TARGET} + 'anchor'; document.body.appendChild(a); a.click();`,
  "nav-open": `window['op' + 'en'](${NAV_TARGET} + 'open');`,
  "nav-history": `history.back(); history.go(-1);`,
  "misc": `
var out = {};
function t(name, fn) { try { out[name] = String(fn()); } catch (e) { out[name] = 'blocked: ' + e.name; } }
t('copy', function () { return document['exec' + 'Command']('copy'); });
t('rtc', function () { return typeof new window['RTCPeer' + 'Connection']({ iceServers: [{ urls: 'stun:127.0.0.1:9' }] }); });
t('pip', function () { return 'pictureInPictureEnabled=' + document.pictureInPictureEnabled; });
t('fullscreen', function () { return 'fullscreenEnabled=' + document.fullscreenEnabled; });
var a = document.createElement('a'); a.href = 'data:text/plain,x'; a.download = 'x.txt'; document.body.appendChild(a); a.click();
setTimeout(function () { document.getElementById('out').textContent = JSON.stringify(out); }, 600);`,
  // Every route to a nested frame, each followed by an attempt to borrow its fresh RTCPeerConnection.
  "rtc-nested": `
var out = { frames: 0 };
var W = window, D = document, CW = 'content' + 'Window', SD = 'src' + 'doc', RTC = 'RTCPeer' + 'Connection';
var IF = 'if' + 'rame', TAG = '<' + IF + '>';
function rtc(w) { return typeof new w[RTC]({ iceServers: [{ urls: 'stun:127.0.0.1:9' }] }); }
function t(name, fn) {
  try { fn(); out[name] = W.length > 0 ? 'frame made: ' + (function () { try { return rtc(W[0]); } catch (e) { return 'rtc ' + e.name; } })() : 'no frame'; }
  catch (e) { out[name] = 'blocked: ' + e.message; }
  out.frames = Math.max(out.frames, W.length);
}
var host = D.getElementById('host');
t('appendChild', function () { host.appendChild(D.createElement(IF)); });
t('append', function () { host.append(D.createElement(IF)); });
t('insertBefore', function () { host.insertBefore(D.createElement(IF), null); });
t('replaceChildren', function () { host.replaceChildren(D.createElement(IF)); });
t('after', function () { host.firstChild ? host.firstChild.after(D.createElement(IF)) : host.append(D.createTextNode('x')); host.firstChild.after(D.createElement(IF)); });
t('insertAdjacentElement', function () { host.insertAdjacentElement('beforeend', D.createElement(IF)); });
t('innerHTML', function () { host.innerHTML = TAG; });
t('innerHTML object', function () { host.innerHTML = { toString: function () { return TAG; } }; });
t('outerHTML', function () { var s = D.createElement('span'); host.appendChild(s); s.outerHTML = TAG; });
t('insertAdjacentHTML', function () { host.insertAdjacentHTML('beforeend', '<IFRAME ' + SD + '="<b>x</b>">'); });
t('fragment', function () { var f = D.createDocumentFragment(); f.appendChild(D.createElement('div')).appendChild(D.createElement(IF)); host.appendChild(f); });
t('range', function () { var r = D.createRange(); r.selectNodeContents(host); r.insertNode(D.createElement(IF)); });
t('contextual fragment', function () { var r = D.createRange(); r.selectNodeContents(host); host.appendChild(r.createContextualFragment(TAG)); });
t('DOMParser', function () { var d = new DOMParser().parseFromString('<body>' + TAG, 'text/html'); host.appendChild(D.importNode(d.body.firstChild, true)); });
t('xhtml prefix', function () { var d = new DOMParser().parseFromString('<h:' + IF + ' xmlns:h="ht' + 'tp://www.w3.org/1999/xhtml"/>', 'application/xml'); host.appendChild(D.importNode(d.documentElement, true)); });
t('svg foreignObject', function () { var s = D.createElementNS('http://www.w3.org/2000/svg', 'foreignObject'); s.appendChild(D.createElement(IF)); host.appendChild(s); });
t('object', function () { host.appendChild(D.createElement('ob' + 'ject')); });
t('embed', function () { host.appendChild(D.createElement('em' + 'bed')); });
t('shadow', function () { host['attach' + 'Shadow']({ mode: 'open' }); });
t('write', function () { D['wr' + 'ite'](TAG); });
t('body setter', function () { var b = D.createElement('body'); b.appendChild(D.createElement(IF)); D.body = b; });
t('detached handle', function () { var f = D.createElement(IF); var w = f[CW]; out.detachedHandle = String(w); });
t('own matches', function () { var f = D.createElement(IF); f.matches = function () { return false; }; Object.defineProperty(f, 'nodeType', { value: 3 }); host.appendChild(f); });
setTimeout(function () { var p = D.getElementById('out'); if (p) p.textContent = JSON.stringify(out); else D.title = JSON.stringify(out); }, 600);`,
};

/** Runaway code: each should be stopped by the loop guard (guard.ts) without freezing the page. */
const LOOP_JS: Record<string, string> = {
  "loop": "while (1 < 2) {}",
  "loop-recursion": "function f(n) { return n < 2 ? n : f(n - 1) + f(n - 2); } f(60);",
  "loop-async": "(async function () { while (1 < 2) { await 0; } })();",
  "loop-catch": "for (var k = 0; k >= 0; k++) { try { while (1 < 2) {} } catch (e) {} }",
};

/**
 * An adversarial widget: names built from string pieces so validate.ts cannot
 * see them, which is what a hostile model output would do. It attacks from its
 * own code at load and writes what the sandbox and CSP did into #out, so a
 * script can read the verdict.
 */
const PROBE_PARTS = {
  title: "Sandbox probe",
  markup: `<pre id="out">pending</pre>`,
  css: ``,
  js: `var out = { violations: [] };
function t(name, fn) { try { out[name] = String(fn()); } catch (e) { out[name] = 'blocked: ' + e.name; } }
document.addEventListener('securitypolicyviolation', function (e) { out.violations.push(e.violatedDirective); });
t('eval', function () { return window['ev' + 'al']('1+1'); });
t('newFunction', function () { return new window['Fun' + 'ction']('return 2')(); });
t('storage', function () { return window['local' + 'Storage'].length; });
t('parentDom', function () { return window['par' + 'ent'].document.body.tagName; });
t('cookie', function () { return document['coo' + 'kie']; });
window['fe' + 'tch']('ht' + 'tps://example.com/').then(function () { out.fetch = 'allowed'; }, function (e) { out.fetch = 'blocked: ' + e.name; });
var img = new Image(); img.src = 'ht' + 'tps://example.com/x.png';
var x = new window['XMLHttp' + 'Request'](); try { x.open('GET', 'ht' + 'tps://example.com/'); x.send(); } catch (e) { out.xhr = 'blocked: ' + e.name; }
setTimeout(function () { document.getElementById('out').textContent = JSON.stringify(out); }, 900);`,
};
const WIDTHS = [360, 560, 900] as const;

function FrameView() {
  const [fixtureId, setFixtureId] = useState(INTERACTIVE_FIXTURES[0].id);
  const [theme, setTheme] = useState<WidgetTheme>("light");
  const [width, setWidth] = useState<number>(560);
  const [fail, setFail] = useState<Fail>("none");
  const [log, setLog] = useState<string[]>([]);
  const [status, setStatus] = useState<FrameStatus>("loading");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const f = p.get("fixture");
    if (f && getFixture(f)) setFixtureId(f);
    const t = p.get("theme");
    if (t === "light" || t === "dark") setTheme(t);
    const w = Number(p.get("w"));
    if (w >= 280 && w <= 1400) setWidth(w);
    const x = p.get("fail");
    if (x && (FAILS as readonly string[]).includes(x)) setFail(x as Fail);
  }, []);

  // The page follows the theme too, so the frame is judged on its own ground.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const fixture = getFixture(fixtureId)!;
  const parts =
    fail === "probe"     ? PROBE_PARTS
    : fail in NAV_JS      ? { title: "Navigation probe", markup: `<pre id="out">pending</pre><div id="host"></div>`, css: "", js: NAV_JS[fail] }
    : fail in LOOP_JS     ? { ...fixture.parts, js: LOOP_JS[fail] }
    : fail === "loop-later" ? { ...fixture.parts, js: `${fixture.parts.js}\nsetTimeout(function () { while (1 < 2) {} }, 1500);` }
    : fail === "throws"    ? { ...fixture.parts, js: "throw new Error('boom from the widget');" }
    : fail === "forbidden" ? { ...fixture.parts, js: fixture.parts.js + "\nfetch('/api/learn/lesson/x');" }
    : fixture.parts;
  const check = validateWidget(parts);

  const note = (s: string) => setLog((l) => [...l.slice(-7), s]);
  useEffect(() => { setLog([]); setStatus("loading"); }, [fixtureId, theme, fail]);

  return (
    <div className="grid min-h-screen grid-cols-[minmax(0,1fr)_300px] bg-bg text-ink max-md:grid-cols-1">
      <main className="flex min-w-0 flex-col items-center gap-3 overflow-auto p-6">
        <div
          data-testid="frame-box"
          className="overflow-hidden rounded-2xl border border-line shadow-e1"
          style={{ width: Math.min(width, 1400), height: 560, maxWidth: "100%" }}
        >
          {check.ok ? (
            <InteractiveFrame
              parts={parts}
              theme={theme}
              readyTimeoutMs={fail === "timeout" ? 1 : 4000}
              onReady={() => { setStatus("ready"); note("ready"); }}
              onFail={(why) => { setStatus("failed"); note(`failed: ${why}`); }}
            />
          ) : (
            <p className="p-4 text-sm text-danger" data-testid="rejected">
              Rejected before it ran: {check.reason}
            </p>
          )}
        </div>
        <p className={DEV_MONO} data-testid="status">status: {check.ok ? status : "rejected"}</p>
      </main>

      <aside className={DEV_PANEL}>
        <h1 className="mb-3 text-sm font-semibold">/dev/interactive</h1>
        <DevSection title="Widget">
          <div className="flex flex-wrap gap-1.5">
            {INTERACTIVE_FIXTURES.map((f) => (
              <DevButton key={f.id} selected={f.id === fixtureId} onClick={() => setFixtureId(f.id)}>{f.id}</DevButton>
            ))}
          </div>
        </DevSection>
        <DevSection title="Theme">
          <div className="flex gap-1.5">
            {(["light", "dark"] as const).map((t) => (
              <DevButton key={t} selected={t === theme} onClick={() => setTheme(t)}>{t}</DevButton>
            ))}
          </div>
        </DevSection>
        <DevSection title="Width">
          <div className="flex gap-1.5">
            {WIDTHS.map((w) => (
              <DevButton key={w} selected={w === width} onClick={() => setWidth(w)}>{w}</DevButton>
            ))}
          </div>
        </DevSection>
        <DevSection title="Failure path">
          <div className="flex flex-wrap gap-1.5">
            {FAILS.map((x) => (
              <DevButton key={x} selected={x === fail} onClick={() => setFail(x)}>{x}</DevButton>
            ))}
          </div>
        </DevSection>
        <DevSection title="Spec">
          <p className={DEV_MONO}>{fixture.spec.goal}</p>
          <ul className={`${DEV_MONO} mt-2 list-disc pl-4`}>
            {fixture.spec.controls.map((c) => <li key={c.label}>{c.label} ({c.kind})</li>)}
          </ul>
        </DevSection>
        <DevSection title="Frame log">
          <pre className={DEV_MONO}>{log.join("\n") || "(none)"}</pre>
        </DevSection>
      </aside>
    </div>
  );
}

export default function InteractivePreview() {
  const [room, setRoom] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setRoom(p.get("view") === "room" ? (getFixture(p.get("fixture") ?? "")?.id ?? INTERACTIVE_FIXTURES[0].id) : null);
  }, []);
  if (room === undefined) return <div className="min-h-screen bg-bg" />;
  return room ? <InteractiveRoom fixtureId={room} /> : <FrameView />;
}
