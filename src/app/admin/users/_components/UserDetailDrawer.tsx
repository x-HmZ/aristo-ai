"use client";

import { useEffect, useState }       from "react";
import {
  ShieldCheck, ShieldOff, RotateCcw, Trash2, Loader2,
  Brain, Activity, FileQuestion, AlertTriangle, User as UserIcon,
} from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { BrandBadge, EXPERTISE_COLOR, BLOOM_COLOR } from "@/components/admin/ui/BrandBadge";
import { BrandButton }   from "@/components/admin/ui/BrandButton";
import { BrandCard }     from "@/components/admin/ui/BrandCard";
import { SectionTitle }  from "@/components/admin/ui/SectionTitle";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MasteryRow {
  concept_id:                string;
  mastery_score:             number;
  assessment_count:          number;
  last_assessed:             string | null;
  srs_interval_days:         number | null;
  srs_next_review:           string | null;
  srs_consecutive_correct:   number | null;
  srs_lapses:                number | null;
  concepts: { name: string; domain: string; bloom_level: string; difficulty: number } | null;
}

interface Misconception {
  id:               string;
  concept_id:       string;
  misconception:    string;
  occurrence_count: number;
  last_detected:    string | null;
  resolved:         boolean;
  concepts: { name: string } | null;
}

interface Session {
  id:                              string;
  session_start:                   string;
  session_end:                     string | null;
  time_on_explanations_seconds:    number;
  time_on_examples_seconds:        number;
  time_on_quizzes_seconds:         number;
  clicked_explain_more:            number;
  clicked_show_example:            number;
  clicked_skip_to_quiz:            number;
  quiz_accuracy:                   number | null;
  questions_attempted:             number;
  questions_correct:               number;
}

interface Quiz {
  id:                     string;
  concept_id:             string;
  bloom_level:            string | null;
  question_type:          string;
  is_correct:             boolean;
  score:                  number | null;
  response_time_seconds:  number | null;
  misconception_detected: string | null;
  context:                string | null;
  created_at:             string;
  concepts: { name: string } | null;
}

interface UserDetail {
  profile: {
    id:                 string;
    email:              string | null;
    full_name:          string | null;
    goal:               string | null;
    daily_time_minutes: number | null;
    is_admin:           boolean;
    created_at:         string;
    updated_at:         string;
  };
  learnerProfile: {
    expertise_level:        string | null;
    pace:                   string | null;
    explanation_depth:      string | null;
    example_preference:     string | null;
    engagement_pattern:     string | null;
    weakest_bloom_level:    string | null;
    strongest_bloom_level:  string | null;
    custom_teacher_glb_url: string | null;
    updated_at:             string | null;
  } | null;
  mastery:        MasteryRow[];
  misconceptions: Misconception[];
  sessions:       Session[];
  quizzes:        Quiz[];
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  userId:   string | null;
  open:     boolean;
  onClose:  () => void;
  /** Called after a destructive mutation succeeds — refresh the parent list. */
  onMutated?: () => void;
}

