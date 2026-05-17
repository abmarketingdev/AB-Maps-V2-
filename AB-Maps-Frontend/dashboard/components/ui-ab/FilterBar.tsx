"use client"
import * as React from "react"
import { Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface FilterChip {
  label: string
  value?: React.ReactNode
  onRemove?: () => void
  onClick?: () => void
}

interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  chips?: FilterChip[]
  onAdd?: () => void
  right?: React.ReactNode
}

export function FilterBar({ chips, onAdd, right, className, children, ...props }: FilterBarProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 flex-wrap px-4 md:px-6 py-2.5 border-b border-ab-line-1 bg-ab-base",
        className,
      )}
      {...props}
    >
      {chips?.map((chip, i) => (
        <button
          key={`${chip.label}-${i}`}
          onClick={chip.onClick}
          className={cn(
            "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-ab-md",
            "border border-dashed border-ab-line text-[12px] text-ab-fg-2",
            "hover:border-ab-line-2 hover:bg-ab-hover hover:text-ab-fg transition-colors",
          )}
        >
          <span className="text-ab-fg-3">{chip.label}</span>
          {chip.value !== undefined && <span className="text-ab-fg">{chip.value}</span>}
          {chip.onRemove && (
            <X
              className="h-3 w-3 text-ab-fg-3 hover:text-ab-fg"
              onClick={(e) => {
                e.stopPropagation()
                chip.onRemove?.()
              }}
            />
          )}
        </button>
      ))}
      {onAdd && (
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-1 h-7 px-2 rounded-ab-md text-[12px] text-ab-fg-3 hover:text-ab-fg hover:bg-ab-hover transition-colors"
        >
          <Plus className="h-3 w-3" /> Filter
        </button>
      )}
      {children}
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  )
}
