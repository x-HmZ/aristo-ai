/**
 * Sign-up rules: the neutral age step and the Zod schemas for the two sign-up paths.
 *
 * The age step asks "Who will be learning?" and an age band, with the same options on both answers, so no choice
 * hints at the one that gets through. Under 16 choosing "Me" ends in a kind screen and a session flag (the cookie
 * named in SIGNUP_BLOCK_COOKIE); nothing about that learner is stored.
 *
 * Everything that reaches the sign-up server actions is parsed here: a hidden field is as untrusted as a visible one.
 */

import { z } from "zod";

export const AGE_BANDS = ["under_13", "13_15", "16_plus"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export const AGE_BAND_LABELS: Record<AgeBand, string> = {
  under_13: "Under 13",
  "13_15": "13 to 15",
  "16_plus": "16 or older",
};

export const WHO_VALUES = ["me", "child"] as const;
export type Who = (typeof WHO_VALUES)[number];

export const GRADES = ["6", "7", "8", "other"] as const;
export type Grade = (typeof GRADES)[number];

export const GRADE_LABELS: Record<Grade, string> = {
  "6": "Grade 6",
  "7": "Grade 7",
  "8": "Grade 8",
  other: "Another grade",
};

/** Name of the session cookie that remembers an under-16 "Me" answer in this browser session. */
export const SIGNUP_BLOCK_COOKIE = "aristo_signup_block";

export type AgeStepOutcome =
  /** Show the sign-up form for a person 16 or older learning for themselves. */
  | { kind: "self_form" }
  /** Show the guardian form: a parent or guardian creates the account for the learner. */
  | { kind: "guardian_form"; band: AgeBand }
  /** Under 16 chose "Me": the kind screen, and the session flag is set. */
  | { kind: "needs_guardian" };

/** Pure: what the neutral age step leads to. */
export function decideAgeStep(who: Who, band: AgeBand): AgeStepOutcome {
  if (who === "child") return { kind: "guardian_form", band };
  return band === "16_plus" ? { kind: "self_form" } : { kind: "needs_guardian" };
}

export const ageStepSchema = z.object({
  who: z.enum(WHO_VALUES),
  band: z.enum(AGE_BANDS),
});

// ── Field schemas ───────────────────────────────────────────────────────────────────────────────────────────

/** An HTML checkbox posts "on" when ticked and nothing when not. */
const ticked = z.literal("on", { error: "This box must be ticked to continue." });

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "That email address is too long.")
  .pipe(z.email("Enter a valid email address."));

// Supabase Auth caps passwords at 72 bytes; refusing longer input avoids a silent truncation.
const password = z
  .string()
  .min(8, "The password needs at least 8 characters.")
  .max(72, "The password can have at most 72 characters.");

/** A nickname, never a full name: short, no email-like or markup characters. */
export const nickname = z
  .string()
  .trim()
  .min(1, "Enter a nickname.")
  .max(40, "A nickname can have at most 40 characters.")
  .regex(/^[^<>@\u0000-\u001f]+$/u, "Use letters, numbers and spaces only: no email address or symbols.");

const turnstileToken = z.string().max(2048).optional();

export const selfSignUpSchema = z.object({
  band: z.literal("16_plus"),
  email,
  password,
  nickname,
  accept: ticked,
  turnstileToken,
});
export type SelfSignUp = z.infer<typeof selfSignUpSchema>;

export const guardianSignUpSchema = z.object({
  band: z.enum(AGE_BANDS),
  email,
  password,
  nickname,
  grade: z.enum(GRADES, { error: "Choose the learner's grade." }),
  guardianDeclaration: ticked,
  accept: ticked,
  turnstileToken,
});
export type GuardianSignUp = z.infer<typeof guardianSignUpSchema>;

/** First error message of a failed parse, for showing on the form. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check the form and try again.";
}

/** FormData to a plain object, string fields only (a File or a repeated field is dropped). */
export function formToObject(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string" && !(key in out)) out[key] = value;
  }
  return out;
}
