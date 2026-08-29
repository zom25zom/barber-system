"use client";

interface SpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  label?: string;
  color?: "amber" | "white" | "zinc";
}

export default function Spinner({
  size = "md",
  className = "",
  label,
  color = "amber",
}: SpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-6 w-6 border-2",
    lg: "h-8 w-8 border-3",
    xl: "h-12 w-12 border-4",
  };

  const colorClasses = {
    amber: "border-[var(--bs-primary)]/20 border-t-[var(--bs-primary)]",
    white: "border-white/20 border-t-white",
    zinc: "border-[var(--bs-border-strong)] border-t-[var(--bs-text-muted)]",
  };

  return (
    <div className={`inline-flex items-center justify-center gap-2.5 ${className}`}>
      <div
        className={`animate-spin rounded-full ${sizeClasses[size]} ${colorClasses[color]}`}
        role="status"
        aria-label="Loading"
      />
      {label && <span className="text-sm font-medium text-[var(--bs-text-muted)]">{label}</span>}
    </div>
  );
}
