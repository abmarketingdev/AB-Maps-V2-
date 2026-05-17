import * as React from "react"
import { cn } from "@/lib/utils"

type Tone = "neutral" | "success" | "warn" | "danger" | "info" | "live"

interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  dot?: boolean
}

export function StatusPill({
  tone = "neutral",
  dot = true,
  className,
  children,
  ...props
}: StatusPillProps) {
  return (
    <span
      className={cn(
        "ab-pill",
        tone === "success" && "success",
        tone === "warn" && "warn",
        tone === "danger" && "danger",
        tone === "info" && "info",
        tone === "live" && "live",
        className,
      )}
      {...props}
    >
      {dot && <span className="ab-dot" />}
      {children}
    </span>
  )
}
