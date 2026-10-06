"use client";

import * as React from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { BrandCard } from "./BrandCard";
import { cn }        from "@/lib/utils";

export interface StatCardProps {
  label:    string;
  value:    React.ReactNode;
  sub?:     React.ReactNode;
  icon?:    React.ReactNode;
  /** A status colour for the value (`scoreTone` / `TONE` in admin/chart.ts); ink when omitted. */
  color?:   string;
  trend?:   { value: number; positive: boolean };
  loading?: boolean;
  className?: string;
}

/**
 * StatCard — single number summary tile with optional sub-text + trend.
 * The value is ink unless it carries a status; the icon is accent-text.
 */
export function StatCard({
  label,
  value,
  sub,
  icon,
  color,
  trend,
  loading,
  className,
}: StatCardProps) {
  if (loading) {
    return (
      <BrandCard className={cn("space-y-2", className)}>
        <div className="h-7 w-20 rounded-md bg-sunk motion-safe:animate-pulse" />
        <div className="h-3 w-28 rounded-md bg-sunk motion-safe:animate-pulse" />
      </BrandCard>
    );
  }

  return (
    <BrandCard className={className}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className="text-2xl font-bold tabular-nums leading-tight text-ink"
            style={color ? { color } : undefined}
          >
            {value}
          </div>
          <div className="text-sm font-semibold text-ink mt-0.5">
            {label}
          </div>
          {sub && (
            <div className="text-xs text-muted mt-1">{sub}</div>
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0 text-accent-text">{icon}</div>
        )}
      </div>
      {trend && (
        <div
          className={cn(
            "mt-3 inline-flex items-center gap-1 text-xs font-semibold",
            trend.positive ? "text-success" : "text-danger"
          )}
        >
          {trend.positive
            ? <TrendingUp aria-hidden className="size-3.5" />
            : <TrendingDown aria-hidden className="size-3.5" />}
          {trend.positive ? "Up" : "Down"} {Math.abs(trend.value)}%
        </div>
      )}
    </BrandCard>
  );
}
