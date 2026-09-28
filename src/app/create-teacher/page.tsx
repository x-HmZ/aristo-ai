import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CreateTeacherClient } from "./CreateTeacherClient";
import { THEME_LOCK_META } from "@/components/theme/theme";

// Not on the design system yet (V8.6): the lock keeps it light. See theme.ts.
export const metadata = {
  title: "Create Your Teacher · Aristo",
  other: { [THEME_LOCK_META]: "light" },
};

export default async function CreateTeacherPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Pre-load current custom URL (if any) so the client can show "update" state
  const { data: profile } = await supabase
    .from("learner_profiles")
    .select("custom_teacher_glb_url")
    .eq("user_id", user.id)
    .single();

  return (
    <CreateTeacherClient
      userId={user.id}
      existingUrl={profile?.custom_teacher_glb_url ?? null}
    />
  );
}
