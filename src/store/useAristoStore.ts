import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { LessonPayload }    from "@/lib/agents/teaching";
import type { CourseStructure }  from "@/lib/agents/curriculum";
import type { QuizQuestion }     from "@/lib/agents/assessment";

export type { LessonPayload, CourseStructure };

// ─── Types ───────────────────────────────────────────────────────────────────

export type TeacherMode   = "course" | "free";
export type TeacherAvatar =
  | "ryan"
  | "sonia"
  | "marcus"   // realistic adult male — drop Teacher_Marcus.glb + animations_Marcus.glb
  | "priya"    // realistic adult female — drop Teacher_Priya.glb + animations_Priya.glb
  | "custom";  // Avaturn-generated avatar
export type Classroom     = "default" | "alternative" | "none";

/**
 * Avatar gesture override.
 *
 * `idle` is the resting state — Teacher.tsx falls back to its
 * isLoading→thinking / isSpeaking→talking / else→idle resolution.
 *
 * Anything else explicitly overrides that resolution. `pointing` is layered
 * on top of talking so the avatar can talk-while-pointing during a
 * visual_walkthrough; nodding/shaking play once and auto-revert to idle.
 */
export type AvatarGesture =
  | "idle"
  | "pointing"
  | "nodding"
  | "shaking"
  | "explaining";  // deliberate lecturing pose; falls back to talking pool until a dedicated clip exists

// ─── Learner profile (dynamic, behaviorally inferred) ────────────────────────

export interface DynamicProfile {
  expertise_level:    "beginner" | "intermediate" | "advanced";
  pace:               "fast" | "moderate" | "careful";
  explanation_depth:  "concise" | "moderate" | "detailed";
  example_preference: "abstract" | "concrete" | "mixed";
  weakest_bloom_level?:  string;
  strongest_bloom_level?: string;
}

// ─── Per-concept mastery ──────────────────────────────────────────────────────

export interface MasteryEntry {
  mastery_score:          number;   // 0.0–1.0
  assessment_count:       number;
  srs_next_review?:       string;   // ISO date string
  srs_interval_days?:     number;
  srs_consecutive_correct?: number;
}

// ─── Behavioral signals (buffered per session, flushed on close) ─────────────

export interface BehavioralSignals {
  time_on_explanations_seconds: number;
  time_on_examples_seconds:     number;
  time_on_quizzes_seconds:      number;
  clicked_explain_more:         number;
  clicked_show_example:         number;
  clicked_skip_to_quiz:         number;
  questions_attempted:          number;
  questions_correct:            number;
}

// ─── Message types ────────────────────────────────────────────────────────────

/**
 * Chat message: individual turn in a side-channel Q&A or clarification.
 */
export interface ChatMessage {
  id:        string;
  type:      "chat";
  role:      "user" | "assistant";
  content:   string;
  timestamp: number;
}

export type Message = ChatMessage;

// ─── Quiz (legacy MCQ — kept for course-flow compatibility, replaced in Phase 4) ──

export interface MCQQuestion {
  question: string;
  options:  string[];
  correct:  string;
}

export interface QuizState {
  questions:    MCQQuestion[];
  currentIndex: number;
  answers:      string[];
  score:        number | null;
  isActive:     boolean;
}

// ─── Course ──────────────────────────────────────────────────────────────────

export interface CourseState {
  courseId:          string | null;
  title:             string;
  domain:            string;
  topics:            string[];          // flat list of concept IDs (flattened from structure)
  currentTopicIndex: number;
  sessionId:         string | null;
  structure:         CourseStructure | null;
}

// ─── Store interface ──────────────────────────────────────────────────────────

interface AristoState {
  // User
  userId: string | null;

  // Learner profile (from DB, synced on load)
  profile:            DynamicProfile | null;
  masteryByConcept:   Record<string, MasteryEntry>;
  currentConceptId:   string | null;
  onboardingDone:     boolean;  // whether /api/auth/onboarding has been completed

  // Behavioral signals (accumulated this session)
  behavioralSignals: BehavioralSignals;

  // Teacher settings
  teacher:   TeacherAvatar;
  classroom: Classroom;

  // Session mode
  mode:   TeacherMode;
  course: CourseState;

  // Active 5-phase lesson (course mode — set by useCourseAutoTeach)
  activeLesson: LessonPayload | null;

  // Messages (side-channel Q&A only — lesson content lives in LessonView)
  messages:  Message[];
  isLoading: boolean;

  // 3D model (experience shell)
  activeModelUrl:        string | null;
  activePreviewImageUrl: string | null; // educational image shown while 3D runs (or alone, if user opts out of 3D)
  previewZoomUrl:        string | null; // set when user clicks image to zoom in
  isGeneratingModel:     boolean;
  modelInteracting:      boolean;       // true while user drags/hovers model — disables OrbitControls
  pending3dImageUrl:     string | null; // FLUX image waiting for user to opt into 3D conversion
  viewMode3d:            boolean;       // true → show 3D model; false → show image (when both available)

  // Custom teacher (Ready Player Me URL persisted in learner_profiles)
  customTeacherGlbUrl:   string | null;

