"use client";

import * as React from "react";
import Link             from "next/link";
import { usePathname }  from "next/navigation";
import { Home, LogOut, Menu } from "lucide-react";
import { SidebarNav }   from "./SidebarNav";
import { signOut }      from "@/app/auth/actions";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn }           from "@/lib/utils";

export interface AdminShellProps {
  children: React.ReactNode;
  /** Admin profile info for the topbar. */
  admin?: {
    email:     string | null;
    full_name: string | null;
  };
}

/** Brand, nav and footer links: the fixed sidebar at md+, the drawer below. */
function SidebarBody() {
  return (
    <>
      {/* Brand */}
      <div className="h-14 px-5 flex items-center border-b border-aristo-beige-dark/40">
        <Link href="/admin/overview" className="flex items-center gap-2 group">
          <div className="h-7 w-7 rounded-xl bg-aristo-orange-main grid place-items-center shadow-aristo-sm">
            <span className="text-white text-sm font-bold">A</span>
          </div>
          <span className="text-sm font-bold text-aristo-brown-main tracking-tight">
            Aristo <span className="text-aristo-orange-main">Admin</span>
          </span>
        </Link>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto">
        <SidebarNav />
      </div>

      {/* Footer */}
      <div className="border-t border-aristo-beige-dark/40 p-3 space-y-1">
        <Link
          href="/learn"
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-aristo-brown-main/70 hover:bg-white/70 hover:text-aristo-brown-main transition-colors"
        >
          <Home className="h-3.5 w-3.5" />
          Back to /learn
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-aristo-brown-main/70 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </form>
      </div>
    </>
  );
}

/**
 * Full-bleed admin chrome: fixed sidebar on the left from md, sticky topbar,
 * content area scrolls. Below md (V8.6) the sidebar is a drawer behind a menu
 * button in the topbar, and navigating closes it. Used by
 * `src/app/admin/layout.tsx`.
 */
export function AdminShell({ children, admin }: AdminShellProps) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = React.useState(false);

  // A link in the drawer changes the route: close the drawer behind it.
  React.useEffect(() => { setNavOpen(false); }, [pathname]);

  return (
    <div className="min-h-screen bg-aristo-gradient text-aristo-brown-main">
      {/* ── Sidebar (md+) ─────────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden w-60 flex-col md:flex",
          "bg-aristo-cream/80 backdrop-blur-2xl border-r border-aristo-beige-dark/40"
        )}
      >
        <SidebarBody />
      </aside>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="min-w-0 md:ml-60">
        {/* Topbar */}
        <header className="sticky top-0 z-20 h-14 flex items-center justify-between gap-3 px-3 sm:px-6 bg-white/60 backdrop-blur-xl border-b border-white/40">
          <div className="flex min-w-0 items-center gap-1">
            <Sheet open={navOpen} onOpenChange={setNavOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Open navigation"
                  className="grid size-11 shrink-0 place-items-center rounded-xl text-aristo-brown-main/70 hover:bg-white/70 hover:text-aristo-brown-main md:hidden"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="flex w-72 max-w-[85vw] flex-col gap-0 p-0 bg-aristo-cream border-aristo-beige-dark/40"
              >
                <SheetTitle className="sr-only">Admin navigation</SheetTitle>
                <SidebarBody />
              </SheetContent>
            </Sheet>
            <div className="hidden text-xs font-semibold text-aristo-brown-main/50 uppercase tracking-wider sm:block">
              Admin Console
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-3 text-xs">
            {admin?.email && (
              <div className="min-w-0 truncate text-aristo-brown-main/70">
                <span className="hidden sm:inline text-aristo-brown-main/40">
                  Signed in as{" "}
                </span>
                <span className="font-semibold">{admin.email}</span>
              </div>
            )}
            <div className="h-7 w-7 shrink-0 rounded-full bg-aristo-orange-pale grid place-items-center text-aristo-orange-main font-bold text-xs">
              {(admin?.full_name ?? admin?.email ?? "?")[0]?.toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page */}
        <main className="px-4 py-6 sm:px-6 max-w-7xl">{children}</main>
      </div>
    </div>
  );
}
