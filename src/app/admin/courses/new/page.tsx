"use client";

import { useState, useEffect } from "react";
import { useRouter }           from "next/navigation";
import Link                    from "next/link";
import {
  Wand2, FilePlus, Pencil, ArrowLeft, X, ArrowUp, ArrowDown, Plus,
} from "lucide-react";
import { PageHeader }   from "@/components/admin/PageHeader";
import { BrandCard }    from "@/components/admin/ui/BrandCard";
import { BrandButton }  from "@/components/admin/ui/BrandButton";
import { BrandBadge }   from "@/components/admin/ui/BrandBadge";
import { SectionTitle } from "@/components/admin/ui/SectionTitle";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────

type Method = "manual" | "from-kg";

interface ConceptRow {
  id: string;
  name: string;
  difficulty: number;
  bloom_level: string;
  estimated_minutes: number;
}

type StructureMode = "linear" | "byBloom" | "byDifficulty";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewCoursePage() {
  const router = useRouter();
  const [method, setMethod] = useState<Method>("manual");

  return (
    <>
      <PageHeader
        title="New course"
        subtitle="Either type a lesson list manually or wrap an existing knowledge-graph domain into a structured course."
        actions={
          <Link href="/admin/courses">
            <BrandButton variant="ghost" size="sm">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to courses
            </BrandButton>
          </Link>
        }
      />

      <Tabs
        value={method}
        onValueChange={(v) => setMethod(v as Method)}
        className="w-full max-w-3xl"
      >
        <TabsList className="bg-white/60 border border-white/40 rounded-xl p-1">
          <TabsTrigger
            value="manual"
            className="data-[state=active]:bg-aristo-orange data-[state=active]:text-white rounded-lg"
          >
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Manual
          </TabsTrigger>
          <TabsTrigger
            value="from-kg"
            className="data-[state=active]:bg-aristo-orange data-[state=active]:text-white rounded-lg"
          >
            <Wand2 className="h-3.5 w-3.5 mr-1.5" />
            From knowledge graph
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="mt-4">
          <ManualForm onCreated={() => router.push("/admin/courses")} />
        </TabsContent>

        <TabsContent value="from-kg" className="mt-4">
          <FromKgForm onCreated={() => router.push("/admin/courses")} />
        </TabsContent>
      </Tabs>
    </>
  );
}

// ─── Manual entry ─────────────────────────────────────────────────────────────

function ManualForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle]             = useState("");
  const [domain, setDomain]           = useState("");
  const [description, setDescription] = useState("");
  const [lessons, setLessons]         = useState<string[]>([]);
  const [lessonInput, setLessonInput] = useState("");
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");

  const addLesson = () => {
    const t = lessonInput.trim();
    if (t && !lessons.includes(t)) {
      setLessons((p) => [...p, t]);
      setLessonInput("");
    }
  };

  const moveLesson = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= lessons.length) return;
    const next = [...lessons];
    [next[i], next[j]] = [next[j], next[i]];
    setLessons(next);
  };

  const removeLesson = (i: number) =>
    setLessons((p) => p.filter((_, idx) => idx !== i));

  const save = async (publish: boolean) => {
    if (!title.trim())     { setError("Title is required."); return; }
    if (!domain.trim())    { setError("Domain is required."); return; }
    if (lessons.length < 2) { setError("Add at least 2 lessons."); return; }
    setError("");
    setSaving(true);

    const structure = {
      modules: [
        {
          id:          "mod_main",
          title:       title.trim(),
          description: description.trim() || "",
          lessons:     lessons.map((t, i) => ({
            id:          `lesson_${i + 1}`,
            title:       t,
            concept_ids: [] as string[],
          })),
        },
      ],
    };

    try {
      const res = await fetch("/api/admin/courses", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          domain:       domain.trim(),
          title:        title.trim(),
          description:  description.trim() || null,
          structure,
          is_published: publish,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Save failed"); return; }
      onCreated();
    } catch {
      setError("Save failed — try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BrandCard padding="lg" className="space-y-5">
      <Field label="Course title" required>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Human Body Systems"
          className={inputCls}
        />
      </Field>

      <Field
        label="Domain"
        required
        hint={<>snake_case identifier — e.g. <code>human_body_systems</code></>}
      >
        <input
          value={domain}
          onChange={(e) =>
            setDomain(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))
          }
          placeholder="e.g. human_body_systems"
          className={inputCls + " font-mono"}
        />
      </Field>

      <Field label="Description" hint="One sentence shown to students.">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this course about?"
          className={inputCls}
        />
      </Field>

      <Field label={`Lessons (${lessons.length} added)`}>
        {lessons.length > 0 && (
          <ol className="space-y-1.5 mb-3">
            {lessons.map((t, i) => (
              <li key={i} className="flex items-center gap-2 group">
                <span className="w-5 text-xs text-aristo-brown/40 text-right flex-shrink-0">
                  {i + 1}.
                </span>
                <span className="flex-1 text-sm text-aristo-brown bg-white/60 rounded-lg px-2.5 py-1.5">
                  {t}
                </span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <IconBtn onClick={() => moveLesson(i, -1)} disabled={i === 0} title="Move up">
                    <ArrowUp className="h-3 w-3" />
                  </IconBtn>
                  <IconBtn onClick={() => moveLesson(i, 1)} disabled={i === lessons.length - 1} title="Move down">
                    <ArrowDown className="h-3 w-3" />
                  </IconBtn>
                  <IconBtn onClick={() => removeLesson(i)} title="Remove" variant="danger">
                    <X className="h-3 w-3" />
                  </IconBtn>
                </div>
              </li>
            ))}
          </ol>
        )}
        <div className="flex gap-2">
          <input
            value={lessonInput}
            onChange={(e) => setLessonInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addLesson())}
            placeholder="Add a lesson and press Enter…"
            className={inputCls + " flex-1"}
          />
          <BrandButton variant="secondary" size="md" onClick={addLesson} disabled={!lessonInput.trim()}>
            <Plus className="h-3.5 w-3.5" />
            Add
          </BrandButton>
        </div>
      </Field>

      {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}

      <div className="flex gap-3 pt-2">
        <BrandButton variant="secondary" onClick={() => save(false)} disabled={saving} className="flex-1">
          Save as draft
        </BrandButton>
        <BrandButton variant="primary" onClick={() => save(true)} disabled={saving} className="flex-1">
          {saving ? "Saving…" : "Save & publish"}
        </BrandButton>
      </div>
    </BrandCard>
  );
}

// ─── From knowledge graph ─────────────────────────────────────────────────────

