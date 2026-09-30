/**
 * Snapshot one real course's concept map for the landing page (V8.3, "It Remembers What You Know").
 *
 * Reads the course's concepts and their prerequisites and writes ids, display names, the edges between them and a
 * precomputed layout to src/data/landing/kg-snapshot.json. Nothing else leaves the database: no descriptions, no
 * user rows, no mastery (the landing's learner is an illustrative example, drawn in the component).
 *
 * Run locally only, never in CI or at build:
 *   npx tsx scripts/snapshot-kg.ts --list            courses with their concept counts
 *   npx tsx scripts/snapshot-kg.ts --course <id>     write the snapshot (at most MAX_NODES concepts)
 *
 * Keys: reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from .env.local, and tries the anon key
 * first. Only if a table it needs reads back nothing under the anon key does it use SUPABASE_SERVICE_ROLE_KEY,
 * and it says so. A key is never printed, logged or written.
 */

import dotenv from "dotenv";
import { writeFileSync } from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const ROOT = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(ROOT, ".env.local") });

const OUT = path.join(ROOT, "src", "data", "landing", "kg-snapshot.json");
const MAX_NODES = 20;
const MIN_NODES = 12;

// ─── Validation (the project has no zod; these guards are the equivalent) ─────

type Course = { id: string; title: string; is_published: boolean | null; structure: unknown };
type Concept = { id: string; name: string };
type Edge = { concept_id: string; prerequisite_id: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isStr = (v: unknown, max = 300): v is string => typeof v === "string" && v.length > 0 && v.length <= max;

function asCourses(rows: unknown): Course[] {
  if (!Array.isArray(rows)) throw new Error("courses: not an array");
  return rows.map((r) => {
    if (!isObj(r) || !isStr(r.id, 100) || !isStr(r.title)) throw new Error("courses: bad row");
    return { id: r.id, title: r.title, is_published: typeof r.is_published === "boolean" ? r.is_published : null, structure: r.structure };
  });
}
function asConcepts(rows: unknown): Concept[] {
  if (!Array.isArray(rows)) throw new Error("concepts: not an array");
  return rows.map((r) => {
    if (!isObj(r) || !isStr(r.id, 100) || !isStr(r.name, 255)) throw new Error("concepts: bad row");
    return { id: r.id, name: r.name };
  });
}
function asEdges(rows: unknown): Edge[] {
  if (!Array.isArray(rows)) throw new Error("concept_prerequisites: not an array");
  return rows.map((r) => {
    if (!isObj(r) || !isStr(r.concept_id, 100) || !isStr(r.prerequisite_id, 100)) throw new Error("concept_prerequisites: bad row");
    return { concept_id: r.concept_id, prerequisite_id: r.prerequisite_id };
  });
}

/** Concept ids in course order, from `structure.modules[].lessons[].concept_ids`. */
export function conceptIdsOf(structure: unknown): string[] {
  const out: string[] = [];
  if (!isObj(structure) || !Array.isArray(structure.modules)) return out;
  for (const m of structure.modules) {
    if (!isObj(m) || !Array.isArray(m.lessons)) continue;
    for (const l of m.lessons) {
      if (!isObj(l) || !Array.isArray(l.concept_ids)) continue;
      for (const id of l.concept_ids) if (isStr(id, 100) && !out.includes(id)) out.push(id);
    }
  }
  return out;
}

// ─── Clients: anon first ───────────────────────────────────────────────────────

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set in .env.local`);
  return v;
}
const url = env("NEXT_PUBLIC_SUPABASE_URL");
const anon = createClient(url, env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), { auth: { persistSession: false } });
let service: SupabaseClient | null = null;

/** Run `query` with the anon client; if it errors or reads back no rows, once more with the service role. */
async function read(table: string, query: (c: SupabaseClient) => PromiseLike<{ data: unknown; error: unknown }>): Promise<unknown> {
  const first = await query(anon);
  if (!first.error && Array.isArray(first.data) && first.data.length > 0) return first.data;
  console.log(`${table}: nothing readable with the anon key, using the service role (local only).`);
  service ??= createClient(url, env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const second = await query(service);
  if (second.error) throw new Error(`${table}: read failed`);
  return second.data;
}

// ─── Layout: layered by longest prerequisite path, ordered by barycentre ──────

export interface SnapshotNode { id: string; name: string; layer: number; x: number; y: number }

export function layout(ids: string[], names: Map<string, string>, edges: [string, string][]): SnapshotNode[] {
  const prereqs = new Map(ids.map((id) => [id, [] as string[]]));
  for (const [from, to] of edges) prereqs.get(to)!.push(from);
  const layer = new Map<string, number>();
  const depth = (id: string, seen: Set<string>): number => {
    if (layer.has(id)) return layer.get(id)!;
    if (seen.has(id)) return 0; // a cycle in the data; cut it rather than loop
    seen.add(id);
    const d = Math.max(-1, ...prereqs.get(id)!.map((p) => depth(p, seen))) + 1;
    layer.set(id, d);
    return d;
  };
  for (const id of ids) depth(id, new Set());
  const layers: string[][] = [];
  for (const id of ids) (layers[layer.get(id)!] ??= []).push(id);
  // Two passes of barycentre ordering against the previous layer cut most crossings.
  const pos = new Map<string, number>();
  layers.forEach((l) => l.forEach((id, i) => pos.set(id, i / Math.max(1, l.length - 1))));
  for (let pass = 0; pass < 2; pass++) {
    for (let li = 1; li < layers.length; li++) {
      const bary = (id: string) => {
        const ps = prereqs.get(id)!;
        return ps.length ? ps.reduce((a, p) => a + pos.get(p)!, 0) / ps.length : pos.get(id)!;
      };
      layers[li].sort((a, b) => bary(a) - bary(b));
      layers[li].forEach((id, i) => pos.set(id, i / Math.max(1, layers[li].length - 1)));
    }
  }
  const round = (v: number) => Math.round(v * 1000) / 1000;
  return ids.map((id) => {
    const l = layer.get(id)!;
    const count = layers[l].length;
    const i = layers[l].indexOf(id);
    return {
      id, name: names.get(id)!, layer: l,
      x: round(layers.length > 1 ? l / (layers.length - 1) : 0.5),
      y: round(count > 1 ? (i + 0.5) / count : 0.5),
    };
  });
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const courses = asCourses(await read("courses", (c) => c.from("courses").select("id, title, is_published, structure")));

  if (args.includes("--list")) {
    for (const c of courses) console.log(`${c.id}\t${c.is_published ? "published" : "draft"}\t${conceptIdsOf(c.structure).length} concepts\t${c.title}`);
    return;
  }

  const wanted = args[args.indexOf("--course") + 1];
  const course = courses.find((c) => c.id === wanted);
  if (!args.includes("--course") || !course) throw new Error("pass --course <id> (see --list)");

  const allIds = conceptIdsOf(course.structure);
  if (allIds.length < MIN_NODES) throw new Error(`${course.id} has ${allIds.length} concepts; the map wants ${MIN_NODES} or more`);
  const ids = allIds.slice(0, MAX_NODES);

  const concepts = asConcepts(await read("concepts", (c) => c.from("concepts").select("id, name").in("id", ids)));
  const names = new Map(concepts.map((c) => [c.id, c.name]));
  const present = ids.filter((id) => names.has(id));
  const edgeRows = asEdges(await read("concept_prerequisites", (c) => c.from("concept_prerequisites").select("concept_id, prerequisite_id").in("concept_id", present)));
  const edges = edgeRows
    .filter((e) => names.has(e.prerequisite_id) && present.includes(e.prerequisite_id))
    .map((e) => [e.prerequisite_id, e.concept_id] as [string, string]);

  const nodes = layout(present, names, edges);
  const snapshot = {
    note: "A real course's concepts and prerequisites (scripts/snapshot-kg.ts). No learner data: the landing's progress is an illustrative example.",
    course: { id: course.id, title: course.title },
    taken: new Date().toISOString().slice(0, 10),
    nodes,
    edges,
  };
  writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(`wrote ${path.relative(ROOT, OUT)}: ${nodes.length} concepts, ${edges.length} links, ${Math.max(...nodes.map((n) => n.layer)) + 1} layers`);
}

if (require.main === module) {
  main().catch((e) => {
    // The message only; a stack or a client error object could carry request details.
    console.error("snapshot-kg:", e instanceof Error ? e.message : "failed");
    process.exit(1);
  });
}
