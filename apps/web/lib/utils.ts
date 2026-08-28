import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * shadcn/ui class merge helper (Tailwind v4-compatible).
 * Merges conditional class names, de-duplicating conflicting Tailwind utilities.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
