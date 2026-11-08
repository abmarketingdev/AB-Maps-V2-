"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { stringToHsl } from "@/lib/stringToHsl"
import { initials } from "../states"

export function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  const { resolvedTheme } = useTheme()
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-ab-fg"
      style={{ width: size, height: size, fontSize: size <= 28 ? 10 : 12, background: stringToHsl(name, { dark: resolvedTheme === "dark" }) }}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}
