"use client";

/**
 * shadcn/ui Card family — Barber Smart token styling.
 *
 * The ONE consistent card pattern to be reused across all future page-level
 * redesigns (barber listings, service listings, dashboard stat cards, …):
 *   <Card>            → surface + border + rounded-2xl + soft shadow
 *   <CardHeader>      → padding block
 *   <CardTitle>       → primary text
 *   <CardDescription> → muted text
 *   <CardContent>     → body padding
 *   <CardFooter>      → actions row
 *   <StatCard>        → convenience wrapper for dashboard stat tiles
 */

import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl border border-[var(--bs-border)] bg-[var(--bs-surface)] text-[var(--bs-text)] shadow-lg",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-5", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("text-lg font-bold leading-none tracking-tight", className)}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm text-[var(--bs-text-muted)]", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
  ),
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-5 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

/** Dashboard stat tile: icon chip + value + label (gold accent) */
function StatCard({
  icon,
  value,
  label,
  hint,
  className,
}: {
  icon?: React.ReactNode;
  value: React.ReactNode;
  label: string;
  hint?: string;
  className?: string;
}) {
  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xl font-black tabular-nums text-[var(--bs-text)]">{value}</p>
          <p className="mt-1 text-xs font-bold text-[var(--bs-text-muted)]">{label}</p>
          {hint ? <p className="mt-0.5 text-[11px] text-[var(--bs-text-faint)]">{hint}</p> : null}
        </div>
        {icon ? (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--bs-border)] bg-[var(--bs-primary-soft)] text-[var(--bs-primary)]">
            {icon}
          </span>
        ) : null}
      </div>
    </Card>
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, StatCard };
