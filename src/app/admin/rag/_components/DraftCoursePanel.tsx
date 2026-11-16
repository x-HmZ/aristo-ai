"use client";

/**
 * "Draft a course from this book": plan and cost estimate first (no model
 * call), then the paid calls only after the admin confirms, then a review
 * list where concepts can be removed, then save as an unpublished draft.
 */

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { BrandButton } from "@/components/admin/ui/BrandButton";
import { formatUsd } from "@/lib/rag/sources";
import { pruneConcepts, type DraftConcept, type GraphCostEstimate } from "@/lib/kg/fromOutline";
import type { SourceRow } from "./SourcesPanel";

interface Props {
  source:   SourceRow;
  onClose:  () => void;
  onSaved:  () => void;
}

interface Plan { groups: Array<{ index: number; target: number }>; estimate: GraphCostEstimate }

async function call(sourceId: string, body: unknown) {
  const res = await fetch(`/api/admin/rag/sources/${sourceId}/draft-course`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export function DraftCoursePanel({ source, onClose, onSaved }: Props) {
  const [plan, setPlan]         = useState<Plan | null>(null);
  const [concepts, setConcepts] = useState<DraftConcept[] | null>(null);
  const [title, setTitle]       = useState(source.title);
  const [description, setDesc]  = useState("");
  const [busy, setBusy]         = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError]       = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [savedId, setSavedId]   = useState<string | null>(null);

  const loadPlan = async () => {
    setBusy(true); setError("");
    const r = await call(source.id, { action: "plan" });
    if (r.ok) setPlan(r.data as Plan); else setError(r.data.error ?? "Could not plan.");
    setBusy(false);
  };

  const generate = async () => {
    if (!plan) return;
    setBusy(true); setError("");
    let all: DraftConcept[] = [];
    const warn: string[] = [];
    for (const g of plan.groups) {
      setProgress(`Asking the model about part ${g.index + 1} of ${plan.groups.length}`);
      const r = await call(source.id, {
        action: "propose", groupIndex: g.index, previous: all.map((c) => ({ id: c.id, name: c.name })),
      });
      if (!r.ok) {
        setError(`${r.data.error ?? "Model call failed."} Parts before ${g.index + 1} are kept below; nothing is saved yet.`);
        break;
      }
      all = [...all, ...(r.data.concepts as DraftConcept[])];
      warn.push(...((r.data.warnings as string[]) ?? []));
      if (g.index === 0 && r.data.courseTitle) setTitle(r.data.courseTitle as string);
      if (g.index === 0 && r.data.courseDescription) setDesc(r.data.courseDescription as string);
    }
    setConcepts(all.length > 0 ? all : null); setWarnings(warn);
    setProgress(""); setBusy(false);
  };

  const save = async () => {
    if (!concepts) return;
    setBusy(true); setError("");
    const r = await call(source.id, {
      action: "save", domain: source.domain, courseTitle: title, courseDescription: description, concepts,
    });
    if (r.ok) { setSavedId(r.data.courseId as string); onSaved(); }
    else setError([r.data.error, ...(r.data.issues ?? [])].filter(Boolean).join(" "));
    setBusy(false);
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="bg-surface max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-ink">Draft a course from &quot;{source.title}&quot;</DialogTitle>
          <DialogDescription>
            Only the book&apos;s outline is sent to the model, never its text. The result is saved as a draft: learners see nothing until you publish the course.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-xs text-body">
          {!plan && !savedId && (
            <BrandButton variant="secondary" size="sm" onClick={loadPlan} disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Show plan and cost estimate
            </BrandButton>
          )}

          {plan && !concepts && !savedId && (
            <div className="rounded-[10px] border border-line bg-sunk p-3 space-y-1">
              <p className="font-semibold text-ink">Estimate (no model call made yet)</p>
              <p>{plan.estimate.calls} model calls, about {plan.estimate.concepts} concepts, using {plan.estimate.model}.</p>
              <p>
                About <strong className="text-ink">{formatUsd(plan.estimate.usd)}</strong>, at most {formatUsd(plan.estimate.maxUsd)}.
              </p>
              <BrandButton variant="primary" size="sm" onClick={generate} disabled={busy} className="mt-2">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Generate concepts (about {formatUsd(plan.estimate.usd)})
              </BrandButton>
            </div>
          )}

          {progress && <p className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />{progress}</p>}

          {concepts && !savedId && (
            <>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} aria-label="Course title" />
              <p>{concepts.length} concepts. Remove any that do not belong; you can edit the rest afterwards in the knowledge graph and course pages.</p>
              <ul className="max-h-72 overflow-y-auto divide-y divide-line border border-line rounded-[10px]">
                {concepts.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{c.name}</span>
                      <span className="block text-muted">
                        grade {c.grade_level}, difficulty {c.difficulty}, {c.prerequisites.length} prerequisites
                        {c.source_pages.length > 0 ? `, pages ${c.source_pages.map((p) => `${p.start}-${p.end}`).join(", ")}` : ""}
                      </span>
                    </span>
                    <button type="button" aria-label={`Remove ${c.name}`} className="p-2 text-muted hover:text-danger"
                      onClick={() => setConcepts(pruneConcepts(concepts, [c.id]))}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              {warnings.length > 0 && <p className="text-warning">{warnings.length} small repairs were made to the model&apos;s answer.</p>}
              <BrandButton variant="primary" size="sm" onClick={save} disabled={busy || concepts.length === 0 || !title.trim()}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Save as draft course
              </BrandButton>
            </>
          )}

          {savedId && (
            <p className="text-success font-semibold">
              Draft saved. Review it in Courses, then publish: <a className="underline" href="/admin/courses">/admin/courses</a>.
            </p>
          )}
          {error && <p className="text-danger font-semibold">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const inputCls =
  "min-h-11 text-sm bg-surface border border-line rounded-[10px] px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-accent-text w-full";
