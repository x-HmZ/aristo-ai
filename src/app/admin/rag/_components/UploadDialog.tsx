"use client";

/**
 * Add reference material: a PDF (text is extracted here, in the browser), a
 * .txt/.md file or pasted text. Steps:
 *
 *   1. choose a file (PDF is read page by page with progress)
 *   2. fill in source details, licence and credit
 *   3. "Check and estimate": validates, finds duplicates, prices the
 *      embedding with a dry run. Nothing is stored or embedded yet.
 *   4. "Confirm and ingest": the only step that spends money.
 *
 * The PDF never leaves the browser; only extracted text is sent, in batches.
 */

import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Loader2, Upload } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { BrandButton } from "@/components/admin/ui/BrandButton";
import { LICENCES, checkLicence, getLicence } from "@/lib/rag/licences";
import { planBatches, type Batch, type IngestEstimate } from "@/lib/rag/batching";
import type { PageText } from "@/lib/rag/chunking";
import { textToPages, joinPages } from "@/lib/rag/plainText";
import { contentHashOf, domainSchema, formatUsd } from "@/lib/rag/sources";
import type { OutlineEntry } from "@/lib/rag/outline";
import {
  createSource, dryRunAll, finishSource, sendBatch, type SourceDetails,
} from "./ingestClient";

interface Props {
  open:          boolean;
  onClose:       () => void;
  onUploaded:    () => void;
  defaultDomain: string;
}

type Phase = "pick" | "extracting" | "review" | "estimating" | "estimated" | "ingesting" | "done";

const EMPTY: SourceDetails = {
  title: "", publisher: "", licenceId: "", licenceUrl: "", attributionText: "",
  sourceUrl: "", domain: "", gradeMin: null, gradeMax: null,
};

