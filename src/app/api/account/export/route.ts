// GET /api/account/export
// The signed-in user's own data as a JSON download. Own id only (taken from the session, never from the request).

import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { buildExport, supabaseExportStore } from "@/lib/account/leaving";
import { allowCall } from "@/lib/account/rateLimit";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!allowCall("account-export", user.id, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  try {
    const data = await buildExport(supabaseExportStore(createServiceClient()), user.id);
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="aristo-my-data.json"',
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "We could not prepare your data. Please try again." }, { status: 500 });
  }
}
