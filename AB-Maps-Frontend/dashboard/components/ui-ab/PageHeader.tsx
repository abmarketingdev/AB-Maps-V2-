"use client"
import * as React from "react"
import { cn } from "@/lib/utils"

interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  range?: boolean
  rangeValue?: string
  onRangeChange?: (value: string) => void
  rangeOptions?: { label: string; value: string }[]
  action?: React.ReactNode
}

const DEFAULT_RANGE: { label: string; value: string }[] = [
  { label: "1D", value: "1D" },
  { label: "1U", value: "1W" },
  { label: "1M", value: "1M" },
  { label: "ÅID", value: "YTD" },
]

export function PageHeader({
  eyebrow,
  title,
  description,
  range,
  rangeValue,
  onRangeChange,
  rangeOptions = DEFAULT_RANGE,
  action,
  className,
  ...props
}: PageHeaderProps) {
  const [internalRange, setInternalRange] = React.useState(rangeValue ?? rangeOptions[1]?.value)
  const active = rangeValue ?? internalRange
  const setActive = (v: string) => {
    if (rangeValue === undefined) setInternalRange(v)
    onRangeChange?.(v)
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-4 px-4 md:px-6 py-5 md:py-6",
        "border-b border-ab-line-1",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="font-display text-[20px] md:text-[24px] leading-tight font-semibold text-ab-fg tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-[13px] text-ab-fg-2 max-w-2xl">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {range && (
          <div className="inline-flex rounded-ab-md border border-ab-line bg-ab-elevated p-0.5">
            {rangeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setActive(opt.value)}
                className={cn(
                  "h-7 px-2.5 text-[11px] font-semibold tracking-wider uppercase rounded-[4px] transition-colors",
                  active === opt.value
                    ? "bg-ab-hover text-ab-fg"
                    : "text-ab-fg-3 hover:text-ab-fg",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
        {action}
      </div>
    </div>
  )
}
