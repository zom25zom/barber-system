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
    amber: "border-amber-400/20 border-t-amber-400",
    white: "border-white/20 border-t-white",
    zinc: "border-zinc-700 border-t-zinc-300",
  };

  return (
    <div className={`inline-flex items-center justify-center gap-2.5 ${className}`}>
      <div
        className={`animate-spin rounded-full ${sizeClasses[size]} ${colorClasses[color]}`}
        role="status"
        aria-label="Loading"
      />
      {label && <span className="text-sm font-medium text-zinc-300">{label}</span>}
    </div>
  );
}
