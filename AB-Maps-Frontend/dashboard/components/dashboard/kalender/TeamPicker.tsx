"use client"

import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { Check, ChevronsUpDown, Eye, Search, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/components/ui/use-mobile"
import { ROLE_LABEL, type TeamSummary } from "@/lib/api/scheduling"
import { Surface } from "./Surface"

// Team picker. Admin: all teams with search, grouped by city. Sales chief:
// own teams. Team leader: own team(s), read-only badge. One team → a static
// label (nothing to pick).

interface TeamPickerProps {
  teams: TeamSummary[]
  value: string | null
  onChange: (id: string) => void
}

function groupByCity(teams: TeamSummary[]) {
  const map = new Map<string, TeamSummary[]>()
  for (const t of teams) {
    const k = t.city || "Uten by"
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(t)
  }
  return [...map.entries()].sort(([a], [b]) =>
    a === "Uten by" ? 1 : b === "Uten by" ? -1 : a.localeCompare(b, "nb"),
  )
}

function TeamLabel({ team }: { team: TeamSummary }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Users className="h-4 w-4 shrink-0 text-ab-fg-3" aria-hidden />
      <span className="truncate font-semibold text-ab-fg">{team.name}</span>
      {team.city && <span className="hidden shrink-0 text-ab-fg-3 sm:inline">· {team.city}</span>}
      {!team.can_edit && (
        <span className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-full border border-ab-line bg-ab-subtle px-2 py-0.5 text-[11px] font-medium text-ab-fg-2">
          <Eye className="h-3 w-3" aria-hidden />
          Kun lesing
        </span>
      )}
    </span>
  )
}

function TeamList({
  teams,
  value,
  onPick,
  showSearch,
}: {
  teams: TeamSummary[]
  value: string | null
  onPick: (id: string) => void
  showSearch: boolean
}) {
  const [q, setQ] = React.useState("")
  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return teams
    return teams.filter((t) =>
      [t.name, t.city].some((v) => v && v.toLowerCase().includes(s)),
    )
  }, [q, teams])
  const groups = groupByCity(filtered)

  return (
    <div className="flex min-h-0 flex-col">
      {showSearch && (
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ab-fg-3" aria-hidden />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Søk etter team eller by"
            aria-label="Søk etter team"
            className="h-11 w-full rounded-ab-md border border-ab-line bg-ab-elevated pl-9 pr-3 text-[14px] text-ab-fg placeholder:text-ab-fg-4 focus:border-ab-accent focus:outline-none focus:ring-2 focus:ring-ab-accent-soft md:h-9 md:text-[13px]"
          />
        </div>
      )}
      <div role="listbox" aria-label="Team" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {groups.length === 0 && <p className="px-3 py-6 text-center text-[13px] text-ab-fg-3">Ingen team passer søket.</p>}
        {groups.map(([city, list]) => (
          <div key={city} className="mb-1">
            <div className="sticky top-0 z-[1] bg-ab-elevated px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ab-fg-3">
              {city}
            </div>
            {list.map((t) => {
              const active = t.id === value
              return (
                <button
                  key={t.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => onPick(t.id)}
                  className={cn(
                    "flex min-h-[44px] w-full cursor-pointer items-center gap-2 rounded-ab-md px-2 py-1.5 text-left md:min-h-[40px]",
                    "hover:bg-ab-hover focus-visible:bg-ab-hover focus-visible:outline-none",
                    active && "bg-ab-accent-soft hover:bg-ab-accent-soft",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ab-fg">{t.name}</span>
                    <span className="block truncate text-[11px] text-ab-fg-3">
                      {t.role === "admin" ? "" : `${ROLE_LABEL[t.role] ?? ""} · `}
                      {t.member_count} {t.member_count === 1 ? "person" : "personer"}
                    </span>
                  </span>
                  {t.pending_requests > 0 && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#F59E0B] px-1.5 text-[11px] font-semibold tabular-nums text-white">
                      {t.pending_requests}
                    </span>
                  )}
                  {active && <Check className="h-4 w-4 shrink-0 text-ab-accent-3" aria-hidden />}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export function TeamPicker({ teams, value, onChange }: TeamPickerProps) {
  const isMobile = useIsMobile()
  const [open, setOpen] = React.useState(false)
  const current = teams.find((t) => t.id === value) ?? null
  const showSearch = teams.length > 6

  if (teams.length <= 1) {
    return current ? (
      <div className="flex h-11 min-w-0 items-center rounded-ab-md border border-ab-line bg-ab-elevated px-3 text-[13px] md:h-9">
        <TeamLabel team={current} />
      </div>
    ) : null
  }

  const trigger = (
    <button
      type="button"
      aria-haspopup="listbox"
      aria-expanded={open}
      onClick={isMobile ? () => setOpen(true) : undefined}
      className={cn(
        "flex h-11 w-full min-w-0 cursor-pointer items-center gap-2 rounded-ab-md border border-ab-line bg-ab-elevated px-3 text-left text-[13px] md:h-9 md:w-auto md:max-w-[420px]",
        "hover:border-ab-line-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ab-accent",
      )}
    >
      <span className="min-w-0 flex-1">{current ? <TeamLabel team={current} /> : <span className="text-ab-fg-3">Velg team</span>}</span>
      <ChevronsUpDown className="h-4 w-4 shrink-0 text-ab-fg-3" aria-hidden />
    </button>
  )

  const pick = (id: string) => {
    onChange(id)
    setOpen(false)
  }

  if (isMobile) {
    return (
      <>
        {trigger}
        <Surface open={open} onOpenChange={setOpen} title="Velg team" description={`${teams.length} team`}>
          <div className="flex h-[min(60dvh,520px)] flex-col">
            <TeamList teams={teams} value={value} onPick={pick} showSearch={showSearch} />
          </div>
        </Surface>
      </>
    )
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          collisionPadding={16}
          className={cn(
            "z-[70] flex max-h-[min(480px,var(--radix-popover-content-available-height))] w-[360px] flex-col rounded-ab-xl border border-ab-line bg-ab-elevated p-2",
            "shadow-[0_16px_48px_-12px_rgba(16,24,40,0.30)] outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] data-[state=open]:slide-in-from-top-1",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-150 motion-reduce:animate-none",
          )}
        >
          <TeamList teams={teams} value={value} onPick={pick} showSearch={showSearch} />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