  // Quiz (Phase 4 will replace this with the full QuizView)
  quiz: QuizState;

  // Audio
  isSpeaking:   boolean;
  currentAudio: HTMLAudioElement | null;

  // Avatar gesture (overrides isLoading/isSpeaking-derived animation when not "idle")
  gesture: AvatarGesture;

  // Active narration segment id (set by useLessonPlayback, consumed by LessonPlayer to highlight current text)
  currentSegmentId: string | null;

  // True when the lesson is paused waiting on a student answer to a challenge
  // segment.  Consumed by the 3D scene to render a "Your turn 🎙" bubble next
  // to the avatar, and by the right panel to mount the AnswerInputPanel.
  awaitingAnswer: boolean;

  /**
   * Active in-scene quiz.  When non-null:
   *   • the CameraController tilts the camera down toward the desk paper,
   *   • the desk paper unmounts its ambient canvas-text and mounts
   *     <QuizView/> via <Html transform> at full readable scale,
   *   • OrbitControls is disabled,
   *   • the right-panel bottom bar collapses to a status strip.
   * Cleared by LearnClient when the quiz completes — the camera lerps back
   * to the lesson framing and the lesson-complete advance bar takes over.
   */
  activeQuiz: { conceptId: string; questions: QuizQuestion[] } | null;

  /**
   * Most recent quiz result (score/total).  Set by the in-scene DeskQuiz
   * when QuizView fires onComplete, consumed by LearnClient to render
   * <CourseAdvanceBar/>.  Cleared on lesson advance.
   */
  quizResult: { score: number; total: number } | null;

  /**
   * True once the R3F scene has painted at least one frame after the initial
   * asset Suspense resolves. Not persisted — resets to false on every fresh
   * page load so SceneLoadingOverlay (src/components/learn) knows when it is
   * safe to fade out without a flash of an unrendered/black canvas.
   */
  sceneReady: boolean;

  // ── Actions ──────────────────────────────────────────────────────────────

  setUserId: (id: string | null) => void;

  // Profile & mastery
  setProfile:          (p: DynamicProfile | null) => void;
  setMasteryByConcept: (m: Record<string, MasteryEntry>) => void;
  updateConceptMastery:(conceptId: string, entry: Partial<MasteryEntry>) => void;
  setCurrentConceptId: (id: string | null) => void;
  setOnboardingDone:   (done: boolean) => void;

  // Behavioral signals
  incrementSignal: (key: keyof BehavioralSignals, by?: number) => void;
  resetSignals:    () => void;

  // Teacher settings
  setTeacher:   (t: TeacherAvatar) => void;
  setClassroom: (c: Classroom)     => void;

  // Mode
  setMode:      (m: TeacherMode)            => void;
  setCourse:    (c: Partial<CourseState>)   => void;
  advanceTopic: ()                          => void;

  // Lesson
  setActiveLesson: (lesson: LessonPayload | null) => void;

  // Messages
  addMessage:    (m: Message) => void;
  setIsLoading:  (l: boolean) => void;
  clearMessages: ()           => void;

  // 3D model
  setActiveModelUrl:        (url: string | null) => void;
  setActivePreviewImageUrl: (url: string | null) => void;
  setPreviewZoomUrl:        (url: string | null) => void;
  setIsGeneratingModel:     (gen: boolean)       => void;
  setModelInteracting:      (v: boolean)         => void;
  setPending3dImageUrl:     (url: string | null) => void;
  setViewMode3d:            (v: boolean)         => void;
  setCustomTeacherGlbUrl:   (url: string | null) => void;

  // Quiz
  startQuiz:    (questions: MCQQuestion[]) => void;
  answerQuestion:(answer: string)          => void;
  finishQuiz:   ()                         => void;
  clearQuiz:    ()                         => void;

  // Audio
  setIsSpeaking:  (s: boolean)               => void;
  setCurrentAudio:(a: HTMLAudioElement | null)=> void;
  stopAudio:      ()                          => void;

  // Gesture
  setGesture:     (g: AvatarGesture)         => void;

  // Active segment
  setCurrentSegmentId: (id: string | null)   => void;

  // Awaiting answer
  setAwaitingAnswer: (b: boolean)            => void;

  // Active quiz (in-scene desk quiz)
  setActiveQuiz: (q: { conceptId: string; questions: QuizQuestion[] } | null) => void;
  setQuizResult: (r: { score: number; total: number } | null) => void;

