import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const isAuthRoute =
    pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");

  const isLearnRoute = pathname.startsWith("/learn");
  const isAdminRoute = pathname.startsWith("/admin");
  const isPendingRoute = pathname.startsWith("/pending");
  const isProtectedRoute = isLearnRoute || isAdminRoute || isPendingRoute;

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }

  // Approval gate: any authenticated learner hitting /learn must be approved.
  // Admins are exempt (admin implies approved). /pending is always reachable
  // so users can see their status. We read the profile via the anon client
  // (RLS lets a user read their own row); the service-role client doesn't
  // work in the Edge Runtime, which is why this is NOT a service-role lookup.
  if (user && (isLearnRoute || isAdminRoute)) {
    const lookup = await supabase
      .from("profiles")
      .select("is_admin, approval_status")
      .eq("id", user.id)
      .single();
    const profile = lookup.data;

    // TEMP DEBUG: surface middleware decision in response headers so we can
    // verify the gate logic from a single curl. Remove once verified.
    supabaseResponse.headers.set(
      "x-mw-debug",
      JSON.stringify({
        user: user.id,
        is_admin: profile?.is_admin ?? null,
        approval: profile?.approval_status ?? null,
        lookupErr: lookup.error?.message ?? null,
        route: isLearnRoute ? "learn" : "admin",
      })
    );

    if (isAdminRoute && !profile?.is_admin) {
      const url = request.nextUrl.clone();
      url.pathname = "/learn";
      const res = NextResponse.redirect(url);
      res.headers.set("x-mw-decision", "redirect-admin->learn");
      return res;
    }

    if (
      isLearnRoute &&
      !profile?.is_admin &&
      profile?.approval_status !== "approved"
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/pending";
      const res = NextResponse.redirect(url);
      res.headers.set("x-mw-decision", "redirect-learn->pending");
      return res;
    }

    supabaseResponse.headers.set("x-mw-decision", "allow-through");
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/learn";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
