"use client"

import * as React from "react"
import { Sun, Moon } from "lucide-react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <div
        className={cn(
          "h-8 w-8 rounded-ab-md border border-ab-line bg-ab-elevated",
          className,
        )}
        aria-hidden
      />
    )
  }

  const isDark = resolvedTheme === "dark"
  return (
    <button
      type="button"
      aria-label={isDark ? "Bytt til lyst tema" : "Bytt til mørkt tema"}
      title={isDark ? "Lyst tema" : "Mørkt tema"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "relative h-8 w-8 inline-flex items-center justify-center rounded-ab-md",
        "border border-ab-line bg-ab-elevated text-ab-fg-2",
        "hover:bg-ab-hover hover:text-ab-fg transition-colors",
        className,
      )}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}
