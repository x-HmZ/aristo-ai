import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CreateTeacherClient } from "./CreateTeacherClient";

export const metadata = { title: "Create Your Teacher · Aristo" };

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
