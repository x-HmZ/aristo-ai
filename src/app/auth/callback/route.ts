import { createClient } from "@/lib/supabase/server";
import { notifyAdminOfNewSignup } from "@/lib/email/resend";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/learn";

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=auth_callback_failed`);
  }

  const supabase = await createClient();
  const { error, data } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/sign-in?error=auth_callback_failed`);
  }

  // Fire-and-forget admin notification. Idempotent via admin_notified_at,
  // so repeat callbacks (re-confirmations, magic-link sign-ins) don't spam.
  await notifyAdminOfNewSignup(data.user.id, data.user.email ?? "(unknown)");

  return NextResponse.redirect(`${origin}${next}`);
}
