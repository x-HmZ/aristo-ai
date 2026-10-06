"use client";

import * as React from "react";
import Link             from "next/link";
import { usePathname }  from "next/navigation";
import { Home, LogOut, Menu } from "lucide-react";
import { AristoMark }   from "@/components/brand/AristoMark";
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
      <div className="h-14 px-5 flex items-center border-b border-line">
        <Link
          href="/admin/overview"
          aria-label="Aristo Admin, dashboard"
          className="flex min-h-11 items-center gap-2.5 rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-text focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          <AristoMark className="h-4 text-ink" litClassName="text-accent" />
          <span className="text-sm font-semibold text-muted">Admin</span>
        </Link>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto">
        <SidebarNav />
      </div>

      {/* Footer */}
      <div className="border-t border-line p-3 space-y-1">
        <Link
          href="/learn"
          className="flex min-h-11 items-center gap-2 rounded-[10px] px-3 py-2 text-sm font-medium text-body hover:bg-sunk hover:text-ink transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-text"
        >
          <Home aria-hidden className="h-4 w-4" />
          Back to /learn
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            className="w-full flex min-h-11 items-center gap-2 rounded-[10px] px-3 py-2 text-sm font-medium text-body hover:bg-danger/10 hover:text-danger transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-text"
          >
            <LogOut aria-hidden className="h-4 w-4" />
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

  // Past md the drawer's trigger is hidden and the sidebar is back: close it.
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => { if (mq.matches) setNavOpen(false); };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <div className="min-h-screen bg-bg text-ink">
      {/* ── Sidebar (md+) ─────────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden w-60 flex-col md:flex",
          "bg-surface border-r border-line"
        )}
      >
        <SidebarBody />
      </aside>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="min-w-0 md:ml-60">
        {/* Topbar */}
        <header className="sticky top-0 z-20 h-14 flex items-center justify-between gap-3 px-3 sm:px-6 bg-surface/95 backdrop-blur-md border-b border-line">
          <div className="flex min-w-0 items-center gap-1">
            <Sheet open={navOpen} onOpenChange={setNavOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Open navigation"
                  className="grid size-11 shrink-0 place-items-center rounded-[10px] text-body hover:bg-sunk hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-text md:hidden"
                >
                  <Menu aria-hidden className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="flex w-72 max-w-[85vw] flex-col gap-0 p-0"
                aria-describedby={undefined}
                // A link to the page already open does not change the route: close on any link.
                onClickCapture={(e) => { if ((e.target as HTMLElement).closest("a")) setNavOpen(false); }}
              >
                <SheetTitle className="sr-only">Admin navigation</SheetTitle>
                <SidebarBody />
              </SheetContent>
            </Sheet>
            <div className="hidden text-xs font-semibold text-muted sm:block">
              Admin Console
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-3 text-xs">
            {admin?.email && (
              <div className="min-w-0 truncate text-body">
                <span className="hidden sm:inline text-muted">
                  Signed in as{" "}
                </span>
                <span className="font-semibold">{admin.email}</span>
              </div>
            )}
            <div aria-hidden className="h-7 w-7 shrink-0 rounded-full border border-tint-line bg-tint grid place-items-center text-accent-text font-bold text-xs">
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
