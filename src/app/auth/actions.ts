"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { appOrigin } from "@/lib/account/appUrl";
import { writeNewAccount, type AccountWriteClient } from "@/lib/account/createAccount";
import { allowCall, clientKey } from "@/lib/account/rateLimit";
import {
  ageStepSchema,
  decideAgeStep,
  firstIssue,
  formToObject,
  guardianSignUpSchema,
  selfSignUpSchema,
  SIGNUP_BLOCK_COOKIE,
  type AgeBand,
  type Grade,
} from "@/lib/account/signup";
import { verifyTurnstile } from "@/lib/account/turnstile";

const TURNSTILE_FIELD = "cf-turnstile-response";
const SIGNUP_WINDOW_MS = 60 * 60 * 1000;
const SIGNUP_LIMIT = 10;

function fail(path: string, message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });

  if (error) {
    redirect(`/sign-in?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/learn");
}

// ── Sign-up ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Step 1, the neutral age step. Under 16 choosing "Me" sets the session flag and shows the kind screen. */
export async function startSignUp(formData: FormData) {
  const parsed = ageStepSchema.safeParse(formToObject(formData));
  if (!parsed.success) fail("/sign-up", "Please answer both questions.");

  const outcome = decideAgeStep(parsed.data.who, parsed.data.band);
  if (outcome.kind === "needs_guardian") {
    // A session cookie (no maxAge): it ends when the browser closes. Nothing about the learner is stored.
    (await cookies()).set(SIGNUP_BLOCK_COOKIE, "1", { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" });
    redirect("/sign-up");
  }
  if (outcome.kind === "guardian_form") redirect(`/sign-up?step=guardian&band=${outcome.band}`);
  redirect("/sign-up?step=self");
}

/** Shared by both paths. Returns normally only by redirecting. */
async function createAccount(args: {
  email: string;
  password: string;
  nickname: string;
  holder: "self" | "guardian";
  band: AgeBand;
  grade: Grade | null;
  turnstileToken: string | undefined;
  formPath: string;
}): Promise<never> {
  const h = await headers();
  if ((await cookies()).get(SIGNUP_BLOCK_COOKIE)) redirect("/sign-up");
  if (!allowCall("signup", clientKey(h), SIGNUP_LIMIT, SIGNUP_WINDOW_MS)) {
    fail(args.formPath, "Too many attempts. Please try again later.");
  }
  if (!(await verifyTurnstile(args.turnstileToken))) {
    fail(args.formPath, "We could not check that you are a person. Please try again.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: args.email,
    password: args.password,
    options: {
      data: { full_name: args.nickname },
      emailRedirectTo: `${appOrigin(h)}/auth/callback`,
    },
  });

  if (error) {
    // Say what the user can fix (the password) and nothing that reveals whether an address is registered.
    if (error.code === "weak_password") fail(args.formPath, "That password is too weak. Try a longer one.");
    fail(args.formPath, "We could not create the account. Please check your details and try again.");
  }

  // With "Confirm email" on, an address that is already registered comes back as a user with no identities and a
  // made-up id. Write nothing for it, and give the same answer as for a new sign-up.
  const user = data.user;
  if (!user || (user.identities && user.identities.length === 0)) {
    redirect("/sign-in?message=Check your email to confirm your account");
  }

  const service = createServiceClient();
  const failure = await writeNewAccount(service as unknown as AccountWriteClient, {
    userId: user.id,
    holder: args.holder,
    band: args.band,
    nickname: args.nickname,
    grade: args.grade,
  });
  if (failure) {
    // Do not leave a half-created account behind (it would sit at the restrictive defaults with no consents).
    await service.auth.admin.deleteUser(user.id);
    console.error("[sign-up] profile or consent write failed:", failure);
    fail(args.formPath, "We could not finish creating the account. Please try again.");
  }

  redirect("/sign-in?message=Check your email to confirm your account");
}

/** "Me, 16 or older": the person signing in is the learner. */
export async function signUpSelf(formData: FormData) {
  const form = formToObject(formData);
  const parsed = selfSignUpSchema.safeParse({ ...form, turnstileToken: form[TURNSTILE_FIELD] });
  if (!parsed.success) fail("/sign-up?step=self", firstIssue(parsed.error));
  const d = parsed.data;
  return createAccount({
    email: d.email,
    password: d.password,
    nickname: d.nickname,
    holder: "self",
    band: "16_plus",
    grade: null,
    turnstileToken: d.turnstileToken,
    formPath: "/sign-up?step=self",
  });
}

/** "My child": a parent or guardian creates and owns the account; the learner has no login. */
export async function signUpGuardian(formData: FormData) {
  const form = formToObject(formData);
  const parsed = guardianSignUpSchema.safeParse({ ...form, turnstileToken: form[TURNSTILE_FIELD] });
  const path = `/sign-up?step=guardian&band=${bandOrDefault(form.band)}`;
  if (!parsed.success) fail(path, firstIssue(parsed.error));
  const d = parsed.data;
  return createAccount({
    email: d.email,
    password: d.password,
    nickname: d.nickname,
    holder: "guardian",
    band: d.band,
    grade: d.grade,
    turnstileToken: d.turnstileToken,
    formPath: path,
  });
}

function bandOrDefault(band: string | undefined): AgeBand {
  return band === "13_15" || band === "16_plus" ? band : "under_13";
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
