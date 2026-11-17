/**
 * Input limits shared by the paid routes: Zod schemas with a maximum on every string and array, unknown keys
 * rejected, and one helper that turns a failure into a 400 (413 when the body is simply too big).
 */

import { NextResponse } from "next/server";
import { z } from "zod";

/** Largest JSON body any of these routes reads. Phase content is at most a few thousand characters. */
export const MAX_BODY_BYTES = 64 * 1024;

/**
 * A concept id or, for a free-form topic (the app sends the course topic name as the id; see
 * useCourseAutoTeach), a short title: letters, digits, spaces and a few punctuation marks, starting with a
 * letter or digit, at most 100 characters (concepts.id is VARCHAR(100)). No control characters, double quotes,
 * angle brackets, braces, backticks, backslashes, percent signs or newlines, so it cannot carry markup or a
 * prompt-structure break.
 */
export const conceptIdSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[\p{L}\p{N}][\p{L}\p{N} _.,:;'’()&+\-?!/]*$/u);

/** A required, trimmed, non-empty string with a length cap. */
export const text = (max: number) => z.string().trim().min(1).max(max);

/** The behavioural profile the client may echo back; strict, short enums-as-strings. */
export const profileSchema = z
  .object({
    expertise_level:       z.enum(["beginner", "intermediate", "advanced"]),
    pace:                  z.enum(["fast", "moderate", "careful"]),
    explanation_depth:     z.enum(["concise", "moderate", "detailed"]),
    example_preference:    z.enum(["abstract", "concrete", "mixed"]),
    weakest_bloom_level:   z.string().max(40).optional(),
    strongest_bloom_level: z.string().max(40).optional(),
  })
  .strict();

export type ParsedBody<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

/** Read and validate a JSON body. 413 when over MAX_BODY_BYTES, 400 for bad JSON or a schema failure. */
export async function parseJsonBody<S extends z.ZodTypeAny>(req: Request, schema: S, maxBytes = MAX_BODY_BYTES): Promise<ParsedBody<z.infer<S>>> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, response: NextResponse.json({ error: "Request too large" }, { status: 413 }) };
  }
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Invalid body" }, { status: 400 }) };
  }
  if (raw.length > maxBytes) {
    return { ok: false, response: NextResponse.json({ error: "Request too large" }, { status: 413 }) };
  }
  let json: unknown;
  try {
    json = raw === "" ? {} : JSON.parse(raw);
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, response: NextResponse.json({ error: "Invalid request" }, { status: 400 }) };
  }
  return { ok: true, data: parsed.data };
}

/** Validate a value that is not a JSON body (a route param). */
export function parseValue<S extends z.ZodTypeAny>(schema: S, value: unknown): ParsedBody<z.infer<S>> {
  const parsed = schema.safeParse(value);
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, response: NextResponse.json({ error: "Invalid request" }, { status: 400 }) };
}