  // Scene readiness (loading overlay)
  setSceneReady: (ready: boolean) => void;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const defaultSignals: BehavioralSignals = {
  time_on_explanations_seconds: 0,
  time_on_examples_seconds:     0,
  time_on_quizzes_seconds:      0,
  clicked_explain_more:         0,
  clicked_show_example:         0,
  clicked_skip_to_quiz:         0,
  questions_attempted:          0,
  questions_correct:            0,
};

const defaultCourse: CourseState = {
  courseId: null, title: "", domain: "", topics: [], currentTopicIndex: 0,
  sessionId: null, structure: null,
};

const defaultQuiz: QuizState = {
  questions: [], currentIndex: 0, answers: [], score: null, isActive: false,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAristoStore = create<AristoState>()(
  persist(
    (set, get) => ({
      userId:             null,
      profile:            null,
      masteryByConcept:   {},
      currentConceptId:   null,
      onboardingDone:     false,
      behavioralSignals:  defaultSignals,
      teacher:            "ryan",
      classroom:          "default",
      mode:               "free",
      course:             defaultCourse,
      activeLesson:       null,
      messages:           [],
      isLoading:          false,
      activeModelUrl:        null,
      activePreviewImageUrl: null,
      previewZoomUrl:        null,
      isGeneratingModel:     false,
      modelInteracting:      false,
      pending3dImageUrl:     null,
      viewMode3d:            false,
      customTeacherGlbUrl:   null,
      quiz:               defaultQuiz,
      isSpeaking:         false,
      currentAudio:       null,
      gesture:            "idle" as AvatarGesture,
      currentSegmentId:  null,
      awaitingAnswer:     false,
      activeQuiz:         null,
      quizResult:         null,
      sceneReady:         false,

      setUserId:    (id) => set({ userId: id }),

      setProfile:          (p)  => set({ profile: p }),
      setMasteryByConcept: (m)  => set({ masteryByConcept: m }),
      updateConceptMastery:(id, entry) =>
        set((s) => ({
          masteryByConcept: {
            ...s.masteryByConcept,
            [id]: { ...(s.masteryByConcept[id] ?? { mastery_score: 0, assessment_count: 0 }), ...entry },
          },
        })),
      setCurrentConceptId: (id) => set({ currentConceptId: id }),
      setOnboardingDone:   (done) => set({ onboardingDone: done }),

      incrementSignal: (key, by = 1) =>
        set((s) => ({
          behavioralSignals: { ...s.behavioralSignals, [key]: s.behavioralSignals[key] + by },
        })),
      resetSignals: () => set({ behavioralSignals: defaultSignals }),

      setTeacher:   (teacher)   => set({ teacher }),
      setClassroom: (classroom) => set({ classroom }),

      setMode:   (mode) => set({ mode }),
      setCourse: (course) => set((s) => ({ course: { ...s.course, ...course } })),
      advanceTopic: () =>
        set((s) => ({
          course: { ...s.course, currentTopicIndex: s.course.currentTopicIndex + 1 },
        })),

      setActiveLesson: (lesson) => set({ activeLesson: lesson }),

      addMessage:    (m) => set((s) => ({ messages: [...s.messages, m] })),
      setIsLoading:  (l) => set({ isLoading: l }),
      clearMessages: ()  => set({ messages: [] }),

      setActiveModelUrl:        (url) => set({ activeModelUrl: url }),
      setActivePreviewImageUrl: (url) => set({ activePreviewImageUrl: url }),
      setPreviewZoomUrl:        (url) => set({ previewZoomUrl: url }),
      setIsGeneratingModel:     (gen) => set({ isGeneratingModel: gen }),
      setModelInteracting:      (v)   => set({ modelInteracting: v }),
      setPending3dImageUrl:     (url) => set({ pending3dImageUrl: url }),
      setViewMode3d:            (v)   => set({ viewMode3d: v }),
      setCustomTeacherGlbUrl:   (url) => set({ customTeacherGlbUrl: url }),

      startQuiz: (questions) =>
        set({ quiz: { questions, currentIndex: 0, answers: [], score: null, isActive: true } }),
      answerQuestion: (answer) =>
        set((s) => ({
          quiz: { ...s.quiz, answers: [...s.quiz.answers, answer], currentIndex: s.quiz.currentIndex + 1 },
        })),
      finishQuiz: () =>
        set((s) => {
          const score = s.quiz.answers.reduce(
            (acc, a, i) => acc + (a === s.quiz.questions[i]?.correct ? 1 : 0), 0
          );
          return { quiz: { ...s.quiz, score, isActive: false } };
        }),
      clearQuiz: () => set({ quiz: defaultQuiz }),

      setIsSpeaking:   (speaking) => set({ isSpeaking: speaking }),
      setCurrentAudio: (audio)    => set({ currentAudio: audio }),
      stopAudio: () => {
        const { currentAudio } = get();
        if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; }
        set({ currentAudio: null, isSpeaking: false });
      },

      setGesture: (gesture) => set({ gesture }),

      setCurrentSegmentId: (id) => set({ currentSegmentId: id }),

      setAwaitingAnswer: (b) => set({ awaitingAnswer: b }),

      setActiveQuiz: (q) => set({ activeQuiz: q }),
      setQuizResult: (r) => set({ quizResult: r }),

      setSceneReady: (ready) => set({ sceneReady: ready }),
    }),
    {
      name: "aristo-session",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({
        userId:              s.userId,
        onboardingDone:      s.onboardingDone,
        teacher:             s.teacher,
        classroom:           s.classroom,
        mode:                s.mode,
        course:              s.course,
        currentConceptId:    s.currentConceptId,
        customTeacherGlbUrl: s.customTeacherGlbUrl,
      }),
    }
  )
);
