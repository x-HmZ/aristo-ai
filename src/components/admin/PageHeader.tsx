import * as React from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title:        string;
  subtitle?:    React.ReactNode;
  badge?:       React.ReactNode;
  actions?:     React.ReactNode;
  className?:   string;
  /** Optional small element placed under the subtitle (e.g. a search/filter row). */
  meta?:        React.ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  badge,
  actions,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("mb-6", className)}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-aristo-brown tracking-tight">
              {title}
            </h1>
            {badge}
          </div>
          {subtitle && (
            <p className="text-sm text-aristo-brown/60 mt-1 max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
        )}
      </div>
      {meta && <div className="mt-4">{meta}</div>}
    </header>
  );
}
