"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { allowCall } from "@/lib/account/rateLimit";
import { firstIssue, formToObject } from "@/lib/account/signup";

function back(kind: "error" | "message", text: string): never {
  redirect(`/account?${kind}=${encodeURIComponent(text)}#account-status`);
}

const switchesSchema = z.object({
  voice: z.literal("on").optional(),
  chat: z.literal("on").optional(),
  teacher: z.literal("on").optional(),
});

/** Parent controls: the guardian of a guardian-held account sets the three child-safety switches. */
export async function saveParentControls(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const parsed = switchesSchema.safeParse(formToObject(formData));
  if (!parsed.success) back("error", "Please try again.");

  // The switches are ordinary profile columns the owner may update; account_holder is not (migration 025), so it
  // is only read here, and only a guardian-held account may use this form.
  const { data: profile } = await supabase.from("profiles").select("account_holder").eq("id", user.id).maybeSingle();
  if (profile?.account_holder !== "guardian") back("error", "These controls are for parent accounts.");

  const { error } = await supabase
    .from("profiles")
    .update({
      allow_voice_input: parsed.data.voice === "on",
      allow_free_chat: parsed.data.chat === "on",
      allow_custom_teacher: parsed.data.teacher === "on",
    })
    .eq("id", user.id);
  if (error) back("error", "We could not save the settings. Please try again.");
  back("message", "Settings saved.");
}

const passwordSchema = z
  .object({
    password: z.string().min(8, "The password needs at least 8 characters.").max(72, "The password can have at most 72 characters."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "The two passwords do not match.", path: ["confirm"] });

/** Change password for a signed-in user (the session proves who they are). */
export async function changePassword(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  if (!allowCall("change-password", user.id, 5, 60 * 60 * 1000)) back("error", "Too many attempts. Please try again later.");

  const parsed = passwordSchema.safeParse(formToObject(formData));
  if (!parsed.success) back("error", firstIssue(parsed.error));

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) back("error", "We could not change the password. Please try again, or use Forgot password on the sign-in page.");
  back("message", "Password changed.");
}
