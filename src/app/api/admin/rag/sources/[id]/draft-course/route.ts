/**
 * POST /api/admin/rag/sources/[id]/draft-course
 *
 * "Draft a course from this book", in three steps the admin drives. Only the
 * stored OUTLINE (titles and page ranges) is ever sent to the model.
 *
 *   { action: "plan" }                          no model call. Returns how the
 *       outline splits into calls and the cost estimate to show before spending.
 *   { action: "propose", groupIndex, previous } ONE paid model call for one
 *       group of chapters (about 30 concepts). Returns validated concepts;
 *       nothing is saved. One call per request keeps each under the time limit.
 *   { action: "save", domain, courseTitle, concepts }   no model call. Writes
 *       the concepts as DRAFT (hidden from learners by RLS) through the shared
 *       KG write path and creates an UNPUBLISHED course. Publishing the course
 *       (admin courses page) is what makes them visible.
 */

import { NextRequest, NextResponse } from "next/server";
import { z }                         from "zod";
import { createServiceClient }       from "@/lib/supabase/server";
import { verifyAdmin }               from "@/lib/admin/auth";
import { logAdminAction }            from "@/lib/admin/audit";
import { generateConceptsFromOutline } from "@/lib/agents/curriculum";
import {
  ProposalError, buildDraftStructure, checkDraftGraph, estimateGraphCost, estimateHours,
  groupOutline, saveDraftSchema,
} from "@/lib/kg/fromOutline";
import { writeConcepts, type ConceptWrite } from "@/lib/kg/write";
import { outlineEntrySchema } from "@/lib/rag/sources";
import { outlineIsUsable, type OutlineEntry } from "@/lib/rag/outline";

export const runtime     = "nodejs";
export const maxDuration = 300;   // one Sonnet call of up to ~12k output tokens

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("plan") }),
  z.object({
    action:     z.literal("propose"),
    groupIndex: z.number().int().min(0).max(200),
    previous:   z.array(z.object({ id: z.string().max(100), name: z.string().max(255) })).max(600).default([]),
  }),
  saveDraftSchema,
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`) },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const service = createServiceClient();
  const { data: source } = await service
    .from("reference_sources")
    .select("id, title, publisher, domain, grade_min, grade_max, status, outline")
    .eq("id", id)
    .maybeSingle();
  if (!source) return NextResponse.json({ error: "Source not found" }, { status: 404 });
  if (source.status !== "ready") {
    return NextResponse.json({ error: "Only a ready source can be turned into a course." }, { status: 409 });
  }

  const outlineParsed = z.array(outlineEntrySchema).safeParse(source.outline);
  const outline: OutlineEntry[] = outlineParsed.success ? outlineParsed.data : [];

  // ── save: no model call ──────────────────────────────────────────────────
  if (body.action === "save") {
    const problems = checkDraftGraph(body.concepts);
    if (problems.length > 0) {
      return NextResponse.json({ error: "The concept graph is inconsistent.", issues: problems.slice(0, 10) }, { status: 422 });
    }

    // Never overwrite concepts that belong to something else.
    const ids = body.concepts.map((c) => c.id);
    const { data: clash } = await service
      .from("concepts")
      .select("id, source_id")
      .in("id", ids);
    const foreign = (clash ?? []).filter((c: { id: string; source_id: string | null }) => c.source_id !== id);
    if (foreign.length > 0) {
      return NextResponse.json(
        { error: `Concept ids already exist outside this source: ${foreign.slice(0, 5).map((c: { id: string }) => c.id).join(", ")}. Remove them or change the domain.` },
        { status: 409 },
      );
    }

    const rows: ConceptWrite[] = body.concepts.map((c) => ({
      id:                    c.id,
      domain:                body.domain,
      name:                  c.name,
      description:           c.description,
      difficulty:            c.difficulty,
      bloom_level:           c.bloom_level,
      estimated_minutes:     c.estimated_minutes,
      key_terms:             c.key_terms,
      learning_objectives:   c.learning_objectives,
      common_misconceptions: c.common_misconceptions,
      tags:                  [],
      prerequisites:         c.prerequisites,
      source_id:             id,
      source_pages:          c.source_pages,
      grade_level:           c.grade_level,
      is_draft:              true,
    }));

    try {
      const written = await writeConcepts(service, rows);
      const structure = buildDraftStructure(body.concepts, outline);
      const hours = estimateHours(body.concepts);
      const courseId = `course_${body.domain.slice(0, 70)}_${Date.now()}`;

      const { error } = await service.from("courses").insert({
        id:              courseId,
        domain:          body.domain,
        title:           body.courseTitle,
        description:     body.courseDescription || null,
        structure,
        estimated_hours: hours,
        is_published:    false,
      });
      if (error) throw error;

      await logAdminAction({
        actorId:    admin.id,
        actorEmail: admin.email,
        action:     "course.draft.from_source",
        targetType: "course",
        targetId:   courseId,
        diff:       { params: { source: id, domain: body.domain, concepts: written.inserted, edges: written.edges } },
        request:    req,
      });

      return NextResponse.json({ ok: true, courseId, concepts: written.inserted, edges: written.edges, modules: structure.modules.length });
    } catch (err) {
      console.error("[draft-course save]", err);
      return NextResponse.json({ error: "Saving the draft failed." }, { status: 500 });
    }
  }

  // ── plan and propose need a usable outline ───────────────────────────────
  if (!outlineIsUsable(outline)) {
    return NextResponse.json(
      { error: "This source has no usable outline (needs at least 3 chapters or 5 sections). Add concepts by hand or upload a PDF with a table of contents." },
      { status: 422 },
    );
  }
  const groups = groupOutline(outline);
  const estimate = estimateGraphCost(outline, groups);

  if (body.action === "plan") {
    return NextResponse.json({
      ok:           true,
      title:        source.title,
      domain:       source.domain,
      outlineEntries: outline.length,
      groups:       groups.map((g) => ({ index: g.index, target: g.target, entries: g.entryIndices.length })),
      estimate,
    });
  }

  // propose: the paid call
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured." }, { status: 503 });
  }
  const group = groups[body.groupIndex];
  if (!group) return NextResponse.json({ error: "No such group." }, { status: 400 });

  try {
    const result = await generateConceptsFromOutline({
      title:      source.title,
      publisher:  source.publisher,
      domain:     source.domain,
      gradeMin:   source.grade_min,
      gradeMax:   source.grade_max,
      outline,
      group,
      groupCount: groups.length,
      previous:   body.previous,
      userId:     admin.id,
    });
    return NextResponse.json({ ok: true, groupIndex: group.index, ...result });
  } catch (err) {
    if (err instanceof ProposalError) return NextResponse.json({ error: err.message }, { status: 502 });
    console.error("[draft-course propose]", err);
    return NextResponse.json({ error: "The model call failed. Try this part again." }, { status: 502 });
  }
}
