import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Util standar shadcn/ui: gabungkan className dengan aman (Tailwind-aware).
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
