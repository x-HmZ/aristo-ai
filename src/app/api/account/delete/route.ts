// POST /api/account/delete   body: { "confirm": "DELETE" }
// Deletes the signed-in user's own account and data. Own id only (from the session). Then signs the user out.

import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { deleteAccount, deleteRequestSchema, supabaseDeletionStore } from "@/lib/account/leaving";
import { allowCall } from "@/lib/account/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!allowCall("account-delete", user.id, 3, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const parsed = deleteRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Type DELETE to confirm.' }, { status: 400 });

  const result = await deleteAccount(supabaseDeletionStore(createServiceClient()), user.id);
  if (!result.ok) {
    const status = result.code === "failed" ? 500 : 409;
    return NextResponse.json({ error: result.message, code: result.code }, { status });
  }

  // The auth user is gone; clear the session cookies. A failure here is harmless (the token no longer resolves).
  await supabase.auth.signOut().catch(() => undefined);
  return NextResponse.json({ ok: true });
}
