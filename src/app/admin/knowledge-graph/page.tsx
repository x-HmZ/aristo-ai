"use client";

import { Suspense, useCallback, useEffect, useState }   from "react";
import dynamic                       from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Wand2, Database, CheckCircle2, XCircle, Loader2,
  Network, ListTree, ShieldAlert,
} from "lucide-react";
import { PageHeader }                from "@/components/admin/PageHeader";
import { BrandCard }                 from "@/components/admin/ui/BrandCard";
import { BrandButton }               from "@/components/admin/ui/BrandButton";
import { BrandBadge, BLOOM_COLOR }   from "@/components/admin/ui/BrandBadge";
import { SectionTitle }              from "@/components/admin/ui/SectionTitle";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { Concept }              from "./_components/types";
import { ConceptEditor }             from "./_components/ConceptEditor";

// React Flow ships browser-only globals at module init — must be SSR-disabled.
const KgGraph = dynamic(() => import("./_components/KgGraph").then((m) => m.KgGraph), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[500px] text-muted">
      <Loader2 className="h-5 w-5 animate-spin mr-2" />
      Loading graph…
    </div>
  ),
});

// ─── Page entry ───────────────────────────────────────────────────────────────

export default function KnowledgeGraphPage() {
  return (
    <Suspense fallback={<div className="text-xs text-muted">Loading…</div>}>
      <KgPageInner />
    </Suspense>
  );
}

function KgPageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const urlDomain    = searchParams?.get("domain") ?? "python_programming";

  const [domain, setDomain]               = useState(urlDomain);
  const [concepts, setConcepts]           = useState<Concept[] | null>(null);
  const [coverage, setCoverage]           = useState<Record<string, { chunkCount: number; lastIngestedAt: string | null }>>({});
  const [validation, setValidation]       = useState<{ valid: boolean; errors: { type: string; message: string; involved?: string[] }[] } | null>(null);
  const [validating, setValidating]       = useState(false);
  const [generating, setGenerating]       = useState(false);
  const [committing, setCommitting]       = useState(false);
  const [customSubject, setCustomSubject] = useState("");
  const [genResult, setGenResult]         = useState<{ count: number; concepts: Concept[] } | null>(null);
  const [seedStatus, setSeedStatus]       = useState<string | null>(null);
  const [loadError, setLoadError]         = useState<string | null>(null);
  const [editing, setEditing]             = useState<Concept | null>(null);

  const load = useCallback(async (d = domain) => {
    setLoadError(null);
    setConcepts(null);

    const [conceptsRes, coverageRes] = await Promise.all([
      fetch(`/api/kg/${d}`),
      fetch(`/api/admin/kg/coverage/${d}`),
    ]);

    if (conceptsRes.ok) {
      const data = await conceptsRes.json();
      setConcepts(data.concepts ?? []);
    } else if (conceptsRes.status === 403) {
      setLoadError("Forbidden — admin access required.");
      setConcepts([]);
    } else {
      setLoadError(`Failed to load (${conceptsRes.status})`);
      setConcepts([]);
    }

    if (coverageRes.ok) {
      const data = await coverageRes.json();
      setCoverage(data.per_concept ?? {});
    }
  }, [domain]);

  useEffect(() => { load(); }, [load]);

  const setDomainAndUrl = (d: string) => {
    setDomain(d);
    router.push(`/admin/knowledge-graph?domain=${encodeURIComponent(d)}`, { scroll: false });
  };

  const validate = async () => {
    setValidating(true);
    setValidation(null);
    const res = await fetch(`/api/kg/validate/${domain}`, { method: "POST" });
    if (res.ok) setValidation(await res.json());
    setValidating(false);
  };

  const generate = async () => {
    setGenerating(true);
    setGenResult(null);
    const subject = customSubject.trim() || domain.replace(/_/g, " ");
    const res = await fetch(`/api/kg/generate/${domain}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ subject }),
    });
    if (res.ok) setGenResult(await res.json());
    setGenerating(false);
  };

  const commit = async () => {
    if (!genResult) return;
    setCommitting(true);
    setSeedStatus(null);
    const res = await fetch("/api/kg/concepts", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ concepts: genResult.concepts }),
    });
    if (res.ok) {
      const data = await res.json();
      setSeedStatus(`Committed ${data.inserted} concepts, ${data.edges} edges.`);
      setGenResult(null);
      load();
    } else {
      setSeedStatus("Error committing — see console.");
    }
    setCommitting(false);
  };

  const onSaveConcept = async (updated: Partial<Concept> & { id: string }) => {
    const { id, prerequisites, ...rest } = updated;
    // Save fields first
    const res = await fetch(`/api/admin/kg/concept/${encodeURIComponent(id)}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(rest),
    });
    if (!res.ok) return false;

    // Save prerequisites (replace-set semantics) if changed
    if (Array.isArray(prerequisites)) {
      await fetch("/api/admin/kg/prerequisites", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ concept_id: id, prerequisite_ids: prerequisites }),
      });
    }
    await load();
    return true;
  };

  const onDeleteConcept = async (id: string) => {
    const res = await fetch(`/api/admin/kg/concept/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) return false;
    setEditing(null);
    await load();
    return true;
  };

  const onCreatePrereq = async (concept_id: string, prerequisite_id: string) => {
    // Append, don't replace
    const current = concepts?.find((c) => c.id === concept_id)?.prerequisites ?? [];
    if (current.includes(prerequisite_id)) return;
    const next = [...current, prerequisite_id];
    const res = await fetch("/api/admin/kg/prerequisites", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ concept_id, prerequisite_ids: next }),
    });
    if (res.ok) await load();
  };

  return (
    <>
      <PageHeader
        title="Knowledge Graph"
        subtitle="Visualize, edit, and seed the concept graph per domain. Drag between nodes to wire prerequisites; click a node to edit."
        actions={
          <>
            <input
              value={domain}
              onChange={(e) =>
                setDomain(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))
              }
              onBlur={() => setDomainAndUrl(domain)}
              onKeyDown={(e) => e.key === "Enter" && setDomainAndUrl(domain)}
              placeholder="domain"
              className="min-h-11 text-sm bg-surface border border-line rounded-[10px] px-3 py-2 w-56 font-mono text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent-text"
            />
            <BrandButton variant="outline" size="sm" onClick={() => load(domain)}>
              Load
            </BrandButton>
            <BrandButton
              variant="purple"
              size="sm"
              onClick={validate}
              disabled={validating}
            >
              {validating
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <CheckCircle2 className="h-3.5 w-3.5" />}
              Validate
            </BrandButton>
          </>
        }
        meta={
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
            {concepts !== null && (
              <span>
                <span className="font-bold text-ink">{concepts.length}</span> concepts
              </span>
            )}
            {Object.keys(coverage).length > 0 && (
              <span>·
                <span className="ml-1.5 font-bold text-ink">
                  {Object.values(coverage).reduce((s, c) => s + c.chunkCount, 0)}
                </span> RAG chunks linked to concepts
              </span>
            )}
            {validation && !validation.valid && (
              <BrandBadge variant="red" size="md">
                <ShieldAlert className="h-3 w-3" />
                {validation.errors.length} validation error{validation.errors.length !== 1 ? "s" : ""}
              </BrandBadge>
            )}
            {validation?.valid && (
              <BrandBadge variant="green" size="md">
                <CheckCircle2 className="h-3 w-3" />Valid DAG
              </BrandBadge>
            )}
          </div>
        }
      />

      {loadError && (
        <BrandCard variant="danger" className="mb-4">
          <p className="text-sm font-semibold text-danger">{loadError}</p>
        </BrandCard>
      )}

      {/* Generate section */}
      <BrandCard className="mb-5">
        <SectionTitle
          title="Generate concepts with Claude Sonnet"
          description="Generated concepts are returned for review and NOT auto-committed."
        />
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={customSubject}
            onChange={(e) => setCustomSubject(e.target.value)}
            placeholder={`Subject label (default: "${domain.replace(/_/g, " ")}")`}
            className="min-h-11 text-sm bg-surface border border-line rounded-[10px] px-3 py-2 w-80 text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent-text"
          />
          <BrandButton
            variant="purple"
            size="md"
            onClick={generate}
            disabled={generating}
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            {generating ? "Generating…" : "Generate (review before commit)"}
          </BrandButton>
        </div>

        {genResult && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-ink font-semibold">
                {genResult.count} concepts generated. Review below, then commit.
              </span>
              <BrandButton
                variant="success"
                size="sm"
                onClick={commit}
                disabled={committing}
              >
                {committing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
                {committing ? "Committing…" : "Commit to DB"}
              </BrandButton>
            </div>
            <pre className="max-h-64 overflow-y-auto rounded-xl bg-surface border border-line p-3 text-[11px] font-mono text-ink">
              {JSON.stringify(genResult.concepts.slice(0, 5), null, 2)}{"\n…"}
            </pre>
          </div>
        )}
        {seedStatus && (
          <div className="mt-3 text-sm font-semibold text-success">{seedStatus}</div>
        )}
      </BrandCard>

      {/* Graph / Table / Validation tabs */}
      <Tabs defaultValue="graph">
        <TabsList className="mb-3">
          <TabsTrigger
            value="graph"
          >
            <Network className="h-3.5 w-3.5 mr-1.5" />Graph
          </TabsTrigger>
          <TabsTrigger
            value="table"
          >
            <ListTree className="h-3.5 w-3.5 mr-1.5" />Table
          </TabsTrigger>
          <TabsTrigger
            value="validation"
          >
            <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />Validation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="graph">
          {concepts === null ? (
            <BrandCard><p className="text-xs text-muted">Loading…</p></BrandCard>
          ) : concepts.length === 0 ? (
            <BrandCard className="flex flex-col items-center justify-center py-10 gap-3">
              <Network className="h-10 w-10 text-muted" />
              <p className="text-sm text-muted">
                No concepts for this domain yet. Generate or seed one above.
              </p>
            </BrandCard>
          ) : (
            <BrandCard padding="none" className="overflow-hidden">
              <div className="h-[600px]">
                <KgGraph
                  concepts={concepts}
                  coverage={coverage}
                  onNodeClick={(c) => setEditing(c)}
                  onCreatePrereq={onCreatePrereq}
                />
              </div>
            </BrandCard>
          )}
        </TabsContent>

        <TabsContent value="table">
          <BrandCard padding="none">
            <div className="px-5 pt-5">
              <SectionTitle
                title="Concept list"
                description="Click a row to open the inline editor."
              />
            </div>
            {concepts === null ? (
              <p className="px-5 pb-5 text-xs text-muted">Loading…</p>
            ) : concepts.length === 0 ? (
              <p className="px-5 pb-5 text-xs text-muted">
                No concepts in this domain.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Bloom</TableHead>
                    <TableHead>Min</TableHead>
                    <TableHead>RAG</TableHead>
                    <TableHead>Prereqs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {concepts.map((c) => {
                    const cov = coverage[c.id]?.chunkCount ?? 0;
                    return (
                      <TableRow
                        key={c.id}
                        className="cursor-pointer"
                        onClick={() => setEditing(c)}
                      >
                        <TableCell className="font-mono text-muted text-[11px] max-w-[180px] truncate">
                          {c.id}
                        </TableCell>
                        <TableCell className="font-medium text-ink max-w-[240px] truncate">
                          {c.name}
                        </TableCell>
                        <TableCell>
                          <BrandBadge
                            variant={
                              c.difficulty <= 1 ? "green" :
                              c.difficulty <= 2 ? "blue"  :
                              c.difficulty <= 3 ? "orange":
                              c.difficulty <= 4 ? "red"   : "purple"
                            }
                            size="md"
                          >
                            L{c.difficulty}
                          </BrandBadge>
                        </TableCell>
                        <TableCell>
                          <BrandBadge variant={BLOOM_COLOR[c.bloom_level] ?? "neutral"}>
                            {c.bloom_level}
                          </BrandBadge>
                        </TableCell>
                        <TableCell className="text-muted tabular-nums text-xs">
                          {c.estimated_minutes}m
                        </TableCell>
                        <TableCell>
                          <BrandBadge variant={cov > 0 ? "green" : "red"}>
                            {cov}
                          </BrandBadge>
                        </TableCell>
                        <TableCell className="text-muted text-xs max-w-[200px] truncate">
                          {c.prerequisites?.length ? c.prerequisites.join(", ") : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </BrandCard>
        </TabsContent>

        <TabsContent value="validation">
          <BrandCard>
            <SectionTitle
              title="Validation errors"
              description="Run validate to check this domain for cycles, orphans, and missing prerequisites."
            />
            {!validation ? (
              <p className="text-xs text-muted">
                Not validated yet. Click <span className="font-semibold">Validate</span> in the page header.
              </p>
            ) : validation.valid ? (
              <p className="flex items-center gap-2 text-sm text-success font-semibold">
                <CheckCircle2 className="h-4 w-4" />
                Graph is a valid DAG with no detected issues.
              </p>
            ) : (
              <ul className="space-y-2">
                {validation.errors.map((e, i) => (
                  <li
                    key={i}
                    className="rounded-xl bg-danger/10 border border-danger/25 px-3 py-2 flex items-start gap-2"
                  >
                    <XCircle className="h-4 w-4 text-danger flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-danger uppercase tracking-wider">
                        {e.type}
                      </div>
                      <div className="text-sm text-danger">{e.message}</div>
                      {e.involved && (
                        <div className="mt-1 text-[11px] text-danger font-mono">
                          {e.involved.join(" → ")}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </BrandCard>
        </TabsContent>
      </Tabs>

      {/* Editor dialog */}
      <ConceptEditor
        concept={editing}
        allConcepts={concepts ?? []}
        open={!!editing}
        onClose={() => setEditing(null)}
        onSave={onSaveConcept}
        onDelete={onDeleteConcept}
      />
    </>
  );
}
