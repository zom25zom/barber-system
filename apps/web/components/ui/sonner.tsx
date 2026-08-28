"use client";

/**
 * shadcn/ui Sonner toaster — Barber Smart harmonization.
 * success/error/warning colors are muted & synced with --bs-* tokens
 * via the globals.css `.toaster-group[data-type=…]` rules (no clashing).
 */

import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      dir="rtl"
      position="top-right"
      className="toaster-group"
      style={
        {
          "--normal-bg": "var(--bs-surface)",
          "--normal-text": "var(--bs-text)",
          "--normal-border": "var(--bs-border)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "!rounded-2xl !shadow-2xl !border !backdrop-blur-xl",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
