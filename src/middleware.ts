import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
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
  // so users can see their status. We use the service client here to bypass
  // RLS — the user is already authenticated against the anon-key session.
  if (user && (isLearnRoute || isAdminRoute)) {
    const service = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: profile } = await service
      .from("profiles")
      .select("is_admin, approval_status")
      .eq("id", user.id)
      .single();

    if (isAdminRoute && !profile?.is_admin) {
      const url = request.nextUrl.clone();
      url.pathname = "/learn";
      return NextResponse.redirect(url);
    }

    if (
      isLearnRoute &&
      !profile?.is_admin &&
      profile?.approval_status !== "approved"
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/pending";
      return NextResponse.redirect(url);
    }
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
