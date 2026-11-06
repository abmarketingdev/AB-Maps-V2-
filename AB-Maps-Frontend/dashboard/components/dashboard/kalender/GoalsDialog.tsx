"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { GridMember, PersonType } from "@/lib/api/scheduling"
import { Btn, Surface } from "./Surface"
import { MemberAvatar } from "./WeekGrid"

// «Mål»: default daily goal per promoter (doors / givers), used on every
// work day without a per-day override. «Sett for alle» fills every row.

type Row = { person_id: string; person_type: PersonType; doors: number | null; givers: number | null }

interface GoalsDialogProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  members: GridMember[]
  teamName: string
  onSubmit: (rows: Row[]) => Promise<void>
}

function SmallNum({
  value,
  onChange,
  label,
  max = 999,
}: {
  value: number | null
  onChange: (v: number | null) => void
  label: string
  max?: number
}) {
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      pattern="[0-9]*"
      value={value ?? ""}
      placeholder="–"
      onChange={(e) => {
        const raw = e.target.value.replace(/\D/g, "").slice(0, 3)
        onChange(raw === "" ? null : Math.min(max, Number(raw)))
      }}
      className={cn(
        "h-11 w-full rounded-ab-md border border-ab-line bg-ab-elevated px-2 text-center text-[15px] tabular-nums text-ab-fg md:h-9 md:text-[14px]",
        "placeholder:text-ab-fg-4 focus:border-ab-accent focus:outline-none focus:ring-2 focus:ring-ab-accent-soft",
      )}
    />
  )
}

export function GoalsDialog({ open, onOpenChange, members, teamName, onSubmit }: GoalsDialogProps) {
  const [rows, setRows] = React.useState<Row[]>([])
  const [allDoors, setAllDoors] = React.useState<number | null>(null)
  const [allGivers, setAllGivers] = React.useState<number | null>(null)
  const [busy, setBusy] = React.useState(false)
  const membersRef = React.useRef(members)
  membersRef.current = members

  React.useEffect(() => {
    if (!open) return
    setRows(
      membersRef.current.map((m) => ({
        person_id: m.person_id,
        person_type: m.person_kind,
        doors: m.default_goals?.doors ?? null,
        givers: m.default_goals?.givers ?? null,
      })),
    )
    setAllDoors(null)
    setAllGivers(null)
  }, [open])

  const changed = rows.filter((r) => {
    const m = members.find((x) => x.person_id === r.person_id)
    return (m?.default_goals?.doors ?? null) !== r.doors || (m?.default_goals?.givers ?? null) !== r.givers
  })

  const setRow = (id: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.person_id === id ? { ...r, ...patch } : r)))

  const applyAll = () =>
    setRows((rs) =>
      rs.map((r) => ({
        ...r,
        doors: allDoors ?? r.doors,
        givers: allGivers ?? r.givers,
      })),
    )

  const submit = async () => {
    setBusy(true)
    try {
      await onSubmit(changed)
      onOpenChange(false)
    } catch {
      /* caller toasts */
    } finally {
      setBusy(false)
    }
  }

  return (
    <Surface
      open={open}
      onOpenChange={onOpenChange}
      title="Standardmål per dag"
      description={`Gjelder alle arbeidsdager uten eget dagsmål · ${teamName}`}
      size="md"
      footer={
        <>
          <Btn variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Avbryt
          </Btn>
          <Btn variant="primary" onClick={submit} disabled={busy || changed.length === 0}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {changed.length > 0 ? `Lagre ${changed.length} ${changed.length === 1 ? "endring" : "endringer"}` : "Lagre"}
          </Btn>
        </>
      }
    >
      <div className="space-y-5">
        {/* Set for everyone */}
        <div className="rounded-ab-lg border border-ab-line bg-ab-subtle p-3">
          <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-ab-fg-3">Sett for alle</div>
          <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-[12px] text-ab-fg-2">Dører</span>
              <SmallNum value={allDoors} onChange={setAllDoors} label="Dører for alle" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] text-ab-fg-2">Givere</span>
              <SmallNum value={allGivers} onChange={setAllGivers} label="Givere for alle" max={99} />
            </label>
            <Btn onClick={applyAll} disabled={allDoors === null && allGivers === null}>
              Bruk
            </Btn>
          </div>
        </div>

        {/* Per person */}
        <div>
          <div className="grid grid-cols-[1fr_72px_72px] gap-2 px-1 pb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-ab-fg-3 md:grid-cols-[1fr_88px_88px]">
            <span>Person</span>
            <span className="text-center">Dører</span>
            <span className="text-center">Givere</span>
          </div>
          <ul className="divide-y divide-ab-line-1 rounded-ab-lg border border-ab-line">
            {members.map((m) => {
              const r = rows.find((x) => x.person_id === m.person_id)
              if (!r) return null
              return (
                <li
                  key={m.person_id}
                  className="grid grid-cols-[1fr_72px_72px] items-center gap-2 px-3 py-2 md:grid-cols-[1fr_88px_88px]"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <MemberAvatar name={m.name} size={28} />
                    <span className="truncate text-[14px] text-ab-fg">{m.name}</span>
                  </span>
                  <SmallNum value={r.doors} onChange={(v) => setRow(m.person_id, { doors: v })} label={`Dører, ${m.name}`} />
                  <SmallNum
                    value={r.givers}
                    onChange={(v) => setRow(m.person_id, { givers: v })}
                    label={`Givere, ${m.name}`}
                    max={99}
                  />
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </Surface>
  )
}
