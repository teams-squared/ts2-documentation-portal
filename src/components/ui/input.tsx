import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Input — design-system Section 8.4.
 *
 * - Height 40px (h-10), padding `px-3 py-2.5`
 * - Border uses `border-input` (→ --border-strong)
 * - Radius `rounded-sm` (6px) per Section 6
 * - Focus ring via `--ring` token (2px ring, 2px offset)
 * - Error state driven by `aria-invalid` → red border + danger ring
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "focus-glow h-10 w-full min-w-0 rounded-sm border border-input bg-background px-3 py-2.5 text-sm transition-[color,background-color,border-color,box-shadow] duration-fast ease-out-expo outline-none",
        "placeholder:text-foreground-subtle",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "selection:bg-primary selection:text-primary-foreground",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:border-primary",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/30",
        className
      )}
      {...props}
    />
  )
}

export { Input }
