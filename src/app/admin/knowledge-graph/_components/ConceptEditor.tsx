"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2, X, Save } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { BrandButton }              from "@/components/admin/ui/BrandButton";
import { BrandBadge }               from "@/components/admin/ui/BrandBadge";
import type { Concept }             from "./types";

const BLOOMS = ["remember", "understand", "apply", "analyze", "evaluate", "create"];

interface Props {
  concept:     Concept | null;
  allConcepts: Concept[];
  open:        boolean;
  onClose:     () => void;
  onSave:      (updated: Partial<Concept> & { id: string }) => Promise<boolean>;
  onDelete:    (id: string) => Promise<boolean>;
}

export function ConceptEditor({ concept, allConcepts, open, onClose, onSave, onDelete }: Props) {
  const [form, setForm]                 = useState<Concept | null>(null);
  const [saving, setSaving]             = useState(false);
  const [deleting, setDeleting]         = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [newPrereq, setNewPrereq]       = useState("");

  useEffect(() => {
    setForm(concept);
    setError(null);
    setConfirmDelete(false);
    setNewPrereq("");
  }, [concept]);

  if (!form) return null;

  const save = async () => {
    setSaving(true);
    setError(null);
    const ok = await onSave({
      id:                    form.id,
      name:                  form.name,
      description:           form.description ?? null,
      difficulty:            form.difficulty,
      bloom_level:           form.bloom_level,
      estimated_minutes:     form.estimated_minutes,
      key_terms:             form.key_terms,
      learning_objectives:   form.learning_objectives,
      common_misconceptions: form.common_misconceptions,
      tags:                  form.tags,
      prerequisites:         form.prerequisites,
    });
    setSaving(false);
    if (ok) onClose();
    else setError("Save failed — check server logs.");
  };

  const remove = async () => {
    setDeleting(true);
    await onDelete(form.id);
    setDeleting(false);
  };

  const addPrereq = () => {
    if (!newPrereq) return;
    if (newPrereq === form.id) {
      setError("Cannot add itself as a prerequisite.");
      return;
    }
    if (form.prerequisites.includes(newPrereq)) return;
    setForm({ ...form, prerequisites: [...form.prerequisites, newPrereq] });
    setNewPrereq("");
  };

  const removePrereq = (id: string) =>
    setForm({ ...form, prerequisites: form.prerequisites.filter((p) => p !== id) });

  const availablePrereqs = allConcepts
    .filter((c) => c.id !== form.id && !form.prerequisites.includes(c.id));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-aristo-cream max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-aristo-brown flex items-center gap-2">
            <span className="font-mono text-xs text-aristo-brown/40">{form.id}</span>
          </DialogTitle>
          <DialogDescription>
            Edit concept fields and prerequisites.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Name" required>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputCls}
            />
          </Field>

          <Field label="Description">
            <textarea
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className={inputCls + " resize-none"}
            />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Difficulty">
              <Select
                value={String(form.difficulty)}
                onValueChange={(v) => setForm({ ...form, difficulty: parseInt(v, 10) })}
              >
                <SelectTrigger className="bg-white/60 border-white/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((v) => (
                    <SelectItem key={v} value={String(v)}>L{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Bloom level">
              <Select
                value={form.bloom_level}
                onValueChange={(v) => setForm({ ...form, bloom_level: v })}
              >
                <SelectTrigger className="bg-white/60 border-white/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BLOOMS.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Est. minutes">
              <input
                type="number"
                min={1}
                max={60}
                value={form.estimated_minutes}
                onChange={(e) => setForm({ ...form, estimated_minutes: parseInt(e.target.value, 10) || 5 })}
                className={inputCls}
              />
            </Field>
          </div>

          {/* Prerequisites */}
          <Field
            label={`Prerequisites (${form.prerequisites.length})`}
            hint="Drag a connection in the graph to add a prerequisite; remove via × here."
          >
            <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
              {form.prerequisites.length === 0 ? (
                <span className="text-xs text-aristo-brown/40">None — this is a foundational concept.</span>
              ) : (
                form.prerequisites.map((p) => {
                  const name = allConcepts.find((c) => c.id === p)?.name ?? p;
                  return (
                    <BrandBadge key={p} variant="orange" size="md">
                      <span className="font-mono">{p}</span>
                      <span className="text-aristo-brown/60">· {name}</span>
                      <button
                        type="button"
                        onClick={() => removePrereq(p)}
                        className="ml-1 text-aristo-brown/40 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </BrandBadge>
                  );
                })
              )}
            </div>
            <div className="flex gap-2">
              <Select value={newPrereq} onValueChange={setNewPrereq}>
                <SelectTrigger className="bg-white/60 border-white/60 flex-1">
                  <SelectValue placeholder="Add a prerequisite…" />
                </SelectTrigger>
                <SelectContent>
                  {availablePrereqs.length === 0 ? (
                    <SelectItem value="__none" disabled>No more concepts available</SelectItem>
                  ) : (
                    availablePrereqs.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name} ({c.id})</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <BrandButton variant="secondary" size="md" onClick={addPrereq} disabled={!newPrereq || newPrereq === "__none"}>
                Add
              </BrandButton>
            </div>
          </Field>

          {/* Lists */}
          <ListField
            label="Key terms"
            items={form.key_terms ?? []}
            onChange={(items) => setForm({ ...form, key_terms: items })}
          />
          <ListField
            label="Learning objectives"
            items={form.learning_objectives ?? []}
            onChange={(items) => setForm({ ...form, learning_objectives: items })}
            multiline
          />
          <ListField
            label="Common misconceptions"
            items={form.common_misconceptions ?? []}
            onChange={(items) => setForm({ ...form, common_misconceptions: items })}
            multiline
          />
          <ListField
            label="Tags"
            items={form.tags ?? []}
            onChange={(items) => setForm({ ...form, tags: items })}
          />

          {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}

          <div className="flex justify-between gap-2 pt-2 border-t border-white/60">
            {confirmDelete ? (
              <div className="flex gap-2">
                <BrandButton variant="destructive" size="sm" onClick={remove} disabled={deleting}>
                  {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Confirm delete
                </BrandButton>
                <BrandButton variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</BrandButton>
              </div>
            ) : (
              <BrandButton variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3.5 w-3.5" />Delete concept
              </BrandButton>
            )}

            <div className="flex gap-2">
              <BrandButton variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </BrandButton>
              <BrandButton variant="primary" size="sm" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save
              </BrandButton>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Field primitives ─────────────────────────────────────────────────────────

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

function ListField({
  label, items, onChange, multiline,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  multiline?: boolean;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const t = input.trim();
    if (!t || items.includes(t)) return;
    onChange([...items, t]);
    setInput("");
  };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <Field label={label}>
      {items.length > 0 && (
        <ul className="space-y-1 mb-2">
          {items.map((it, i) => (
            <li key={i} className="flex items-start gap-2 group bg-white/50 rounded-lg px-2.5 py-1.5">
              <span className="text-[10px] text-aristo-brown/30 mt-0.5 flex-shrink-0">{i + 1}.</span>
              <span className="flex-1 text-xs text-aristo-brown">{it}</span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-aristo-brown/40 hover:text-red-500 flex-shrink-0 opacity-0 group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        {multiline ? (
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Add a ${label.toLowerCase().replace(/s$/, "")}…`}
            rows={2}
            className={inputCls + " flex-1 resize-none"}
          />
        ) : (
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
            placeholder={`Add a ${label.toLowerCase().replace(/s$/, "")}…`}
            className={inputCls + " flex-1"}
          />
        )}
        <BrandButton variant="secondary" size="sm" onClick={add} disabled={!input.trim()}>
          Add
        </BrandButton>
      </div>
    </Field>
  );
}
