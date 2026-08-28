"use client";

/**
 * shadcn/ui Button — Barber Smart theme.
 *
 * Brand-board variants:
 *   default     → 'Primary Button'   gold #C9A227 fill (charcoal text)
 *   secondary   → 'Secondary Button' outlined gold / raised surface
 *   ghost       → 'Ghost Button'     text-only, gold on hover
 *   destructive → muted red (harmonized with palette)
 *   outline     → neutral outlined
 */

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bs-primary)]/50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--bs-primary)] text-[var(--bs-on-primary)] shadow-md hover:bg-[var(--bs-primary-strong)]",
        secondary:
          "border border-[var(--bs-primary-strong)] bg-transparent text-[var(--bs-primary-strong)] hover:bg-[var(--bs-primary-soft)]",
        ghost:
          "text-[var(--bs-text-muted)] hover:bg-[var(--bs-primary-soft)] hover:text-[var(--bs-primary)]",
        destructive:
          "bg-[var(--bs-error)] text-white shadow-md hover:brightness-110",
        outline:
          "border border-[var(--bs-border)] bg-transparent text-[var(--bs-text)] hover:bg-[var(--bs-primary-soft)]",
        link: "text-[var(--bs-primary)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-2xl px-8 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
