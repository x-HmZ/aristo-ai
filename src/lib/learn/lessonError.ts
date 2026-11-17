/**
 * What to tell a learner when a lesson, a quiz or a lesson piece (picture, 3D model, widget, narration) fails.
 *
 * Pure: it maps an HTTP status and the JSON body the API sent (or a network failure) to plain words and the next step.
 * The API's own error text is never shown; only these messages are, so nothing technical or alarming reaches a child.
 */

export type LessonFailureKind =
  | "allowance_exhausted" // 402 allowance_exhausted: this month's free lessons are used
  | "paused_for_today" // 503 paused_for_today: spending paused for the day
  | "rate_limited" // 429
  | "signed_out" // 401
  | "not_approved" // 403 while accounts are approved by hand
  | "unavailable" // other 5xx
  | "network" // the request never completed
  | "generic";

export interface LessonFailure {
  kind: LessonFailureKind;
  title: string;
  message: string;
  /** Trying again can help, so a Retry button is offered. */
  retryable: boolean;
  /** An extra way forward besides Retry and going back. */
  action: { label: string; href: string } | null;
}

export interface FailureInput {
  /** HTTP status; omit (or 0) for a request that never completed. */
  status?: number;
  /** Parsed JSON body, if any. */
  body?: unknown;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "1 December" in UTC for an ISO timestamp; null for anything unparsable. */
export function formatResetDay(iso: unknown): string | null {
  if (typeof iso !== "string") return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

function field(body: unknown, key: string): unknown {
  return body && typeof body === "object" ? (body as Record<string, unknown>)[key] : undefined;
}

export function classifyLessonFailure({ status, body }: FailureInput): LessonFailure {
  const code = field(body, "error");

  if (status === 402) {
    const day = formatResetDay(field(body, "resetsAt"));
    const canUpgrade = field(body, "canUpgrade") !== false;
    return {
      kind: "allowance_exhausted",
      title: "You have used this month's free lessons",
      message: day
        ? `Your free lessons come back on ${day}. You can still try the demo lesson meanwhile.`
        : "Your free lessons come back next month. You can still try the demo lesson meanwhile.",
      retryable: false,
      action: canUpgrade ? { label: "See plans", href: "/pricing" } : null,
    };
  }

  if (status === 503 && code === "paused_for_today") {
    return {
      kind: "paused_for_today",
      title: "Lessons are paused for today",
      message: "Aristo has reached its limit for today. Please come back tomorrow.",
      retryable: false,
      action: null,
    };
  }

  if (status === 429) {
    return {
      kind: "rate_limited",
      title: "Too many requests",
      message: "That was a lot at once. Wait a minute, then try again.",
      retryable: true,
      action: null,
    };
  }

  if (status === 401) {
    return {
      kind: "signed_out",
      title: "You have been signed out",
      message: "Sign in again to carry on with your lesson.",
      retryable: false,
      action: { label: "Sign in", href: "/sign-in" },
    };
  }

  if (status === 403) {
    return {
      kind: "not_approved",
      title: "Your account is not ready yet",
      message: "Lessons start once your account has been approved.",
      retryable: false,
      action: { label: "Check my account", href: "/pending" },
    };
  }

  if (!status) {
    return {
      kind: "network",
      title: "Could not reach Aristo",
      message: "Check your internet connection, then try again.",
      retryable: true,
      action: null,
    };
  }

  if (status >= 500) {
    return {
      kind: "unavailable",
      title: "Aristo is having trouble",
      message: "Something went wrong on our side while preparing your lesson. Try again in a moment.",
      retryable: true,
      action: null,
    };
  }

  return {
    kind: "generic",
    title: "The lesson could not be prepared",
    message: "Something went wrong. Try again, or go back and pick another topic.",
    retryable: true,
    action: null,
  };
}

/** The lesson pieces that can fail without stopping the lesson. */
export type NoticeKind = "quiz" | "picture" | "model" | "widget" | "narration";

/** One short, non-blocking sentence per piece; the lesson carries on without it. */
export const NOTICE_MESSAGES: Record<NoticeKind, string> = {
  quiz: "The quiz could not be loaded. Press the button to try again.",
  picture: "The picture for this lesson could not be drawn. The lesson goes on without it.",
  model: "The 3D model could not be built. The lesson goes on without it.",
  widget: "The interactive activity could not start. The lesson goes on without it.",
  narration: "The teacher's voice is not working right now. You can read the captions instead.",
};

/** A quiz failure that is really an allowance or rate problem says so instead of the generic line. */
export function quizNotice(input: FailureInput): string {
  const f = classifyLessonFailure(input);
  if (f.kind === "allowance_exhausted" || f.kind === "paused_for_today" || f.kind === "rate_limited") return f.message;
  return NOTICE_MESSAGES.quiz;
}
