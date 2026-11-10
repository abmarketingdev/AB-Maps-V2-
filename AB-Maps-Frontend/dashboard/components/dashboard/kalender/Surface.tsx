"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/components/ui/use-mobile"

// One popup primitive for the Kalender: a bottom sheet on phones (<768 px),
// a centred dialog (or a right-hand panel) on desktop. Radix Dialog gives
// focus trap, Esc, scroll lock and aria wiring; tailwindcss-animate gives
// 150–200 ms enter/exit, switched off under prefers-reduced-motion.

interface SurfaceProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  /** desktop width */
  size?: "sm" | "md" | "lg"
  /** desktop placement */
  side?: "center" | "right"
  initialFocus?: React.RefObject<HTMLElement | null>
  /** phones: a centred card instead of a bottom sheet */
  phoneCenter?: boolean
}

const WIDTH = { sm: "md:max-w-[400px]", md: "md:max-w-[520px]", lg: "md:max-w-[680px]" }

export function Surface({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  side = "center",
  initialFocus,
  phoneCenter = false,
}: SurfaceProps) {
  const isMobile = useIsMobile()
  const sheet = isMobile && !phoneCenter

  const placement = isMobile && phoneCenter
    ? cn(
        "left-1/2 top-1/2 w-[calc(100vw-24px)] max-w-[440px] -translate-x-1/2 -translate-y-1/2 max-h-[calc(100dvh-32px)] rounded-[20px] border",
        "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
      )
    : isMobile
    ? cn(
        "inset-x-0 bottom-0 max-h-[92dvh] w-full rounded-t-[16px] border-t",
        "data-[state=open]:slide-in-from-bottom-8 data-[state=closed]:slide-out-to-bottom-8",
      )
    : side === "right"
      ? cn(
          "inset-y-3 right-3 w-[440px] max-w-[calc(100vw-24px)] rounded-ab-xl border",
          "data-[state=open]:slide-in-from-right-6 data-[state=closed]:slide-out-to-right-6",
        )
      : cn(
          "left-1/2 top-1/2 w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 max-h-[min(720px,calc(100dvh-48px))] rounded-ab-xl border",
          "data-[state=open]:zoom-in-[0.98] data-[state=closed]:zoom-out-[0.98]",
          WIDTH[size],
        )

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-[80] bg-black/40 backdrop-blur-[2px]",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
            "duration-200 motion-reduce:animate-none",
          )}
        />
        <DialogPrimitive.Content
          tabIndex={-1}
          onOpenAutoFocus={(e) => {
            // Focus stays trapped in the surface, but start on the surface
            // itself (not the × button) so no stray focus ring shows on open.
            e.preventDefault()
            if (initialFocus?.current) initialFocus.current.focus()
            else (e.currentTarget as HTMLElement | null)?.focus()
          }}
          className={cn(
            "fixed z-[81] flex flex-col border-ab-line bg-ab-elevated text-ab-fg shadow-[0_24px_64px_-12px_rgba(16,24,40,0.28)] outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
            "duration-200 ease-out-cubic motion-reduce:animate-none",
            placement,
          )}
        >
          {sheet && (
            <div className="flex justify-center pt-2" aria-hidden>
              <div className="h-1 w-10 rounded-full bg-ab-line-2" />
            </div>
          )}
          <div className={cn("flex items-start gap-3 px-5", sheet ? "pt-3 pb-3" : isMobile ? "pt-4 pb-3" : "pt-5 pb-4")}>
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="font-display text-[17px] font-semibold leading-6 tracking-tight text-ab-fg">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-0.5 text-[13px] leading-5 text-ab-fg-2">
                  {description}
                </DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              aria-label="Lukk"
              className={cn(
                "-mr-2 -mt-1 flex shrink-0 cursor-pointer items-center justify-center rounded-ab-md text-ab-fg-3 transition-colors",
                "hover:bg-ab-hover hover:text-ab-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ab-accent",
                isMobile ? "h-11 w-11" : "h-8 w-8",
              )}
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>
          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5",
              sheet && !footer && "pb-[max(20px,env(safe-area-inset-bottom))]",
            )}
          >
            {children}
          </div>
          {footer && (
            <div
              className={cn(
                "flex flex-col-reverse gap-2 border-t border-ab-line-1 px-5 py-4 md:flex-row md:items-center md:justify-end",
                sheet && "pb-[max(16px,env(safe-area-inset-bottom))]",
              )}
            >
              {footer}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

// ── Small shared controls ──────────────────────────────────────────────────

type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "success"

const BTN: Record<BtnVariant, string> = {
  primary: "bg-ab-accent text-ab-on-accent hover:bg-ab-accent-2 border border-transparent",
  secondary: "bg-ab-elevated text-ab-fg border border-ab-line hover:border-ab-line-2 hover:bg-ab-hover",
  ghost: "bg-transparent text-ab-fg-2 border border-transparent hover:bg-ab-hover hover:text-ab-fg",
  danger: "bg-ab-elevated text-[#B91C1C] border border-[#FCA5A5] hover:bg-[#FEF2F2] dark:text-[#FCA5A5] dark:border-[#7F1D1D] dark:hover:bg-[#2A1215]",
  success: "bg-[#16A34A] text-white border border-transparent hover:bg-[#15803D]",
}

export const Btn = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" }
>(function Btn({ variant = "secondary", size = "md", className, type = "button", ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex cursor-pointer select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-ab-md font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ab-accent focus-visible:ring-offset-1 focus-visible:ring-offset-ab-elevated",
        "disabled:cursor-not-allowed disabled:opacity-50",
        size === "md" ? "h-11 px-4 text-[14px] md:h-9 md:text-[13px]" : "h-11 px-3 text-[14px] md:h-8 md:text-[12px]",
        BTN[variant],
        className,
      )}
      {...props}
    />
  )
})

export function NumberField({
  label,
  value,
  onChange,
  placeholder,
  suffix,
  id,
  max = 999,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  suffix?: string
  id: string
  max?: number
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-ab-fg-2">{label}</span>
      <span className="relative block">
        <input
          id={id}
          inputMode="numeric"
          pattern="[0-9]*"
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, "").slice(0, 3)
            onChange(raw === "" ? null : Math.min(max, Number(raw)))
          }}
          className={cn(
            "h-11 w-full rounded-ab-md border border-ab-line bg-ab-elevated px-3 text-[15px] tabular-nums text-ab-fg md:h-10 md:text-[14px]",
            "placeholder:text-ab-fg-4 focus:border-ab-accent focus:outline-none focus:ring-2 focus:ring-ab-accent-soft",
            suffix && "pr-16",
          )}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[12px] text-ab-fg-3">
            {suffix}
          </span>
        )}
      </span>
    </label>
  )
}
