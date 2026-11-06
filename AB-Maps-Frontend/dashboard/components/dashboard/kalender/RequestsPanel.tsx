"use client"

import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ArrowRight, Check, Inbox, Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { MoveRequest } from "@/lib/api/scheduling"
import { cardDate } from "./dates"
import { Btn, Surface } from "./Surface"
import { MemberAvatar } from "./WeekGrid"

// Move requests («be om endring av arbeidsdag») for the teams the user sees.
// Chief/admin: approve / decline (optional reason). Leader: read-only list.

interface RequestsPanelProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  requests: MoveRequest[] | null
  loading: boolean
  error: string | null
  onRetry: () => void
  canEditTeam: (teamId: string) => boolean
  teamName: string
  otherTeams: { id: string; name: string; count: number }[]
  onPickTeam: (id: string) => void
  onApprove: (r: MoveRequest) => Promise<void>
  onDecline: (r: MoveRequest, reason: string | null) => Promise<void>
}

const STATUS_CHIP: Record<string, { label: string; cls: string }> = {
  venter: { label: "Venter", cls: "bg-[#FFFBEB] text-[#92400E] border-[#FCD34D] dark:bg-[#271A05] dark:text-[#FCD34D] dark:border-[#78350F]" },
  godkjent: { label: "Godkjent", cls: "bg-[#F0FDF4] text-[#15803D] border-[#86EFAC] dark:bg-[#0F2417] dark:text-[#86EFAC] dark:border-[#14532D]" },
  avslatt: { label: "Avslått", cls: "bg-[#FEF2F2] text-[#B91C1C] border-[#FCA5A5] dark:bg-[#2A1215] dark:text-[#FCA5A5] dark:border-[#7F1D1D]" },
  avbrutt: { label: "Avbrutt", cls: "bg-ab-subtle text-ab-fg-3 border-ab-line" },
}

function DatePill({ iso, tone }: { iso: string; tone: "from" | "to" }) {
  const { day, date } = cardDate(iso)
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-ab-md border-2 px-2 text-[12px] leading-none",
        tone === "from"
          ? "border-[#2563EB] bg-[#EFF6FF] dark:border-[#3B82F6] dark:bg-[#0E1A33]"
          : "border-dashed border-[#2563EB] bg-ab-elevated dark:border-[#3B82F6]",
      )}
    >
      <span className="font-semibold text-ab-fg">{day}</span>
      <span className="tabular-nums text-ab-fg-2">{date}</span>
    </span>
  )
}

