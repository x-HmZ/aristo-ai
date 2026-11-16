"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Loader2, Trash2 } from "lucide-react";
import { BrandBadge } from "@/components/admin/ui/BrandBadge";
import { BrandButton } from "@/components/admin/ui/BrandButton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getLicence } from "@/lib/rag/licences";
import type { OutlineEntry } from "@/lib/rag/outline";
import { DraftCoursePanel } from "./DraftCoursePanel";

export interface SourceRow {
  id:               string;
  title:            string;
  publisher:        string;
  licence_id:       string;
  domain:           string;
  grade_min:        number | null;
  grade_max:        number | null;
  status:           "draft" | "ingesting" | "ready" | "failed";
  error:            string | null;
  chunk_count:      number;
  token_count:      number;
  outline:          OutlineEntry[];
  created_at:       string;
}

const STATUS_VARIANT = {
  ready: "green", ingesting: "amber", draft: "slate", failed: "red",
} as const;

interface Props {
  /** Bumped by the page after an upload so the list reloads. */
  refreshKey: number;
  onChanged:  () => void;
}

export function SourcesPanel({ refreshKey, onChanged }: Props) {
  const [sources, setSources] = useState<SourceRow[] | null>(null);
  const [busyId, setBusyId]   = useState<string | null>(null);
  const [error, setError]     = useState("");
  const [draftFor, setDraftFor] = useState<SourceRow | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/rag/sources", { cache: "no-store" });
    if (res.ok) setSources(((await res.json()).sources ?? []) as SourceRow[]);
    else setSources([]);
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const remove = async (s: SourceRow) => {
    if (!window.confirm(`Delete "${s.title}" and its ${s.chunk_count} chunks? Concepts keep existing; they just lose this grounding.`)) return;
    setBusyId(s.id); setError("");
    const res = await fetch(`/api/admin/rag/sources/${s.id}`, { method: "DELETE" });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Delete failed");
    setBusyId(null);
    await load();
    onChanged();
  };

  if (sources === null) {
    return <div className="p-6 text-center text-xs text-muted"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></div>;
  }
  if (sources.length === 0) {
    return <p className="p-6 text-center text-xs text-muted">No sources yet. Upload a textbook PDF to register the first one.</p>;
  }

  return (
    <>
      {error && <p className="px-4 pt-3 text-xs text-danger font-semibold">{error}</p>}
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Source</TableHead>
            <TableHead>Domain</TableHead>
            <TableHead>Licence</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Chunks</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sources.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="text-xs text-ink max-w-[240px]">
                <p className="truncate font-semibold">{s.title}</p>
                <p className="truncate text-muted">{s.publisher}</p>
              </TableCell>
              <TableCell><BrandBadge variant="orange">{s.domain}</BrandBadge></TableCell>
              <TableCell className="text-xs text-body">{getLicence(s.licence_id)?.name ?? s.licence_id}</TableCell>
              <TableCell>
                <BrandBadge variant={STATUS_VARIANT[s.status]}>{s.status}</BrandBadge>
                {s.error && <p className="mt-1 text-[10px] text-danger max-w-[180px] truncate" title={s.error}>{s.error}</p>}
              </TableCell>
              <TableCell className="text-right text-xs text-body">{s.chunk_count.toLocaleString()}</TableCell>
              <TableCell className="text-right whitespace-nowrap">
                {s.status === "ready" && (
                  <BrandButton variant="outline" size="sm" onClick={() => setDraftFor(s)}>
                    <BookOpen className="h-3.5 w-3.5" />
                    Draft a course
                  </BrandButton>
                )}
                <BrandButton variant="ghost" size="icon" onClick={() => remove(s)} disabled={busyId === s.id} title="Delete source and its chunks">
                  {busyId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </BrandButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {draftFor && <DraftCoursePanel source={draftFor} onClose={() => setDraftFor(null)} onSaved={onChanged} />}
    </>
  );
}