function FromKgForm({ onCreated }: { onCreated: () => void }) {
  const [domain, setDomain]             = useState("");
  const [title, setTitle]               = useState("");
  const [description, setDescription]   = useState("");
  const [structureMode, setStructureMode] = useState<StructureMode>("byBloom");

  const [concepts, setConcepts]         = useState<ConceptRow[] | null>(null);
  const [loadingConcepts, setLoading]   = useState(false);
  const [selected, setSelected]         = useState<Set<string>>(new Set());
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState("");

  // Load concepts when domain changes (debounced via blur)
  const loadConcepts = async () => {
    if (!domain.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/kg/${domain.trim()}`);
      if (!res.ok) {
        setConcepts([]);
        setError("No concepts found for this domain. Generate them in the Knowledge Graph tab first.");
        return;
      }
      const data = await res.json();
      setConcepts(data.concepts ?? []);
      setSelected(new Set((data.concepts ?? []).map((c: ConceptRow) => c.id)));
    } catch {
      setError("Failed to load concepts.");
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (!concepts) return;
    if (selected.size === concepts.length) setSelected(new Set());
    else setSelected(new Set(concepts.map((c) => c.id)));
  };

  const save = async (publish: boolean) => {
    if (!title.trim())     { setError("Title is required."); return; }
    if (!domain.trim())    { setError("Domain is required."); return; }
    if (selected.size === 0) { setError("Select at least 1 concept."); return; }
    setError("");
    setSaving(true);

    try {
      // First create the course
      const res = await fetch("/api/admin/courses/from-kg", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          domain:       domain.trim(),
          title:        title.trim(),
          description:  description.trim() || null,
          conceptIds:   Array.from(selected),
          structureMode,
          is_published: publish,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Save failed"); return; }
      onCreated();
    } catch {
      setError("Save failed — try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BrandCard padding="lg" className="space-y-5">
      <SectionTitle
        title="Wrap an existing knowledge graph into a course"
        description="The selected concepts are grouped automatically per the chosen layout. Generate concepts in the Knowledge Graph tab first."
      />

      <Field
        label="Domain"
        required
        hint="Must match an existing concept domain."
      >
        <div className="flex gap-2">
          <input
            value={domain}
            onChange={(e) =>
              setDomain(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))
            }
            onBlur={loadConcepts}
            placeholder="e.g. python_programming"
            className={inputCls + " font-mono flex-1"}
          />
          <BrandButton
            variant="secondary"
            size="md"
            onClick={loadConcepts}
            disabled={loadingConcepts || !domain.trim()}
          >
            {loadingConcepts ? "Loading…" : "Load concepts"}
          </BrandButton>
        </div>
      </Field>

      <Field label="Course title" required>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Introduction to Python"
          className={inputCls}
        />
      </Field>

      <Field label="Description" hint="Optional one-liner shown to students.">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this course teach?"
          className={inputCls}
        />
      </Field>

      <Field label="Module layout">
        <Select
          value={structureMode}
          onValueChange={(v) => setStructureMode(v as StructureMode)}
        >
          <SelectTrigger className="bg-white/60 border-white/60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="linear">Single module · one lesson per concept</SelectItem>
            <SelectItem value="byBloom">Module per Bloom level</SelectItem>
            <SelectItem value="byDifficulty">Module per difficulty band</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {concepts !== null && (
        <Field
          label={`Concepts (${selected.size}/${concepts.length} selected)`}
          hint={
            <button
              type="button"
              onClick={toggleAll}
              className="underline hover:text-aristo-orange"
            >
              {selected.size === concepts.length ? "Clear all" : "Select all"}
            </button>
          }
        >
          {concepts.length === 0 ? (
            <p className="text-xs text-aristo-brown/50">No concepts in this domain.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-xl bg-white/40 border border-white/40 divide-y divide-white/60">
              {concepts.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-3 p-2.5 hover:bg-white/60 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                    className="h-3.5 w-3.5 accent-aristo-orange"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-aristo-brown font-medium truncate">
                      {c.name}
                    </div>
                    <div className="text-[10px] text-aristo-brown/40 font-mono truncate">
                      {c.id}
                    </div>
                  </div>
                  <BrandBadge variant="orange">L{c.difficulty}</BrandBadge>
                  <BrandBadge variant="purple">{c.bloom_level}</BrandBadge>
                  <span className="text-[10px] text-aristo-brown/40 w-10 text-right">
                    {c.estimated_minutes}m
                  </span>
                </label>
              ))}
            </div>
          )}
        </Field>
      )}

      {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}

      <div className="flex gap-3 pt-2">
        <BrandButton variant="secondary" onClick={() => save(false)} disabled={saving} className="flex-1">
          Save as draft
        </BrandButton>
        <BrandButton variant="primary" onClick={() => save(true)} disabled={saving} className="flex-1">
          {saving ? "Saving…" : "Save & publish"}
        </BrandButton>
      </div>
    </BrandCard>
  );
}

// ─── Internals ────────────────────────────────────────────────────────────────

const inputCls =
  "text-sm bg-white/60 border border-white/60 rounded-xl px-3 py-2 text-aristo-brown placeholder:text-aristo-brown/40 focus:outline-none focus:ring-2 focus:ring-aristo-orange/40 w-full";

function Field({
  label,
  required,
  hint,
  children,
}: {
  label:    string;
  required?: boolean;
  hint?:    React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-end justify-between mb-1.5 gap-3">
        <label className="block text-xs font-semibold text-aristo-brown/70 uppercase tracking-wider">
          {label}
          {required && <span className="text-aristo-orange ml-0.5">*</span>}
        </label>
        {hint && (
          <span className="text-[10px] text-aristo-brown/50 normal-case">
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function IconBtn({
  children, onClick, disabled, title, variant = "default",
}: {
  children: React.ReactNode;
  onClick:  () => void;
  disabled?: boolean;
  title?:   string;
  variant?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={
        "px-1.5 py-0.5 rounded transition-colors disabled:opacity-30 " +
        (variant === "danger"
          ? "text-red-400 hover:bg-red-50"
          : "text-aristo-brown/60 hover:bg-white/80")
      }
    >
      {children}
    </button>
  );
}
