import * as React from "react"
import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Sparkline } from "./Sparkline"

interface KPIProps {
  eyebrow?: React.ReactNode
  value: React.ReactNode
  suffix?: React.ReactNode
  delta?: React.ReactNode
  deltaPos?: boolean
  spark?: number[]
  className?: string
  onClick?: () => void
}

export function KPI({
  eyebrow,
  value,
  suffix,
  delta,
  deltaPos,
  spark,
  className,
  onClick,
}: KPIProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "ab-card relative overflow-hidden",
        onClick && "cursor-pointer",
        className,
      )}
    >
      <div className="p-4 md:p-5 flex flex-col gap-3">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <div className="flex items-baseline gap-1.5">
          <div className="mono text-[28px] md:text-[32px] leading-none font-semibold text-ab-fg tracking-tight">
            {value}
          </div>
          {suffix && <div className="text-[12px] text-ab-fg-3 uppercase tracking-wider">{suffix}</div>}
        </div>
        {delta && (
          <div className="flex items-center gap-1.5 text-[12px]">
            <span
              className={cn(
                "inline-flex items-center gap-1 font-medium",
                deltaPos ? "text-ab-success" : "text-ab-danger",
              )}
            >
              {deltaPos ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {delta}
            </span>
          </div>
        )}
      </div>
      {spark && spark.length > 0 && (
        <div className="absolute bottom-0 right-0 opacity-90 pointer-events-none">
          <Sparkline data={spark} width={160} height={42} />
        </div>
      )}
    </div>
  )
}
