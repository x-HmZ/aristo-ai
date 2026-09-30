import { useMemo, useRef, useState, type PointerEvent } from "react";
import { cn } from "@/lib/utils";
import { SHAPE } from "@/lib/design/shape";
import { MAP_COPY } from "../content";
import {
  COURSE, CURVE_DAYS, CURVE_REVIEWS, EDGES, NEWEST, NODES, REVIEWS, dayAt, masteryAt, pulseAt, recallOn, routeTo, stateAt,
} from "../mapStory";
import { Pinned, show, useStageWriter } from "../Pinned";
import { seg, window01 } from "../stage/timeline";

// The map's drawing box. Nodes sit on the snapshot's precomputed layout.
const W = 1000, H = 560;
const px = (x: number) => 50 + x * 900;
const py = (y: number) => 34 + y * 492;
const pos = new Map(NODES.map((n) => [n.id, [px(n.x), py(n.y)] as const]));
const R = 13;

// The curve's plot box.
const CW = 520, CH = 300, L = 46, RGT = 506, TOP = 18, BOT = 250;
const cx = (day: number) => L + (day / CURVE_DAYS) * (RGT - L);
const cy = (v: number) => BOT - v * (BOT - TOP);
const CURVE_PATH = (() => {
  let d = "";
  for (let i = 0; i <= CURVE_DAYS * 20; i++) {
    const day = i / 20;
    d += `${i ? "L" : "M"}${cx(day).toFixed(1)} ${cy(recallOn(day)).toFixed(1)}`;
  }
  return d;
})();
const CURVE_CONCEPT = NODES.find((n) => /^strings$/i.test(n.name))?.name ?? NODES[4].name;

/**
 * It Remembers What You Know (pinned; Hmz picked the editorial split, V8.3 plan 7C). Left, a real course's concept
 * map where an example learner's mastery fills each concept's ring, three fade and are pulled back by review
 * pulses travelling back along the links. Right, one concept's recall over three weeks: each review lifts it, and
 * it fades more slowly after each. Both are labelled as an example learner. No 3D here: the room has faded out.
 */
