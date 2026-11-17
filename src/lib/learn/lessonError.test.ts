import { describe, expect, it } from "vitest";
import { classifyLessonFailure, formatResetDay, NOTICE_MESSAGES, quizNotice } from "./lessonError";

describe("classifyLessonFailure", () => {
  it("402 allowance_exhausted points to the plans and names the reset day", () => {
    const f = classifyLessonFailure({
      status: 402,
      body: { error: "allowance_exhausted", resetsAt: "2026-12-01T00:00:00.000Z", canUpgrade: true },
    });
    expect(f.kind).toBe("allowance_exhausted");
    expect(f.retryable).toBe(false);
    expect(f.action).toEqual({ label: "See plans", href: "/pricing" });
    expect(f.message).toContain("1 December");
  });

  it("402 without an upgrade path offers no plans link", () => {
    const f = classifyLessonFailure({ status: 402, body: { error: "allowance_exhausted", canUpgrade: false } });
    expect(f.action).toBeNull();
  });

  it("503 paused_for_today is not retryable; other 503 is", () => {
    expect(classifyLessonFailure({ status: 503, body: { error: "paused_for_today" } })).toMatchObject({
      kind: "paused_for_today",
      retryable: false,
    });
    expect(classifyLessonFailure({ status: 503, body: { error: "Service temporarily unavailable" } })).toMatchObject({
      kind: "unavailable",
      retryable: true,
    });
  });

  it("429 can be retried", () => {
    expect(classifyLessonFailure({ status: 429 })).toMatchObject({ kind: "rate_limited", retryable: true });
  });

  it("a request that never completed is a network failure", () => {
    expect(classifyLessonFailure({ status: 0 })).toMatchObject({ kind: "network", retryable: true });
  });

  it("401 and 403 send the learner somewhere useful", () => {
    expect(classifyLessonFailure({ status: 401 }).action?.href).toBe("/sign-in");
    expect(classifyLessonFailure({ status: 403 }).action?.href).toBe("/pending");
  });

  it("anything else is a generic, retryable failure and never shows the API text", () => {
    const f = classifyLessonFailure({ status: 400, body: { error: "secret internal detail" } });
    expect(f.kind).toBe("generic");
    expect(JSON.stringify(f)).not.toContain("secret");
  });
});

describe("notices", () => {
  it("formats the reset day and rejects junk", () => {
    expect(formatResetDay("2026-01-05T10:00:00Z")).toBe("5 January");
    expect(formatResetDay("x")).toBeNull();
    expect(formatResetDay(undefined)).toBeNull();
  });

  it("a quiz failure caused by the allowance says so, otherwise uses the generic quiz line", () => {
    expect(quizNotice({ status: 402, body: { error: "allowance_exhausted" } })).toContain("free lessons");
    expect(quizNotice({ status: 500 })).toBe(NOTICE_MESSAGES.quiz);
  });
});
