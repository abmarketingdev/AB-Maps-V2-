import * as React from "react"
import { cn } from "@/lib/utils"

interface SectionCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  eyebrow?: React.ReactNode
  title?: React.ReactNode
  action?: React.ReactNode
  bodyClassName?: string
  noPadding?: boolean
}

export function SectionCard({
  eyebrow,
  title,
  action,
  className,
  bodyClassName,
  noPadding,
  children,
  ...props
}: SectionCardProps) {
  return (
    <section className={cn("ab-card flex flex-col", className)} {...props}>
      {(eyebrow || title || action) && (
        <header className="ab-card-header">
          <div className="min-w-0">
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            {title && <div className="text-[14px] font-semibold text-ab-fg truncate">{title}</div>}
          </div>
          {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn(!noPadding && "ab-card-body", bodyClassName)}>{children}</div>
    </section>
  )
}
