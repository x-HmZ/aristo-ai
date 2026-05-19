"use client";

import * as React from "react";
import { BrandCard } from "./BrandCard";
import { cn }        from "@/lib/utils";

export interface StatCardProps {
  label:    string;
  value:    React.ReactNode;
  sub?:     React.ReactNode;
  icon?:    React.ReactNode;
  color?:   string;       // explicit override; default is the orange brand
  trend?:   { value: number; positive: boolean };
  loading?: boolean;
  className?: string;
}

/**
 * StatCard — single number summary tile with optional sub-text + trend.
 * Replaces the inline StatCard in the legacy admin/page.tsx.
 */
export function StatCard({
  label,
  value,
  sub,
  icon,
  color = "hsl(var(--aristo-orange))",
  trend,
  loading,
  className,
}: StatCardProps) {
  if (loading) {
    return (
      <BrandCard className={cn("space-y-2", className)}>
        <div className="h-7 w-20 rounded-md bg-aristo-orange-pale/40 animate-pulse" />
        <div className="h-3 w-28 rounded-md bg-aristo-orange-pale/30 animate-pulse" />
      </BrandCard>
    );
  }

  return (
    <BrandCard className={className}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className="text-2xl font-bold tabular-nums leading-tight"
            style={{ color }}
          >
            {value}
          </div>
          <div className="text-sm font-semibold text-aristo-brown mt-0.5 truncate">
            {label}
          </div>
          {sub && (
            <div className="text-xs text-aristo-brown/60 mt-1">{sub}</div>
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0 text-aristo-brown/40">{icon}</div>
        )}
      </div>
      {trend && (
        <div
          className={cn(
            "mt-3 inline-flex items-center gap-1 text-[11px] font-semibold",
            trend.positive ? "text-green-600" : "text-red-500"
          )}
        >
          {trend.positive ? "▲" : "▼"} {Math.abs(trend.value)}%
        </div>
      )}
    </BrandCard>
  );
}
