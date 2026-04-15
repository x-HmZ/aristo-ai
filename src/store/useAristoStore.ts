import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Learning style profiles — based on Felder-Silverman Learning Styles Model.
 * Two axes:  Active/Reflective  ×  Global/Sequential  →  4 profiles.
 *
 *   Explorer    = Active  + Global     (curious, big-picture, discovery-driven)
 *   Builder     = Active  + Sequential (hands-on, step-by-step, concrete)
 *   Synthesizer = Reflective + Global  (thoughtful, analogy-driven, connector)
 *   Analyst     = Reflective + Sequential (precise, mechanism-oriented, deep)
 */
export type LearningStyle = "explorer" | "builder" | "synthesizer" | "analyst";
export type TeacherMode = "course" | "free";
export type TeacherAvatar = "ryan" | "sonia";
export type Classroom = "default" | "alternative";
export type TeachingFlow = "interactive" | "structured";

// ─── Message types (discriminated union) ─────────────────────────────────────

/**
 * Structured mode: one card per topic with definition/explanation/example/fun_fact.
 * Used when teachingFlow === "structured".
 */
export interface StructuredMessage {
  id: string;
  type: "structured";
  question: string;
  definition: string;
  explanation: string;
  example: string;
  fun_fact?: string;
  imageUrl?: string;
  modelUrl?: string;
  modelPrompt?: string;
  annotationHints?: string[];
  timestamp: number;
}

/**
 * Chat mode: individual turn in a back-and-forth conversation.
 * Used when teachingFlow === "interactive".
 */
export interface ChatMessage {
  id: string;
  type: "chat";
  role: "user" | "assistant";
  content: string;
  /** True when this is the last message in a completed lesson (for separator UI) */
  isLessonEnd?: boolean;
  timestamp: number;
}

export type Message = StructuredMessage | ChatMessage;

// ─── Quiz ────────────────────────────────────────────────────────────────────

export interface MCQQuestion {
  question: string;
  options: string[];
  correct: string;
}

export interface QuizState {
  questions: MCQQuestion[];
  currentIndex: number;
  answers: string[];
  score: number | null;
  isActive: boolean;
}

// ─── Course ──────────────────────────────────────────────────────────────────

export interface CourseState {
  courseId: string | null;
  title: string;
  topics: string[];
  currentTopicIndex: number;
  sessionId: string | null;
}

// ─── Store interface ──────────────────────────────────────────────────────────

interface AristoState {
  // User & personalization
  userId: string | null;
  learningStyle: LearningStyle;
  teachingFlow: TeachingFlow;
  styleAssessmentDone: boolean;

  // Teacher settings
  teacher: TeacherAvatar;
  classroom: Classroom;

  // Session mode
  mode: TeacherMode;
  course: CourseState;

  // Messages (conversation history)
  messages: Message[];
  isLoading: boolean;

  // Current 3D model in scene
  activeModelUrl: string | null;
  isGeneratingModel: boolean;

  // Quiz
  quiz: QuizState;

  // Audio
  isSpeaking: boolean;
  currentAudio: HTMLAudioElement | null;

  // Actions — user & personalization
  setUserId: (id: string | null) => void;
  setLearningStyle: (style: LearningStyle) => void;
  setTeachingFlow: (flow: TeachingFlow) => void;
  setStyleAssessmentDone: (done: boolean) => void;

  // Actions — teacher settings
  setTeacher: (teacher: TeacherAvatar) => void;
  setClassroom: (classroom: Classroom) => void;

  // Actions — mode
  setMode: (mode: TeacherMode) => void;
  setCourse: (course: Partial<CourseState>) => void;
  advanceTopic: () => void;

  // Actions — messages
  addMessage: (message: Message) => void;
  updateLastMessage: (updater: (msg: Message) => Message) => void;
  setIsLoading: (loading: boolean) => void;
  clearMessages: () => void;

  // Actions — 3D model
  setActiveModelUrl: (url: string | null) => void;
  setIsGeneratingModel: (generating: boolean) => void;

  // Actions — quiz
  startQuiz: (questions: MCQQuestion[]) => void;
  answerQuestion: (answer: string) => void;
  finishQuiz: () => void;
  clearQuiz: () => void;

