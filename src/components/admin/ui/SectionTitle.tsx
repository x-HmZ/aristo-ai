import * as React from "react";
import { cn } from "@/lib/utils";

export interface SectionTitleProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function SectionTitle({
  title,
  description,
  action,
  className,
}: SectionTitleProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3 mb-3", className)}>
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-aristo-brown">{title}</h3>
        {description && (
          <p className="text-xs text-aristo-brown/60 mt-0.5">{description}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