export function UserDetailDrawer({ userId, open, onClose, onMutated }: Props) {
  const [data, setData]         = useState<UserDetail | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [busy, setBusy]         = useState<"toggle" | "reset" | "delete" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReset, setConfirmReset]   = useState(false);

  useEffect(() => {
    if (!userId || !open) return;
    let cancelled = false;
    setData(null);
    setError(null);
    setLoading(true);
    setConfirmDelete(false);
    setConfirmReset(false);
    fetch(`/api/admin/users/${userId}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Failed (${r.status})`);
        const json = await r.json();
        if (!cancelled) setData(json);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [userId, open]);

  const refresh = async () => {
    if (!userId) return;
    const r = await fetch(`/api/admin/users/${userId}`, { cache: "no-store" });
    if (r.ok) setData(await r.json());
  };

  const toggleAdmin = async () => {
    if (!data) return;
    setBusy("toggle");
    await fetch(`/api/admin/users/${data.profile.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ is_admin: !data.profile.is_admin }),
    });
    await refresh();
    onMutated?.();
    setBusy(null);
  };

  const resetMastery = async () => {
    if (!data) return;
    setBusy("reset");
    await fetch(`/api/admin/users/${data.profile.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ reset_mastery: true }),
    });
    await refresh();
    setBusy(null);
    setConfirmReset(false);
  };

  const deleteAccount = async () => {
    if (!data) return;
    setBusy("delete");
    const r = await fetch(`/api/admin/users/${data.profile.id}`, { method: "DELETE" });
    if (r.ok) {
      onMutated?.();
      onClose();
    }
    setBusy(null);
    setConfirmDelete(false);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto bg-aristo-cream">
        <SheetHeader>
          <SheetTitle className="text-aristo-brown">
            {data?.profile.full_name ?? "User detail"}
          </SheetTitle>
          <SheetDescription>
            {loading
              ? "Loading…"
              : error
                ? error
                : data?.profile.email ?? data?.profile.id}
          </SheetDescription>
        </SheetHeader>

        {loading && (
          <div className="py-12 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-aristo-orange" />
          </div>
        )}

        {data && (
          <div className="mt-4">
            <Tabs defaultValue="profile">
              <TabsList className="bg-white/60 border border-white/40 rounded-xl p-1 flex flex-wrap h-auto">
                <TabsTrigger value="profile" className="data-[state=active]:bg-aristo-orange data-[state=active]:text-white rounded-lg">
                  <UserIcon className="h-3.5 w-3.5 mr-1.5" />Profile
                </TabsTrigger>
                <TabsTrigger value="mastery" className="data-[state=active]:bg-aristo-orange data-[state=active]:text-white rounded-lg">
                  <Brain className="h-3.5 w-3.5 mr-1.5" />Mastery
                </TabsTrigger>
                <TabsTrigger value="sessions" className="data-[state=active]:bg-aristo-orange data-[state=active]:text-white rounded-lg">
                  <Activity className="h-3.5 w-3.5 mr-1.5" />Sessions
                </TabsTrigger>
                <TabsTrigger value="quizzes" className="data-[state=active]:bg-aristo-orange data-[state=active]:text-white rounded-lg">
                  <FileQuestion className="h-3.5 w-3.5 mr-1.5" />Quizzes
                </TabsTrigger>
                <TabsTrigger value="misconceptions" className="data-[state=active]:bg-aristo-orange data-[state=active]:text-white rounded-lg">
                  <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />Misconceptions
                </TabsTrigger>
              </TabsList>

              {/* ── Profile ──────────────────────────────────────────────── */}
              <TabsContent value="profile" className="mt-4 space-y-4">
                <BrandCard>
                  <SectionTitle title="Static profile" />
                  <dl className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                    <Row label="Name"      value={data.profile.full_name ?? "—"} />
                    <Row label="Email"     value={data.profile.email ?? "—"} />
                    <Row label="Goal"      value={data.profile.goal?.replace(/_/g, " ") ?? "—"} />
                    <Row label="Daily target"  value={`${data.profile.daily_time_minutes ?? "—"} min`} />
                    <Row label="Joined"    value={new Date(data.profile.created_at).toLocaleDateString()} />
                    <Row label="Updated"   value={new Date(data.profile.updated_at).toLocaleDateString()} />
                    <Row label="Role"      value={data.profile.is_admin ? <BrandBadge variant="orange">Admin</BrandBadge> : "Learner"} />
                  </dl>
                </BrandCard>

                <BrandCard variant="cream">
                  <SectionTitle title="Dynamic learner profile" description="Inferred from behavioral signals." />
                  {!data.learnerProfile ? (
                    <p className="text-xs text-aristo-brown/50">No learner profile yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {data.learnerProfile.expertise_level && (
                        <BrandBadge variant={EXPERTISE_COLOR[data.learnerProfile.expertise_level] ?? "neutral"} size="md">
                          Expertise · {data.learnerProfile.expertise_level}
                        </BrandBadge>
                      )}
                      {data.learnerProfile.pace && (
                        <BrandBadge variant="blue" size="md">Pace · {data.learnerProfile.pace}</BrandBadge>
                      )}
                      {data.learnerProfile.explanation_depth && (
                        <BrandBadge variant="purple" size="md">Depth · {data.learnerProfile.explanation_depth}</BrandBadge>
                      )}
                      {data.learnerProfile.example_preference && (
                        <BrandBadge variant="amber" size="md">Examples · {data.learnerProfile.example_preference}</BrandBadge>
                      )}
                      {data.learnerProfile.engagement_pattern && (
                        <BrandBadge variant="green" size="md">Engagement · {data.learnerProfile.engagement_pattern}</BrandBadge>
                      )}
                      {data.learnerProfile.strongest_bloom_level && (
                        <BrandBadge variant={BLOOM_COLOR[data.learnerProfile.strongest_bloom_level] ?? "neutral"} size="md">
                          ↑ {data.learnerProfile.strongest_bloom_level}
                        </BrandBadge>
                      )}
                      {data.learnerProfile.weakest_bloom_level && (
                        <BrandBadge variant={BLOOM_COLOR[data.learnerProfile.weakest_bloom_level] ?? "neutral"} size="md">
                          ↓ {data.learnerProfile.weakest_bloom_level}
                        </BrandBadge>
                      )}
                    </div>
                  )}
                  {data.learnerProfile?.custom_teacher_glb_url && (
                    <div className="mt-3 text-[11px] text-aristo-brown/60 font-mono break-all">
                      Custom teacher: {data.learnerProfile.custom_teacher_glb_url}
                    </div>
                  )}
                </BrandCard>

                {/* Danger zone */}
                <BrandCard variant="danger">
                  <SectionTitle
                    title="Danger zone"
                    description="Audited actions. All write to admin_audit_log."
                  />
                  <div className="flex flex-wrap gap-2">
                    <BrandButton
                      variant={data.profile.is_admin ? "secondary" : "purple"}
                      size="sm"
                      onClick={toggleAdmin}
                      disabled={busy === "toggle"}
                    >
                      {data.profile.is_admin ? (
                        <><ShieldOff className="h-3.5 w-3.5" />Demote admin</>
                      ) : (
                        <><ShieldCheck className="h-3.5 w-3.5" />Promote to admin</>
                      )}
                    </BrandButton>

                    {confirmReset ? (
                      <>
                        <BrandButton variant="destructive" size="sm" onClick={resetMastery} disabled={busy === "reset"}>
                          {busy === "reset" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                          Confirm reset
                        </BrandButton>
                        <BrandButton variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>Cancel</BrandButton>
                      </>
                    ) : (
                      <BrandButton variant="outline" size="sm" onClick={() => setConfirmReset(true)}>
                        <RotateCcw className="h-3.5 w-3.5" />Reset mastery
                      </BrandButton>
                    )}

                    {confirmDelete ? (
                      <>
                        <BrandButton variant="destructive" size="sm" onClick={deleteAccount} disabled={busy === "delete"}>
                          {busy === "delete" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          Confirm delete
                        </BrandButton>
                        <BrandButton variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</BrandButton>
                      </>
                    ) : (
                      <BrandButton variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
                        <Trash2 className="h-3.5 w-3.5" />Delete account
                      </BrandButton>
                    )}
                  </div>
                </BrandCard>
              </TabsContent>

              {/* ── Mastery ──────────────────────────────────────────────── */}
              <TabsContent value="mastery" className="mt-4">
                <BrandCard padding="none">
                  <div className="px-5 pt-5">
                    <SectionTitle
                      title="Concept mastery"
                      description={`${data.mastery.length} assessed concepts, sorted by score.`}
                    />
                  </div>
                  {data.mastery.length === 0 ? (
                    <p className="px-5 pb-5 text-xs text-aristo-brown/50">No quiz activity yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Concept</TableHead>
                          <TableHead>Domain</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>SRS</TableHead>
                          <TableHead>Next review</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.mastery.map((m) => (
                          <TableRow key={m.concept_id}>
                            <TableCell className="text-aristo-brown font-medium max-w-[200px] truncate">
                              {m.concepts?.name ?? m.concept_id}
                            </TableCell>
                            <TableCell className="text-xs text-aristo-brown/60 font-mono truncate max-w-[140px]">
                              {m.concepts?.domain ?? "—"}
                            </TableCell>
                            <TableCell>
                              <MasteryBar value={m.mastery_score} />
                            </TableCell>
                            <TableCell className="text-xs text-aristo-brown/70">
                              {m.srs_interval_days ? `${m.srs_interval_days}d` : "—"}
                              <span className="text-aristo-brown/40 ml-1">
                                ({m.srs_consecutive_correct ?? 0}/{m.srs_lapses ?? 0})
                              </span>
                            </TableCell>
                            <TableCell className="text-[11px] text-aristo-brown/60">
                              {m.srs_next_review ? new Date(m.srs_next_review).toLocaleDateString() : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </BrandCard>
              </TabsContent>

              {/* ── Sessions ─────────────────────────────────────────────── */}
              <TabsContent value="sessions" className="mt-4">
                <BrandCard padding="none">
                  <div className="px-5 pt-5">
                    <SectionTitle
                      title="Recent sessions"
                      description={`Last ${data.sessions.length} session_logs entries.`}
                    />
                  </div>
                  {data.sessions.length === 0 ? (
                    <p className="px-5 pb-5 text-xs text-aristo-brown/50">No sessions logged yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Start</TableHead>
                          <TableHead>Time spent</TableHead>
                          <TableHead>Quiz acc.</TableHead>
                          <TableHead>Clicks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.sessions.map((s) => {
                          const totalSec = s.time_on_explanations_seconds + s.time_on_examples_seconds + s.time_on_quizzes_seconds;
                          return (
                            <TableRow key={s.id}>
                              <TableCell className="text-xs text-aristo-brown/70">
                                {new Date(s.session_start).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-xs text-aristo-brown/70 tabular-nums">
                                {Math.round(totalSec / 60)} min
                              </TableCell>
                              <TableCell>
                                {s.questions_attempted > 0 ? (
                                  <BrandBadge
                                    variant={s.quiz_accuracy && s.quiz_accuracy >= 0.7 ? "green" : s.quiz_accuracy && s.quiz_accuracy >= 0.5 ? "orange" : "red"}
                                    size="md"
                                  >
                                    {Math.round((s.quiz_accuracy ?? 0) * 100)}% ({s.questions_correct}/{s.questions_attempted})
                                  </BrandBadge>
                                ) : <span className="text-xs text-aristo-brown/40">—</span>}
                              </TableCell>
                              <TableCell className="text-[11px] text-aristo-brown/60">
                                {s.clicked_explain_more}🛈 · {s.clicked_show_example}📌 · {s.clicked_skip_to_quiz}⏭
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </BrandCard>
              </TabsContent>

              {/* ── Quizzes ──────────────────────────────────────────────── */}
              <TabsContent value="quizzes" className="mt-4">
                <BrandCard padding="none">
                  <div className="px-5 pt-5">
                    <SectionTitle
                      title="Recent quiz attempts"
                      description={`Last ${data.quizzes.length} attempts.`}
                    />
                  </div>
                  {data.quizzes.length === 0 ? (
                    <p className="px-5 pb-5 text-xs text-aristo-brown/50">No quiz attempts yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Concept</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Bloom</TableHead>
                          <TableHead>Result</TableHead>
                          <TableHead>When</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.quizzes.map((q) => (
                          <TableRow key={q.id}>
                            <TableCell className="text-aristo-brown font-medium max-w-[200px] truncate">
                              {q.concepts?.name ?? q.concept_id}
                            </TableCell>
                            <TableCell className="text-xs text-aristo-brown/60 capitalize truncate max-w-[110px]">
                              {q.question_type.replace(/_/g, " ")}
                            </TableCell>
                            <TableCell>
                              {q.bloom_level ? (
                                <BrandBadge variant={BLOOM_COLOR[q.bloom_level] ?? "neutral"}>
                                  {q.bloom_level}
                                </BrandBadge>
                              ) : <span className="text-xs text-aristo-brown/40">—</span>}
                            </TableCell>
                            <TableCell>
                              <BrandBadge variant={q.is_correct ? "green" : "red"} size="md">
                                {q.is_correct ? "✓" : "✗"}
                                {q.score !== null && (
                                  <span className="ml-1 opacity-70">{Math.round(q.score * 100)}%</span>
                                )}
                              </BrandBadge>
                            </TableCell>
                            <TableCell className="text-[11px] text-aristo-brown/60">
                              {new Date(q.created_at).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </BrandCard>
              </TabsContent>

              {/* ── Misconceptions ───────────────────────────────────────── */}
              <TabsContent value="misconceptions" className="mt-4">
                <BrandCard padding="none">
                  <div className="px-5 pt-5">
                    <SectionTitle
                      title="Detected misconceptions"
                      description={`${data.misconceptions.length} entries. Resolved ones are dimmed.`}
                    />
                  </div>
                  {data.misconceptions.length === 0 ? (
                    <p className="px-5 pb-5 text-xs text-aristo-brown/50">No misconceptions detected.</p>
                  ) : (
                    <div className="divide-y divide-white/60">
                      {data.misconceptions.map((m) => (
                        <div
                          key={m.id}
                          className={`px-5 py-3 ${m.resolved ? "opacity-50" : ""}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm text-aristo-brown font-medium">
                                {m.concepts?.name ?? m.concept_id}
                              </div>
                              <div className="text-xs text-aristo-brown/70 mt-1">
                                {m.misconception}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              <BrandBadge variant={m.resolved ? "green" : "red"} size="md">
                                {m.occurrence_count}× {m.resolved ? "resolved" : "active"}
                              </BrandBadge>
                              {m.last_detected && (
                                <span className="text-[10px] text-aristo-brown/40">
                                  {new Date(m.last_detected).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </BrandCard>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-aristo-brown/50 font-semibold uppercase tracking-wider text-[10px] pt-1">
        {label}
      </dt>
      <dd className="text-aristo-brown">{value}</dd>
    </>
  );
}

function MasteryBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 80 ? "#22C55E" :
    pct >= 50 ? "#F97B2F" :
                "#EF4444";
  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <div className="flex-1 bg-white/60 rounded-full h-2 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[11px] text-aristo-brown/70 tabular-nums w-9 text-right">
        {pct}%
      </span>
    </div>
  );
}