function RequestItem({
  r,
  editable,
  showTeam,
  onApprove,
  onDecline,
}: {
  r: MoveRequest
  editable: boolean
  showTeam: boolean
  onApprove: (r: MoveRequest) => Promise<void>
  onDecline: (r: MoveRequest, reason: string | null) => Promise<void>
}) {
  const [mode, setMode] = React.useState<"idle" | "decline">("idle")
  const [reason, setReason] = React.useState("")
  const [busy, setBusy] = React.useState<null | "approve" | "decline">(null)
  const [err, setErr] = React.useState<string | null>(null)
  const chip = STATUS_CHIP[r.status] ?? STATUS_CHIP.avbrutt
  const pending = r.status === "venter"
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  React.useEffect(() => {
    if (mode === "decline") textareaRef.current?.focus()
  }, [mode])

  const act = async (kind: "approve" | "decline") => {
    setBusy(kind)
    setErr(null)
    try {
      if (kind === "approve") await onApprove(r)
      else await onDecline(r, reason.trim() || null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Noe gikk galt.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-ab-lg border border-ab-line bg-ab-elevated p-3">
      <div className="flex items-start gap-3">
        <MemberAvatar name={r.person_name} size={32} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14px] font-semibold leading-5 text-ab-fg">{r.person_name}</span>
            <span className={cn("ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-4", chip.cls)}>
              {chip.label}
            </span>
          </div>
          {showTeam && <div className="truncate text-[12px] leading-4 text-ab-fg-3">{r.team_name}</div>}
          <div className="mt-2 flex items-center gap-2" aria-label={`Fra ${r.from_date} til ${r.to_date}`}>
            <DatePill iso={r.from_date} tone="from" />
            <ArrowRight className="h-4 w-4 text-ab-fg-3" aria-hidden />
            <DatePill iso={r.to_date} tone="to" />
          </div>
          {r.reason && (
            <p className="mt-2 border-l-2 border-ab-line-2 pl-2 text-[13px] leading-5 text-ab-fg-2">«{r.reason}»</p>
          )}
          {r.status === "avslatt" && r.decline_reason && (
            <p className="mt-2 text-[12px] leading-4 text-ab-fg-3">Begrunnelse: {r.decline_reason}</p>
          )}
          {!pending && r.decided_by_name && (
            <p className="mt-1 text-[12px] leading-4 text-ab-fg-3">Behandlet av {r.decided_by_name}</p>
          )}
        </div>
      </div>

      {err && (
        <p role="alert" className="mt-3 rounded-ab-md bg-[#FEF2F2] px-3 py-2 text-[12px] leading-4 text-[#B91C1C] dark:bg-[#2A1215] dark:text-[#FCA5A5]">
          {err}
        </p>
      )}

      {pending && editable && mode === "idle" && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Btn variant="secondary" onClick={() => setMode("decline")} disabled={busy !== null}>
            <X className="h-4 w-4" />
            Avslå
          </Btn>
          <Btn variant="success" onClick={() => act("approve")} disabled={busy !== null}>
            {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Godkjenn
          </Btn>
        </div>
      )}
      {pending && editable && mode === "decline" && (
        <div className="mt-3 space-y-2">
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-ab-fg-2">Begrunnelse (valgfritt)</span>
            <textarea
              ref={textareaRef}
              value={reason}
              maxLength={300}
              rows={2}
              onChange={(e) => setReason(e.target.value)}
              placeholder="F.eks. for få på jobb den dagen"
              className="w-full resize-none rounded-ab-md border border-ab-line bg-ab-elevated px-3 py-2 text-[14px] leading-5 text-ab-fg placeholder:text-ab-fg-4 focus:border-ab-accent focus:outline-none focus:ring-2 focus:ring-ab-accent-soft"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Btn variant="ghost" onClick={() => setMode("idle")} disabled={busy !== null}>
              Tilbake
            </Btn>
            <Btn variant="danger" onClick={() => act("decline")} disabled={busy !== null}>
              {busy === "decline" && <Loader2 className="h-4 w-4 animate-spin" />}
              Avslå forespørsel
            </Btn>
          </div>
        </div>
      )}
    </div>
  )
}

export function RequestsPanel(props: RequestsPanelProps) {
  const { open, onOpenChange, requests, loading, error, onRetry, canEditTeam, teamName, otherTeams, onPickTeam, onApprove, onDecline } = props
  const showTeam = false
  const reduce = useReducedMotion()
  const pending = (requests ?? []).filter((r) => r.status === "venter")
  const done = (requests ?? []).filter((r) => r.status !== "venter").slice(0, 10)

  return (
    <Surface
      open={open}
      onOpenChange={onOpenChange}
      side="right"
      title="Forespørsler om endring"
      description={`${teamName}${pending.length ? ` · ${pending.length} venter på svar` : ""}`}
    >
      {loading && !requests ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[132px] animate-pulse rounded-ab-lg bg-ab-hover motion-reduce:animate-none" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-[14px] text-ab-fg-2">{error}</p>
          <Btn onClick={onRetry}>Prøv igjen</Btn>
        </div>
      ) : (
        <div className="space-y-6">
          <section aria-label="Venter på svar">
            {pending.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-ab-lg border border-dashed border-ab-line py-10 text-center">
                <Inbox className="h-6 w-6 text-ab-fg-4" />
                <p className="text-[14px] font-medium text-ab-fg-2">Ingen ventende forespørsler</p>
                <p className="text-[12px] text-ab-fg-3">Nye forespørsler fra promotørene vises her.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                <AnimatePresence initial={false}>
                  {pending.map((r) => (
                    <motion.li
                      key={r.id}
                      layout={!reduce}
                      initial={reduce ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, x: 24, transition: { duration: 0.18 } }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <RequestItem
                        r={r}
                        editable={canEditTeam(r.team_id)}
                        showTeam={showTeam}
                        onApprove={onApprove}
                        onDecline={onDecline}
                      />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </section>
          {otherTeams.length > 0 && (
            <section>
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-ab-fg-3">Andre team</h3>
              <ul className="divide-y divide-ab-line-1 overflow-hidden rounded-ab-lg border border-ab-line">
                {otherTeams.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => onPickTeam(t.id)}
                      className="flex min-h-[44px] w-full cursor-pointer items-center gap-2 px-3 py-2 text-left hover:bg-ab-hover focus-visible:bg-ab-hover focus-visible:outline-none"
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ab-fg">{t.name}</span>
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F59E0B] px-1.5 text-[11px] font-semibold tabular-nums text-white">
                        {t.count}
                      </span>
                      <ArrowRight className="h-4 w-4 text-ab-fg-3" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {done.length > 0 && (
            <section>
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-ab-fg-3">Behandlet</h3>
              <ul className="space-y-2">
                {done.map((r) => (
                  <li key={r.id}>
                    <RequestItem r={r} editable={false} showTeam={showTeam} onApprove={onApprove} onDecline={onDecline} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Surface>
  )
}
