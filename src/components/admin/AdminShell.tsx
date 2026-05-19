"use client";

import * as React from "react";
import Link             from "next/link";
import { Home, LogOut } from "lucide-react";
import { SidebarNav }   from "./SidebarNav";
import { signOut }      from "@/app/auth/actions";
import { cn }           from "@/lib/utils";

export interface AdminShellProps {
  children: React.ReactNode;
  /** Admin profile info for the topbar. */
  admin?: {
    email:     string | null;
    full_name: string | null;
  };
}

/**
 * Full-bleed admin chrome: fixed sidebar on the left, sticky topbar, content
 * area scrolls. Used by `src/app/admin/layout.tsx`.
 */
export function AdminShell({ children, admin }: AdminShellProps) {
  return (
    <div className="min-h-screen bg-aristo-gradient text-aristo-brown">
      <div className="flex">
        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-30 w-60 flex flex-col",
            "bg-aristo-cream/80 backdrop-blur-2xl border-r border-aristo-beige-dark/40"
          )}
        >
          {/* Brand */}
          <div className="h-14 px-5 flex items-center border-b border-aristo-beige-dark/40">
            <Link href="/admin/overview" className="flex items-center gap-2 group">
              <div className="h-7 w-7 rounded-xl bg-aristo-orange grid place-items-center shadow-aristo-sm">
                <span className="text-white text-sm font-bold">A</span>
              </div>
              <span className="text-sm font-bold text-aristo-brown tracking-tight">
                Aristo <span className="text-aristo-orange">Admin</span>
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
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-aristo-brown/70 hover:bg-white/70 hover:text-aristo-brown transition-colors"
            >
              <Home className="h-3.5 w-3.5" />
              Back to /learn
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-aristo-brown/70 hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </form>
          </div>
        </aside>

        {/* ── Content ─────────────────────────────────────────────────── */}
        <div className="flex-1 ml-60 min-w-0">
          {/* Topbar */}
          <header className="sticky top-0 z-20 h-14 flex items-center justify-between gap-4 px-6 bg-white/60 backdrop-blur-xl border-b border-white/40">
            <div className="text-xs font-semibold text-aristo-brown/50 uppercase tracking-wider">
              Admin Console
            </div>
            <div className="flex items-center gap-3 text-xs">
              {admin?.email && (
                <div className="text-aristo-brown/70">
                  <span className="hidden sm:inline text-aristo-brown/40">
                    Signed in as{" "}
                  </span>
                  <span className="font-semibold">{admin.email}</span>
                </div>
              )}
              <div className="h-7 w-7 rounded-full bg-aristo-orange-pale grid place-items-center text-aristo-orange font-bold text-xs">
                {(admin?.full_name ?? admin?.email ?? "?")[0]?.toUpperCase()}
              </div>
            </div>
          </header>

          {/* Page */}
          <main className="px-6 py-6 max-w-7xl">{children}</main>
        </div>
      </div>
    </div>
  );
}