export function UploadDialog({ open, onClose, onUploaded, defaultDomain }: Props) {
  const [phase, setPhase]     = useState<Phase>("pick");
  const [details, setDetails] = useState<SourceDetails>({ ...EMPTY, domain: defaultDomain });
  const [pasted, setPasted]   = useState("");
  const [fileName, setFileName] = useState("");
  const [pages, setPages]     = useState<PageText[]>([]);
  const [outline, setOutline] = useState<OutlineEntry[]>([]);
  const [outlineNote, setOutlineNote] = useState("");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [hash, setHash]       = useState("");
  const [estimate, setEstimate] = useState<IngestEstimate | null>(null);
  const [licenceWarning, setLicenceWarning] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [error, setError]     = useState("");
  const [resume, setResume]   = useState<{ sourceId: string; from: number; tokens: number } | null>(null);
  const fileRef  = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const busy = phase === "extracting" || phase === "estimating" || phase === "ingesting";
  const set = <K extends keyof SourceDetails>(k: K, v: SourceDetails[K]) => {
    setDetails((d) => ({ ...d, [k]: v }));
    if (phase === "estimated") { setPhase("review"); setEstimate(null); }
  };

  const reset = () => {
    setPhase("pick"); setDetails({ ...EMPTY, domain: defaultDomain }); setPasted(""); setFileName("");
    setPages([]); setOutline([]); setOutlineNote(""); setBatches([]); setHash(""); setEstimate(null);
    setLicenceWarning(null); setProgress(""); setError(""); setResume(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const loadPages = (p: PageText[], o: OutlineEntry[], note: string, name: string) => {
    setPages(p); setOutline(o); setOutlineNote(note); setFileName(name);
    setDetails((d) => ({ ...d, title: d.title || name.replace(/\.[a-z0-9]+$/i, "") }));
    setPhase("review");
  };

  const onFile = async (file: File | null) => {
    if (!file) return;
    setError("");
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".pdf") || file.type === "application/pdf") {
      setPhase("extracting");
      abortRef.current = new AbortController();
      try {
        // Loaded here so pdf.js never reaches the server bundle.
        const { extractPdf, SCANNED_MESSAGE } = await import("@/lib/rag/pdfText");
        const r = await extractPdf(file, {
          signal: abortRef.current.signal,
          onProgress: (p) => setProgress(
            p.phase === "reading" ? `Reading page ${p.page} of ${p.total}` : "Reading the table of contents",
          ),
        });
        if (r.scanned) { setError(SCANNED_MESSAGE); setPhase("pick"); return; }
        const note =
          r.outlineSource === "pdf"      ? `${r.outline.length} outline entries read from the PDF.`
          : r.outlineSource === "headings" ? `No outline in the PDF; ${r.outline.length} headings detected by font size.`
          : "No outline and no headings found. Text can be ingested, but a course cannot be drafted from this book.";
        loadPages(r.pages, r.outline, note, file.name);
      } catch (e) {
        setError(e instanceof DOMException && e.name === "AbortError" ? "Cancelled." : "Could not read this PDF. Is it password-protected or damaged?");
        setPhase("pick");
      }
      setProgress("");
      return;
    }
    if (/\.(txt|md)$/i.test(lower) || file.type.startsWith("text/")) {
      const text = await file.text();
      const p = textToPages(text);
      if (p.length === 0) { setError("The file is empty."); return; }
      loadPages(p, [], "Plain text has no pages or outline.", file.name);
      return;
    }
    setError("Choose a .pdf, .txt or .md file.");
  };

  const usePasted = () => {
    const p = textToPages(pasted);
    if (p.length === 0) { setError("Paste some text first."); return; }
    setError("");
    loadPages(p, [], "Pasted text has no pages or outline.", "Pasted text");
  };

  const validate = (): string | null => {
    if (!domainSchema.safeParse(details.domain).success) return "Domain must be 3-100 characters of a-z, 0-9 and _.";
    if (!details.title.trim()) return "Title is required.";
    if (!details.publisher.trim()) return "Author or publisher is required.";
    if (!details.licenceId) return "Choose a licence.";
    const lic = checkLicence({ licenceId: details.licenceId, licenceUrl: details.licenceUrl, attributionText: details.attributionText });
    if (!lic.ok) return lic.reason;
    if (details.gradeMin && details.gradeMax && details.gradeMin > details.gradeMax) return "Grade from must not exceed grade to.";
    return null;
  };

  const estimateRun = async () => {
    const problem = validate();
    if (problem) { setError(problem); return; }
    setError(""); setPhase("estimating"); setProgress("Preparing batches");
    try {
      const planned = planBatches(pages);
      const h = await contentHashOf(joinPages(pages));
      const r = await dryRunAll(details, outline, h, planned, (d, t) => setProgress(`Estimating batch ${d} of ${t}`));
      if (!r.ok) { setError(r.error); setPhase("review"); return; }
      setBatches(planned); setHash(h); setEstimate(r.estimate); setLicenceWarning(r.warning); setPhase("estimated");
    } catch {
      setError("Estimate failed. Try again."); setPhase("review");
    }
    setProgress("");
  };

  const ingest = async (start?: { sourceId: string; from: number; tokens: number }) => {
    setError(""); setPhase("ingesting");
    let sourceId = start?.sourceId ?? "";
    let tokens = start?.tokens ?? 0;
    if (!start) {
      setProgress("Registering the source");
      const made = await createSource(details, outline, hash, batches.length);
      if (!made.ok) { setError(made.error); setPhase("estimated"); setProgress(""); return; }
      sourceId = made.id;
    }
    for (let i = start?.from ?? 0; i < batches.length; i++) {
      setProgress(`Embedding batch ${i + 1} of ${batches.length}`);
      const r = await sendBatch(sourceId, batches[i]);
      if (!r.ok) {
        setError(`${r.error} Batches before ${i + 1} are stored; you can retry from here.`);
        setResume({ sourceId, from: i, tokens });
        setPhase("estimated"); setProgress("");
        return;
      }
      tokens += r.estimate.tokens;
    }
    setProgress("Finishing");
    const fin = await finishSource(sourceId, "complete", tokens);
    if (!fin.ok) {
      setError(fin.error ?? "Could not finish.");
      setResume({ sourceId, from: batches.length, tokens });
      setPhase("estimated"); setProgress("");
      return;
    }
    setProgress(""); setResume(null); setPhase("done");
    setTimeout(() => { reset(); onUploaded(); }, 1200);
  };

  const licence = getLicence(details.licenceId);
  const refused = licence?.status === "refused";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="bg-surface max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-ink flex items-center gap-2">
            <Upload className="h-4 w-4 text-accent-text" />
            Add reference material
          </DialogTitle>
          <DialogDescription>
            Upload a textbook PDF, a .txt/.md file, or paste text. A PDF is read in your browser and never uploaded; only its text is sent.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 1. Choose */}
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            <div className="flex flex-wrap items-center gap-2">
              <BrandButton variant="secondary" size="sm" type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
                <FileText className="h-3.5 w-3.5" />
                {fileName || "Choose PDF, .txt or .md"}
              </BrandButton>
              {pages.length > 0 && !busy && (
                <button type="button" onClick={reset} className="text-xs text-muted hover:text-danger">start over</button>
              )}
              {phase === "extracting" && (
                <BrandButton variant="ghost" size="sm" onClick={() => abortRef.current?.abort()}>Cancel</BrandButton>
              )}
            </div>
            {phase === "pick" && (
              <>
                <div className="my-3 text-center text-[10px] text-muted">or paste text</div>
                <textarea
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  rows={5}
                  placeholder="Paste reference text here."
                  className={inputCls + " resize-none font-mono text-xs"}
                />
                <div className="mt-2 flex justify-end">
                  <BrandButton variant="secondary" size="sm" onClick={usePasted} disabled={!pasted.trim()}>Use this text</BrandButton>
                </div>
              </>
            )}
            {pages.length > 0 && (
              <p className="mt-2 text-xs text-body">
                {pages.length} {pages[0].page === null ? "sections" : "pages"} read, {pages.reduce((s, p) => s + p.text.length, 0).toLocaleString()} characters. {outlineNote}
              </p>
            )}
          </div>

          {/* 2. Details */}
          {pages.length > 0 && (
            <div className="space-y-4">
              <Field label="Domain" required hint="Must match the domain your concepts use.">
                <input
                  value={details.domain}
                  onChange={(e) => set("domain", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                  placeholder="e.g. math_grade_7"
                  className={inputCls + " font-mono"}
                />
              </Field>
              <Field label="Title" required>
                <input value={details.title} onChange={(e) => set("title", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Author or publisher" required>
                <input value={details.publisher} onChange={(e) => set("publisher", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Licence" required>
                <Select
                  value={details.licenceId || undefined}
                  onValueChange={(v) => {
                    const l = getLicence(v);
                    setDetails((d) => ({ ...d, licenceId: v, licenceUrl: l?.url ?? d.licenceUrl }));
                    if (phase === "estimated") { setPhase("review"); setEstimate(null); }
                  }}
                >
                  <SelectTrigger className="bg-surface border-line min-h-11"><SelectValue placeholder="Choose a licence" /></SelectTrigger>
                  <SelectContent>
                    {LICENCES.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              {licence?.status === "refused" && <Notice tone="danger">{licence.explanation}</Notice>}
              {licence?.status === "warn" && <Notice tone="warning">{licence.explanation}</Notice>}
              {licence && !refused && licence.needsCredit && (
                <>
                  <Field label="Licence URL" required>
                    <input value={details.licenceUrl} onChange={(e) => set("licenceUrl", e.target.value)} placeholder="https://" className={inputCls} />
                  </Field>
                  <Field label="Attribution text" required hint="Shown to learners and on /credits.">
                    <textarea
                      value={details.attributionText}
                      onChange={(e) => set("attributionText", e.target.value)}
                      rows={3}
                      placeholder='e.g. "Based on ..., by ..., licensed CC BY 4.0. Rewritten and shortened by Aristo AI."'
                      className={inputCls + " resize-none text-xs"}
                    />
                  </Field>
                </>
              )}
              <Field label="Source URL">
                <input value={details.sourceUrl} onChange={(e) => set("sourceUrl", e.target.value)} placeholder="https://" className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Grade from">
                  <input type="number" min={1} max={12} value={details.gradeMin ?? ""} onChange={(e) => set("gradeMin", e.target.value ? Number(e.target.value) : null)} className={inputCls} />
                </Field>
                <Field label="Grade to">
                  <input type="number" min={1} max={12} value={details.gradeMax ?? ""} onChange={(e) => set("gradeMax", e.target.value ? Number(e.target.value) : null)} className={inputCls} />
                </Field>
              </div>
            </div>
          )}

          {/* 3. Estimate */}
          {estimate && (
            <div className="rounded-[10px] border border-line bg-sunk p-3 text-xs text-body space-y-1">
              <p className="font-semibold text-ink">Estimate (no money spent yet)</p>
              <p>{estimate.chunks.toLocaleString()} chunks in {batches.length} batches, about {estimate.tokens.toLocaleString()} tokens.</p>
              <p>Embedding cost with {estimate.model}: about <strong className="text-ink">{formatUsd(estimate.usd)}</strong>. Calls OpenAI once per chunk.</p>
              {licenceWarning && <p className="text-warning">{licenceWarning}</p>}
            </div>
          )}

          {progress && (
            <p className="flex items-center gap-2 text-xs text-body"><Loader2 className="h-3.5 w-3.5 animate-spin" />{progress}</p>
          )}
          {error && (
            <p className="flex items-start gap-2 text-xs text-danger font-semibold"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}</p>
          )}
          {phase === "done" && (
            <p className="flex items-center gap-2 text-xs text-success font-semibold"><CheckCircle2 className="h-3.5 w-3.5" />Source is ready.</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <BrandButton variant="ghost" size="sm" onClick={onClose} disabled={busy}>Close</BrandButton>
            {(phase === "review" || phase === "estimating") && (
              <BrandButton variant="primary" size="sm" onClick={estimateRun} disabled={busy || refused}>
                {phase === "estimating" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Check and estimate
              </BrandButton>
            )}
            {(phase === "estimated" || phase === "ingesting") && (
              <BrandButton
                variant="primary"
                size="sm"
                disabled={busy || !estimate}
                onClick={() => ingest(resume ?? undefined)}
              >
                {phase === "ingesting" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {resume ? "Retry from where it stopped" : `Confirm and ingest (about ${estimate ? formatUsd(estimate.usd) : "$0"})`}
              </BrandButton>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


const inputCls =
  "min-h-11 text-sm bg-surface border border-line rounded-[10px] px-3 py-2 text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent-text w-full";

function Notice({ tone, children }: { tone: "danger" | "warning"; children: React.ReactNode }) {
  const cls = tone === "danger" ? "border-danger/25 bg-danger/10 text-danger" : "border-warning/25 bg-warning/10 text-warning";
  return <p className={`rounded-[10px] border px-3 py-2 text-xs ${cls}`}>{children}</p>;
}

function Field({
  label, required, hint, children,
}: {
  label: string; required?: boolean; hint?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-end justify-between mb-1.5 gap-3">
        <label className="block text-xs font-semibold text-body uppercase tracking-wider">
          {label}{required && <span className="text-accent-text ml-0.5">*</span>}
        </label>
        {hint && <span className="text-[10px] text-muted normal-case">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
