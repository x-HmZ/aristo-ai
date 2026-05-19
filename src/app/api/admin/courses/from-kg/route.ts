/**
 * POST /api/admin/courses/from-kg
 *
 * Wraps a list of existing concept IDs into a `courses.structure` JSONB
 * row and inserts a draft (unpublished) course. This replaces the
 * deleted `/api/admin/generate-curriculum` endpoint that the admin page
 * was calling — instead of generating fresh concepts, we reuse the
 * already-committed KG and just group them.
 *
 * Body: {
 *   domain:        string;
 *   title:         string;
 *   description?:  string;
 *   conceptIds:    string[];           // must already exist in `concepts`
 *   structureMode: "linear" | "byBloom" | "byDifficulty";
 *   is_published?: boolean;            // default false
 * }
 *
 * Returns: { courseId, structure, estimated_hours }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient }       from "@/lib/supabase/server";
import { verifyAdmin }               from "@/lib/admin/auth";
import { logAdminAction }            from "@/lib/admin/audit";
import type { CourseModule, CourseStructure } from "@/lib/agents/curriculum";

type StructureMode = "linear" | "byBloom" | "byDifficulty";

const BLOOM_ORDER: string[] = [
  "remember", "understand", "apply", "analyze", "evaluate", "create",
];

interface ConceptRow {
  id:                 string;
  name:               string;
  difficulty:         number | null;
  bloom_level:        string | null;
  estimated_minutes:  number | null;
  domain:             string;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function buildLinear(concepts: ConceptRow[]): CourseStructure {
  // Order: difficulty asc, then by name. One module, one lesson per concept.
  const sorted = [...concepts].sort((a, b) => {
    const da = a.difficulty ?? 99, db = b.difficulty ?? 99;
    if (da !== db) return da - db;
    return a.name.localeCompare(b.name);
  });
  return {
    modules: [
      {
        id:          "mod_all",
        title:       "All Concepts",
        description: "Linear progression through all concepts.",
        lessons: sorted.map((c, idx) => ({
          id:          `lesson_${idx + 1}_${slugify(c.name).slice(0, 32)}`,
          title:       c.name,
          concept_ids: [c.id],
        })),
      },
    ],
  };
}

function buildByBloom(concepts: ConceptRow[]): CourseStructure {
  const groups = new Map<string, ConceptRow[]>();
  for (const c of concepts) {
    const key = c.bloom_level ?? "understand";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  // Order modules by Bloom hierarchy (foundational → advanced)
  const modules: CourseModule[] = [];
  for (const bloom of BLOOM_ORDER) {
    const bucket = groups.get(bloom);
    if (!bucket || bucket.length === 0) continue;
    const sorted = [...bucket].sort(
      (a, b) => (a.difficulty ?? 99) - (b.difficulty ?? 99)
    );
    modules.push({
      id:          `mod_bloom_${bloom}`,
      title:       `${bloom[0].toUpperCase()}${bloom.slice(1)}`,
      description: `Concepts at the "${bloom}" Bloom level.`,
      lessons: sorted.map((c, idx) => ({
        id:          `lesson_${bloom}_${idx + 1}`,
        title:       c.name,
        concept_ids: [c.id],
      })),
    });
  }
  return { modules };
}

function buildByDifficulty(concepts: ConceptRow[]): CourseStructure {
  const groups = new Map<number, ConceptRow[]>();
  for (const c of concepts) {
    const key = c.difficulty ?? 3;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  const DIFFICULTY_LABEL: Record<number, string> = {
    1: "Beginner",
    2: "Easy",
    3: "Intermediate",
    4: "Advanced",
    5: "Expert",
  };

  const modules: CourseModule[] = [];
  for (const level of [1, 2, 3, 4, 5]) {
    const bucket = groups.get(level);
    if (!bucket || bucket.length === 0) continue;
    const sorted = [...bucket].sort((a, b) => a.name.localeCompare(b.name));
    modules.push({
      id:          `mod_difficulty_${level}`,
      title:       DIFFICULTY_LABEL[level],
      description: `Difficulty level ${level}.`,
      lessons: sorted.map((c, idx) => ({
        id:          `lesson_d${level}_${idx + 1}`,
        title:       c.name,
        concept_ids: [c.id],
      })),
    });
  }
  return { modules };
}

function buildStructure(
  concepts: ConceptRow[],
  mode:     StructureMode
): CourseStructure {
  switch (mode) {
    case "byBloom":      return buildByBloom(concepts);
    case "byDifficulty": return buildByDifficulty(concepts);
    case "linear":
    default:             return buildLinear(concepts);
  }
}

function estimatedHours(concepts: ConceptRow[]): number {
  const totalMinutes = concepts.reduce(
    (s, c) => s + (c.estimated_minutes ?? 15),
    0
  );
  return Math.max(1, Math.round((totalMinutes / 60) * 10) / 10);
}

export async function POST(req: NextRequest) {
  const user = await verifyAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: {
    domain?:        string;
    title?:         string;
    description?:   string;
    conceptIds?:    string[];
    structureMode?: StructureMode;
    is_published?:  boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    domain,
    title,
    description,
    conceptIds,
    structureMode = "linear",
    is_published  = false,
  } = body;

  if (!domain || !title || !Array.isArray(conceptIds) || conceptIds.length === 0) {
    return NextResponse.json(
      { error: "domain, title, and a non-empty conceptIds array are required" },
      { status: 400 }
    );
  }

  const service = createServiceClient();

  // Load the requested concepts (only those that actually exist in this domain)
  const { data: concepts, error: fetchErr } = await service
    .from("concepts")
    .select("id, name, difficulty, bloom_level, estimated_minutes, domain")
    .eq("domain", domain)
    .in("id", conceptIds);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const rows = (concepts ?? []) as ConceptRow[];
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "None of the supplied concept IDs were found in this domain" },
      { status: 400 }
    );
  }

  const structure  = buildStructure(rows, structureMode);
  const hours      = estimatedHours(rows);
  const courseId   = `course_${domain}_${Date.now()}`;

  const { data: course, error: insertErr } = await service
    .from("courses")
    .insert({
      id:              courseId,
      domain,
      title,
      description:     description ?? null,
      structure,
      estimated_hours: hours,
      is_published,
    })
    .select("id")
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  await logAdminAction({
    actorId:    user.id,
    actorEmail: user.email,
    action:     "course.create.from_kg",
    targetType: "course",
    targetId:   courseId,
    diff:       {
      params: {
        domain,
        title,
        structureMode,
        conceptCount: rows.length,
        estimated_hours: hours,
      },
    },
    request: req,
  });

  return NextResponse.json({
    courseId:        course?.id ?? courseId,
    structure,
    estimated_hours: hours,
  });
}
