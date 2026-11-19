import { create } from "zustand";
import { NOTICE_MESSAGES, type LessonFailure, type NoticeKind } from "@/lib/learn/lessonError";

/**
 * Status UI state for the lesson: the failure that stopped a lesson from loading, and short non-blocking notices for
 * lesson pieces (quiz, picture, 3D model, widget, narration) that failed while the lesson carries on.
 *
 * A separate tiny store, not part of useAristoStore, so it is neither persisted nor reset with the session.
 */
export interface LessonNotice {
  id: number;
  kind: NoticeKind;
  message: string;
}

interface LessonStatusState {
  failure: LessonFailure | null;
  /** Bumped by Retry; the auto-teach hook refetches when it changes. */
  retryNonce: number;
  notices: LessonNotice[];
  setFailure: (f: LessonFailure | null) => void;
  retry: () => void;
  /** Shows a notice; one per kind at a time, so a repeating failure does not stack up. */
  pushNotice: (kind: NoticeKind, message?: string) => void;
  dismissNotice: (id: number) => void;
  clearNotices: () => void;
}

let nextId = 1;

export const useLessonStatus = create<LessonStatusState>((set) => ({
  failure: null,
  retryNonce: 0,
  notices: [],
  setFailure: (failure) => set({ failure }),
  retry: () => set((s) => ({ retryNonce: s.retryNonce + 1, failure: null })),
  pushNotice: (kind, message) =>
    set((s) => ({
      notices: [
        ...s.notices.filter((n) => n.kind !== kind),
        { id: nextId++, kind, message: message ?? NOTICE_MESSAGES[kind] },
      ],
    })),
  dismissNotice: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),
  clearNotices: () => set({ notices: [] }),
}));

/** For non-React callers (a catch block inside another hook). */
export function pushLessonNotice(kind: NoticeKind, message?: string): void {
  useLessonStatus.getState().pushNotice(kind, message);
}
