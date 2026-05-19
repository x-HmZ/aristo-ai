"use client";

import * as React from "react";
import Link               from "next/link";
import { usePathname }    from "next/navigation";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Network,
  Database,
  Brain,
  BarChart3,
  Wallet,
  Shield,
  ScrollText,
  Server,
  PlayCircle,
  FileQuestion,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label:    string;
  href:     string;
  icon:     LucideIcon;
  comingSoon?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

/**
 * Nav config. As phases ship, flip `comingSoon: false` to enable the link.
 * Keep the visual layout stable so admins can see what's coming.
 */
const SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard",       href: "/admin/overview",        icon: LayoutDashboard },
      { label: "Users",           href: "/admin/users",           icon: Users           },
      { label: "Courses",         href: "/admin/courses",         icon: BookOpen        },
    ],
  },
  {
    title: "Content",
    items: [
      { label: "Knowledge Graph", href: "/admin/knowledge-graph", icon: Network },
      { label: "RAG",             href: "/admin/rag",             icon: Database },
    ],
  },
  {
    title: "Insight",
    items: [
      { label: "Misconceptions",  href: "/admin/misconceptions",  icon: Brain },
      { label: "Quiz analytics",  href: "/admin/quiz-analytics",  icon: BarChart3 },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Cost",            href: "/admin/cost",            icon: Wallet },
      { label: "Moderation",      href: "/admin/moderation",      icon: Shield },
      { label: "Lesson cache",    href: "/admin/lesson-cache",    icon: PlayCircle },
      { label: "Audit log",       href: "/admin/audit-log",       icon: ScrollText },
      { label: "System health",   href: "/admin/system",          icon: Server },
    ],
  },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="px-3 py-4 space-y-6">
      {SECTIONS.map((section) => (
        <div key={section.title}>
          <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-aristo-brown/40">
            {section.title}
          </div>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const Icon       = item.icon;
              const active     = pathname?.startsWith(item.href);
              const baseClass  =
                "group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150";

              if (item.comingSoon) {
                return (
                  <li key={item.href}>
                    <div
                      className={cn(
                        baseClass,
                        "text-aristo-brown/30 cursor-not-allowed select-none"
                      )}
                      title="Shipping in a later phase"
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{item.label}</span>
                      <span className="ml-auto text-[9px] uppercase tracking-wider font-bold text-aristo-brown/30">
                        Soon
                      </span>
                    </div>
                  </li>
                );
              }

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      baseClass,
                      active
                        ? "bg-aristo-orange text-white shadow-aristo-sm"
                        : "text-aristo-brown/70 hover:bg-white/70 hover:text-aristo-brown"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 flex-shrink-0",
                        active ? "text-white" : "text-aristo-brown/50 group-hover:text-aristo-orange"
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Exposed so other admin code (breadcrumbs, page titles) can read it. */
export const ADMIN_NAV_SECTIONS = SECTIONS;
export type { NavItem, NavSection };
