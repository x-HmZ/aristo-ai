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

type Fail = "none" | "throws" | "forbidden" | "timeout" | "probe";

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
    if (x === "throws" || x === "timeout" || x === "forbidden" || x === "probe") setFail(x);
  }, []);

  // The page follows the theme too, so the frame is judged on its own ground.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const fixture = getFixture(fixtureId)!;
  const parts =
    fail === "probe"     ? PROBE_PARTS
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
            {(["none", "throws", "forbidden", "timeout", "probe"] as const).map((x) => (
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