export function MapStory() {
  const head = useRef<HTMLDivElement>(null);
  const figs = useRef<HTMLDivElement>(null);
  const arcs = useRef<(SVGCircleElement | null)[]>([]);
  const nodes = useRef<(SVGGElement | null)[]>([]);
  const edges = useRef<(SVGLineElement | null)[]>([]);
  const pulses = useRef<(SVGCircleElement | null)[]>([]);
  const now = useRef<SVGTextElement>(null);
  const day = useRef<HTMLSpanElement>(null);
  const curve = useRef<SVGPathElement>(null);
  const marks = useRef<(SVGCircleElement | null)[]>([]);
  const last = useRef<{ arcs: number[]; states: string[]; edges: boolean[]; day: number }>({ arcs: [], states: [], edges: [], day: 0 });
  const [hover, setHover] = useState<{ day: number; x: number; y: number } | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  const routes = useMemo(() => REVIEWS.map((r) => routeTo(NEWEST, r.id).map((id) => pos.get(id)!)), []);

  useStageWriter((f) => {
    const p = f.progress[4];
    show(head.current, window01(p, 0.0, 1, 0.04), 14 * (1 - seg(p, 0, 0.06)));
    show(figs.current, window01(p, 0.03, 1, 0.05));
    const lst = last.current;
    let learning: (typeof NODES)[number] | null = null;
    NODES.forEach((n, i) => {
      const m = Math.round(masteryAt(n.id, p) * 200) / 200;
      if (lst.arcs[i] !== m) { lst.arcs[i] = m; const a = arcs.current[i]; if (a) a.style.strokeDashoffset = String(1 - m); }
      const s = stateAt(n.id, p);
      if (lst.states[i] !== s) { lst.states[i] = s; const g = nodes.current[i]; if (g) g.dataset.state = s; }
      if (m > 0.05 && m < 0.9) learning = n;
    });
    EDGES.forEach(([a, b], i) => {
      const lit = masteryAt(a, p) >= 0.5 && masteryAt(b, p) >= 0.5;
      if (lst.edges[i] !== lit) { lst.edges[i] = lit; const e = edges.current[i]; if (e) e.dataset.lit = lit ? "1" : "0"; }
    });
    // The concept being learned right now gets its name.
    const t = now.current;
    if (t) {
      const L0 = learning as (typeof NODES)[number] | null;
      if (L0) {
        const [x, y] = pos.get(L0.id)!;
        if (t.textContent !== L0.name) t.textContent = L0.name;
        t.setAttribute("x", String(Math.min(x, W - 180)));
        t.setAttribute("y", String(y - 24));
        t.style.opacity = "1";
      } else t.style.opacity = "0";
    }
    REVIEWS.forEach((_, i) => {
      const c = pulses.current[i];
      if (!c) return;
      const k = pulseAt(i, p);
      if (k === null) { c.style.opacity = "0"; return; }
      const route = routes[i];
      const segs = route.length - 1;
      const at = k * segs, j = Math.min(segs - 1, Math.floor(at)), u = at - j;
      c.setAttribute("cx", (route[j][0] + (route[j + 1][0] - route[j][0]) * u).toFixed(1));
      c.setAttribute("cy", (route[j][1] + (route[j + 1][1] - route[j][1]) * u).toFixed(1));
      c.style.opacity = "1";
    });
    const d = dayAt(p);
    if (d !== lst.day && day.current) { lst.day = d; day.current.textContent = String(d); }
    // The curve draws with the days.
    const reveal = seg(p, 0.1, 0.95);
    if (curve.current) curve.current.style.strokeDashoffset = String(1 - reveal);
    CURVE_REVIEWS.forEach((r, i) => { const m = marks.current[i]; if (m) m.style.opacity = reveal * CURVE_DAYS >= r ? "1" : "0"; });
  });

  const onCurve = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * CW;
    const d = Math.max(0, Math.min(CURVE_DAYS, ((x - L) / (RGT - L)) * CURVE_DAYS));
    setHover({ day: d, x: cx(d), y: cy(recallOn(d)) });
  };

  return (
    <Pinned id="map" labelledBy="map-title">
      <div className="relative mx-auto flex h-full w-full max-w-6xl flex-col gap-5 px-5 pb-6 pt-[92px] sm:px-8 lg:gap-7">
        <div ref={head} className="landing-beat flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <div className="max-w-[560px]">
            <h2 id="map-title" className="text-[28px] font-extrabold leading-[1.08] tracking-[-0.02em] text-ink sm:text-4xl">{MAP_COPY.title}</h2>
            <p className="mt-3 text-base leading-relaxed text-body sm:text-[17px]">{MAP_COPY.line}</p>
          </div>
          <p className="flex items-center gap-3 text-sm text-muted">
            <span className={cn(SHAPE.pill, "landing-motion-only inline-flex items-center gap-1.5 border border-line bg-surface px-3 py-1 font-semibold text-ink")}>
              Day <span ref={day} className="tabular-nums">1</span>
            </span>
            <span className="max-w-[340px]">{MAP_COPY.label}</span>
          </p>
        </div>

        <div ref={figs} className="landing-beat grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-8">
          <figure className={cn(SHAPE.surface, "flex min-h-0 flex-col border border-line bg-surface p-4 sm:p-5")}>
            <figcaption className="text-sm font-semibold text-ink">
              The map: {COURSE} <span className="font-normal text-muted">(first {NODES.length} concepts)</span>
            </figcaption>
            <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 min-h-0 w-full flex-1" role="group" aria-label={`Concept map of ${COURSE}`}>
              <g>
                {EDGES.map(([a, b], i) => {
                  const [x1, y1] = pos.get(a)!, [x2, y2] = pos.get(b)!;
                  return (
                    <line key={a + b} ref={(el) => { edges.current[i] = el; }} data-lit="0" x1={x1} y1={y1} x2={x2} y2={y2}
                      className="stroke-line transition-[stroke] duration-slow data-[lit='1']:stroke-accent-text/60" strokeWidth={2} />
                  );
                })}
              </g>
              {NODES.map((n, i) => {
                const [x, y] = pos.get(n.id)!;
                return (
                  <g
                    key={n.id}
                    ref={(el) => { nodes.current[i] = el; }}
                    data-state="later"
                    tabIndex={0}
                    role="img"
                    aria-label={n.name}
                    className="group cursor-default outline-none"
                    onPointerEnter={() => setFocus(n.id)}
                    onPointerLeave={() => setFocus(null)}
                    onFocus={() => setFocus(n.id)}
                    onBlur={() => setFocus(null)}
                  >
                    <circle cx={x} cy={y} r={24} className="fill-transparent" />
                    <circle cx={x} cy={y} r={R} className="fill-surface stroke-line" strokeWidth={2} />
                    <circle
                      ref={(el) => { arcs.current[i] = el; }}
                      cx={x} cy={y} r={R} pathLength={1}
                      className="fill-none stroke-accent-text" strokeWidth={3.5} strokeLinecap="round"
                      transform={`rotate(-90 ${x} ${y})`}
                      style={{ strokeDasharray: 1, strokeDashoffset: 1 }}
                    />
                    <circle cx={x} cy={y} r={5}
                      className="fill-line transition-[fill] duration-slow group-data-[state=done]:fill-accent-text group-data-[state=ready]:fill-surface group-data-[state=ready]:stroke-accent-text"
                      strokeWidth={2} />
                    <circle cx={x} cy={y} r={R + 6} className="landing-ready-halo fill-none stroke-accent-text opacity-0 group-data-[state=ready]:opacity-60" strokeWidth={1.5} />
                    <circle cx={x} cy={y} r={R + 5} className="fill-none stroke-ink opacity-0 group-focus-visible:opacity-100" strokeWidth={2} />
                  </g>
                );
              })}
              {REVIEWS.map((r, i) => (
                <circle key={r.id} ref={(el) => { pulses.current[i] = el; }} r={6} className="fill-accent-text" style={{ opacity: 0, filter: "drop-shadow(0 0 6px rgb(var(--glow) / 0.9))" }} />
              ))}
              <text ref={now} className="fill-ink text-[22px] font-semibold" style={{ opacity: 0 }} aria-hidden />
              {focus && (() => {
                const n = NODES.find((x) => x.id === focus)!;
                const [x, y] = pos.get(n.id)!;
                const w = n.name.length * 11.5 + 28;
                const lx = Math.max(4, Math.min(W - w - 4, x - w / 2));
                return (
                  <g pointerEvents="none" aria-hidden>
                    <rect x={lx} y={y + 22} width={w} height={36} rx={10} className="fill-bg stroke-line" strokeWidth={1.5} />
                    <text x={lx + 14} y={y + 46} className="fill-ink text-[20px] font-semibold">{n.name}</text>
                  </g>
                );
              })()}
            </svg>
          </figure>

          <figure className={cn(SHAPE.surface, "flex min-h-0 flex-col border border-line bg-surface p-4 sm:p-5")}>
            <figcaption>
              <span className="block text-sm font-semibold text-ink">{MAP_COPY.curveTitle}: {CURVE_CONCEPT}</span>
              <span className="mt-1 block text-sm text-body">{MAP_COPY.curveLine}</span>
            </figcaption>
            <svg
              viewBox={`0 0 ${CW} ${CH}`}
              className="mt-3 min-h-0 w-full flex-1 touch-none"
              aria-hidden
              onPointerMove={onCurve}
              onPointerLeave={() => setHover(null)}
            >
              {[0, 0.5, 1].map((v) => (
                <g key={v}>
                  <line x1={L} x2={RGT} y1={cy(v)} y2={cy(v)} className="stroke-line" strokeWidth={1} />
                  <text x={L - 8} y={cy(v) + 5} textAnchor="end" className="fill-muted text-[13px]">{v * 100}%</text>
                </g>
              ))}
              {[0, 7, 14, 21].map((d) => (
                <text key={d} x={cx(d)} y={BOT + 22} textAnchor="middle" className="fill-muted text-[13px]">Day {d}</text>
              ))}
              <path ref={curve} d={CURVE_PATH} pathLength={1} className="fill-none stroke-accent-text" strokeWidth={2.5} strokeLinejoin="round"
                style={{ strokeDasharray: 1, strokeDashoffset: 1 }} />
              {CURVE_REVIEWS.map((d, i) => (
                <circle key={d} ref={(el) => { marks.current[i] = el; }} cx={cx(d)} cy={cy(1)} r={5} className="fill-accent-text stroke-surface" strokeWidth={2} style={{ opacity: 0 }} />
              ))}
              <text x={cx(CURVE_REVIEWS[1]) + 8} y={cy(1) + 18} className="fill-body text-[13px]">review</text>
              {hover && (
                <g pointerEvents="none">
                  <line x1={hover.x} x2={hover.x} y1={TOP} y2={BOT} className="stroke-muted" strokeWidth={1} strokeDasharray="3 3" />
                  <circle cx={hover.x} cy={hover.y} r={5} className="fill-surface stroke-ink" strokeWidth={2} />
                  <g transform={`translate(${Math.min(hover.x + 10, RGT - 128)} ${Math.max(TOP, hover.y - 44)})`}>
                    <rect width={124} height={34} rx={8} className="fill-bg stroke-line" strokeWidth={1} />
                    <text x={10} y={22} className="fill-ink text-[13px] font-semibold">
                      Day {hover.day.toFixed(0)}: {Math.round(recallOn(hover.day) * 100)}%
                    </text>
                  </g>
                </g>
              )}
            </svg>
            <table className="sr-only">
              <caption>Recall of {CURVE_CONCEPT} for an example learner, by day</caption>
              <thead><tr><th>Day</th><th>Recall</th></tr></thead>
              <tbody>
                {[0, 1, 2, 4, 6, 9, 13, 17, 21].map((d) => (
                  <tr key={d}><td>{d}</td><td>{Math.round(recallOn(d) * 100)}%</td></tr>
                ))}
              </tbody>
            </table>
          </figure>
        </div>
      </div>
    </Pinned>
  );
}
