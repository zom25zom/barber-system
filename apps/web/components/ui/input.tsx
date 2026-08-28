"use client";

/**
 * shadcn/ui Input — Barber Smart token styling.
 * Wire-friendly: all native input props pass through.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-xl border border-[var(--bs-border)] bg-[var(--bs-bg)] px-4 py-2.5 text-sm text-[var(--bs-text)] transition-colors",
          "placeholder:text-[var(--bs-text-faint)]",
          "focus-visible:outline-none focus-visible:border-[var(--bs-primary)] focus-visible:ring-2 focus-visible:ring-[var(--bs-primary)]/25",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