  // Actions — audio
  setIsSpeaking: (speaking: boolean) => void;
  setCurrentAudio: (audio: HTMLAudioElement | null) => void;
  stopAudio: () => void;
}

// ─── Default values ──────────────────────────────────────────────────────────

const defaultCourse: CourseState = {
  courseId: null,
  title: "",
  topics: [],
  currentTopicIndex: 0,
  sessionId: null,
};

const defaultQuiz: QuizState = {
  questions: [],
  currentIndex: 0,
  answers: [],
  score: null,
  isActive: false,
};

// ─── Store definition ─────────────────────────────────────────────────────────

export const useAristoStore = create<AristoState>()(
  persist(
    (set, get) => ({
      // Initial state
      userId: null,
      learningStyle: "explorer",
      teachingFlow: "structured",
      styleAssessmentDone: false,
      teacher: "ryan",
      classroom: "default",
      mode: "free",
      course: defaultCourse,
      messages: [],
      isLoading: false,
      activeModelUrl: null,
      isGeneratingModel: false,
      quiz: defaultQuiz,
      isSpeaking: false,
      currentAudio: null,

      // User & personalization
      setUserId: (id) => set({ userId: id }),
      setLearningStyle: (style) => set({ learningStyle: style }),
      setTeachingFlow: (flow) => set({ teachingFlow: flow }),
      setStyleAssessmentDone: (done) => set({ styleAssessmentDone: done }),

      // Teacher settings
      setTeacher: (teacher) => set({ teacher }),
      setClassroom: (classroom) => set({ classroom }),

      // Mode
      setMode: (mode) => set({ mode }),
      setCourse: (course) =>
        set((state) => ({ course: { ...state.course, ...course } })),
      advanceTopic: () =>
        set((state) => ({
          course: {
            ...state.course,
            currentTopicIndex: state.course.currentTopicIndex + 1,
          },
        })),

      // Messages
      addMessage: (message) =>
        set((state) => ({ messages: [...state.messages, message] })),
      updateLastMessage: (updater) =>
        set((state) => {
          if (state.messages.length === 0) return state;
          const msgs = [...state.messages];
          msgs[msgs.length - 1] = updater(msgs[msgs.length - 1]);
          return { messages: msgs };
        }),
      setIsLoading: (loading) => set({ isLoading: loading }),
      clearMessages: () => set({ messages: [] }),

      // 3D model
      setActiveModelUrl: (url) => set({ activeModelUrl: url }),
      setIsGeneratingModel: (generating) =>
        set({ isGeneratingModel: generating }),

      // Quiz
      startQuiz: (questions) =>
        set({
          quiz: {
            questions,
            currentIndex: 0,
            answers: [],
            score: null,
            isActive: true,
          },
        }),
      answerQuestion: (answer) =>
        set((state) => {
          const answers = [...state.quiz.answers, answer];
          const currentIndex = state.quiz.currentIndex + 1;
          return { quiz: { ...state.quiz, answers, currentIndex } };
        }),
      finishQuiz: () =>
        set((state) => {
          const { questions, answers } = state.quiz;
          const score = answers.reduce(
            (acc, answer, i) =>
              acc + (answer === questions[i]?.correct ? 1 : 0),
            0
          );
          return { quiz: { ...state.quiz, score, isActive: false } };
        }),
      clearQuiz: () => set({ quiz: defaultQuiz }),

      // Audio
      setIsSpeaking: (speaking) => set({ isSpeaking: speaking }),
      setCurrentAudio: (audio) => set({ currentAudio: audio }),
      stopAudio: () => {
        const { currentAudio } = get();
        if (currentAudio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
        }
        set({ currentAudio: null, isSpeaking: false });
      },
    }),
    {
      name: "aristo-session",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        userId: state.userId,
        learningStyle: state.learningStyle,
        teachingFlow: state.teachingFlow,
        styleAssessmentDone: state.styleAssessmentDone,
        teacher: state.teacher,
        classroom: state.classroom,
        mode: state.mode,
        course: state.course,
      }),
    }
  )
);
