"use client";

import { useState, useRef } from "react";
import { Loader2, Upload, FileText } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { BrandButton }      from "@/components/admin/ui/BrandButton";

interface Props {
  open:          boolean;
  onClose:       () => void;
  onUploaded:    () => void;
  defaultDomain: string;
}

export function UploadDialog({ open, onClose, onUploaded, defaultDomain }: Props) {
  const [domain, setDomain]       = useState(defaultDomain);
  const [sourceTitle, setSource]  = useState("");
  const [conceptId, setConceptId] = useState("");
  const [text, setText]           = useState("");
  const [file, setFile]           = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState("");
  const [status, setStatus]       = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setSource(""); setConceptId(""); setText(""); setFile(null);
    setStatus(null); setError("");
  };

  const submit = async () => {
    if (!domain.trim()) { setError("Domain is required."); return; }
    if (!text.trim() && !file) {
      setError("Provide text or a .txt/.md file.");
      return;
    }
    setSubmitting(true);
    setError("");
    setStatus("Embedding chunks (this may take a moment)…");

    try {
      let res: Response;
      if (file) {
        const fd = new FormData();
        fd.append("domain", domain.trim());
        if (sourceTitle) fd.append("source_title", sourceTitle.trim());
        if (conceptId)   fd.append("concept_id",   conceptId.trim());
        fd.append("file", file);
        res = await fetch("/api/admin/rag/upload", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/admin/rag/upload", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            domain:       domain.trim(),
            source_title: sourceTitle.trim() || null,
            concept_id:   conceptId.trim() || undefined,
            text:         text.trim(),
          }),
        });
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        setStatus(null);
        return;
      }
      setStatus(`Inserted ${data.ingested} of ${data.total_chunks ?? data.ingested} chunks.`);
      setTimeout(() => {
        reset();
        onUploaded();
      }, 800);
    } catch {
      setError("Upload failed — try again.");
      setStatus(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-aristo-cream max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-aristo-brown flex items-center gap-2">
            <Upload className="h-4 w-4 text-aristo-orange" />
            Upload reference material
          </DialogTitle>
          <DialogDescription>
            Paste text or upload a plain .txt/.md file. PDFs aren&apos;t supported in v1 — extract the text yourself.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Domain" required hint="Must match the domain used by your concepts.">
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
              placeholder="e.g. python_programming"
              className={inputCls + " font-mono"}
            />
          </Field>

          <Field label="Source title" hint="Shown to the teacher LLM as the citation.">
            <input
              value={sourceTitle}
              onChange={(e) => setSource(e.target.value)}
              placeholder='e.g. "Python Docs §5.2"'
              className={inputCls}
            />
          </Field>

          <Field label="Concept id" hint="Optional. Tags every chunk to a specific concept for coverage reporting.">
            <input
              value={conceptId}
              onChange={(e) => setConceptId(e.target.value)}
              placeholder="e.g. python_loops_for"
              className={inputCls + " font-mono"}
            />
          </Field>

          <Field label="Text content">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder="Paste reference text here. Will be chunked (~1800 chars per chunk) and embedded."
              className={inputCls + " resize-none font-mono text-xs"}
              disabled={!!file}
            />
          </Field>

          <div className="text-center text-[10px] text-aristo-brown/40">— OR —</div>

          <Field label="File upload" hint=".txt or .md only">
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            <BrandButton
              variant="secondary"
              size="sm"
              onClick={() => fileRef.current?.click()}
              type="button"
            >
              <FileText className="h-3.5 w-3.5" />
              {file ? file.name : "Choose file…"}
            </BrandButton>
            {file && (
              <button
                type="button"
                onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                className="ml-2 text-xs text-aristo-brown/50 hover:text-red-500"
              >
                clear
              </button>
            )}
          </Field>

          {error  && <p className="text-xs text-red-500 font-semibold">{error}</p>}
          {status && !error && <p className="text-xs text-green-700 font-semibold">{status}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <BrandButton variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </BrandButton>
            <BrandButton variant="primary" size="sm" onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Embed &amp; ingest
            </BrandButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const inputCls =
  "text-sm bg-white/60 border border-white/60 rounded-xl px-3 py-2 text-aristo-brown placeholder:text-aristo-brown/40 focus:outline-none focus:ring-2 focus:ring-aristo-orange/40 w-full";

function Field({
  label, required, hint, children,
}: {
  label: string; required?: boolean; hint?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-end justify-between mb-1.5 gap-3">
        <label className="block text-xs font-semibold text-aristo-brown/70 uppercase tracking-wider">
          {label}{required && <span className="text-aristo-orange ml-0.5">*</span>}
        </label>
        {hint && <span className="text-[10px] text-aristo-brown/50 normal-case">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
