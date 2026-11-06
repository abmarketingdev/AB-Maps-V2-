"use client"

import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { ArrowRightLeft, CalendarCheck2, Loader2, Moon, Trash2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/components/ui/use-mobile"
import type { DayCell, GridMember } from "@/lib/api/scheduling"
import { cardDate, longDate, shortDate } from "./dates"
import { STATE_STYLES, doorsWord, fmtNum, fmtPct, giversWord } from "./states"
import { Btn, NumberField, Surface } from "./Surface"
import { MemberAvatar } from "./WeekGrid"

export interface EditorActions {
  createShift: (member: GridMember, date: string) => Promise<void>
  deleteShift: (member: GridMember, cell: DayCell) => Promise<void>
  setGoals: (member: GridMember, cell: DayCell, goals: { doors: number | null; givers: number | null } | null) => Promise<void>
  setNoShow: (member: GridMember, cell: DayCell, value: boolean) => Promise<void>
  openRequests: () => void
}

interface DayEditorProps {
  member: GridMember | null
  cell: DayCell | null
  today: string
  anchor: HTMLElement | null
  onClose: () => void
  actions: EditorActions
}

export function DayEditor({ member, cell, today, anchor, onClose, actions }: DayEditorProps) {
  const isMobile = useIsMobile()
  const open = Boolean(member && cell)
  const title = cell ? capitalise(longDate(cell.date)) : ""

  if (isMobile) {
    return (
      <Surface
        open={open}
        onOpenChange={(o) => !o && onClose()}
        title={title}
        description={member?.name}
      >
        {member && cell && <EditorBody member={member} cell={cell} today={today} actions={actions} onClose={onClose} />}
      </Surface>
    )
  }

  const virtualRef = { current: anchor ?? undefined } as React.RefObject<HTMLElement>

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()} modal>
      <PopoverPrimitive.Anchor virtualRef={virtualRef} />
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="bottom"
          align="center"
          sideOffset={8}
          collisionPadding={16}
          avoidCollisions
          tabIndex={-1}
          onOpenAutoFocus={(e) => {
            // focus the panel itself, not the × button (no stray focus ring)
            e.preventDefault()
            ;(e.currentTarget as HTMLElement | null)?.focus()
          }}
          onCloseAutoFocus={(e) => {
            // return focus to the cell that opened the editor
            e.preventDefault()
            anchor?.focus()
          }}
          className={cn(
            "z-[70] w-[360px] max-w-[calc(100vw-32px)] rounded-ab-xl border border-ab-line bg-ab-elevated text-ab-fg outline-none",
            "max-h-[var(--radix-popover-content-available-height)] overflow-y-auto overscroll-contain",
            "shadow-[0_16px_48px_-12px_rgba(16,24,40,0.30)]",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.98]",
            "data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1",
            "duration-150 motion-reduce:animate-none",
          )}
          aria-label={member && cell ? `${member.name}, ${title}` : undefined}
        >
          {member && cell && (
            <>
              <div className="flex items-start gap-3 border-b border-ab-line-1 px-4 pb-3 pt-4">
                <MemberAvatar name={member.name} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold leading-5">{member.name}</div>
                  <div className="text-[12px] leading-4 text-ab-fg-2">{title}</div>
                </div>
                <PopoverPrimitive.Close
                  aria-label="Lukk"
                  className="-mr-1.5 -mt-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-ab-md text-ab-fg-3 hover:bg-ab-hover hover:text-ab-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ab-accent"
                >
                  <X className="h-4 w-4" />
                </PopoverPrimitive.Close>
              </div>
              <div className="px-4 pb-4 pt-3">
                <EditorBody member={member} cell={cell} today={today} actions={actions} onClose={onClose} />
              </div>
            </>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function EditorBody({
  member,
  cell,
  today,
  actions,
  onClose,
}: {
  member: GridMember
  cell: DayCell
  today: string
  actions: EditorActions
  onClose: () => void
}) {
  const isWork = cell.shift_id !== null || cell.state !== "off"
  const isPast = cell.date < today
  const canNoShow = isWork && cell.date <= today
  const st = STATE_STYLES[cell.state]
  const StIcon = st.icon

  const override = cell.goals?.source === "override"
  const [doors, setDoors] = React.useState<number | null>(override ? cell.goals!.doors : null)
  const [givers, setGivers] = React.useState<number | null>(override ? cell.goals!.givers : null)
  const [busy, setBusy] = React.useState<null | "create" | "delete" | "goals" | "reset" | "noshow">(null)
  const [confirmDelete, setConfirmDelete] = React.useState(false)

  // Reset local form when switching to another cell.
  React.useEffect(() => {
    const ov = cell.goals?.source === "override"
    setDoors(ov ? cell.goals!.doors : null)
    setGivers(ov ? cell.goals!.givers : null)
    setConfirmDelete(false)
  }, [cell.date, member.person_id, cell.shift_id, cell.goals])

  const def = member.default_goals
  const dirty =
    (override ? cell.goals!.doors : null) !== doors || (override ? cell.goals!.givers : null) !== givers
  const pending = cell.move_request?.status === "venter" ? cell.move_request : null

  const run = async (kind: NonNullable<typeof busy>, fn: () => Promise<void>) => {
    setBusy(kind)
    try {
      await fn()
    } catch {
      /* rolled back + toasted by the view */
    } finally {
      setBusy(null)
    }
  }

  const { day, date } = cardDate(cell.date)

  return (
    <div className="space-y-4">
      {/* State chip + numbers */}
      <div className={cn("flex items-center gap-2 rounded-ab-lg border-2 px-3 py-2", st.card)}>
        <StIcon className={cn("h-4 w-4 shrink-0", st.ink)} strokeWidth={2.25} aria-hidden />
        <div className="min-w-0 flex-1 text-[13px] leading-5">
          <span className={cn("font-semibold", st.ink)}>{st.label}</span>
          <span className="text-ab-fg-2"> · {day} {date}</span>
        </div>
        {cell.actual && (cell.state === "worked" || cell.state === "today") && (
          <div className="text-right text-[12px] leading-4 text-ab-fg-2">
            <div>
              <span className="font-semibold tabular-nums text-ab-fg">{fmtNum(cell.actual.doors)}</span>{" "}
              {doorsWord(cell.actual.doors)}
            </div>
            <div>
              Ja {fmtNum(cell.actual.ja)} · {fmtPct(cell.actual.ja_pct)}
            </div>
          </div>
        )}
      </div>

      {/* Work day / day off */}
      <div role="radiogroup" aria-label="Type dag" className="grid grid-cols-2 gap-1 rounded-ab-lg border border-ab-line bg-ab-subtle p-1">
        <SegBtn
          active={isWork}
          disabled={busy !== null || isWork || isPast}
          onClick={() => run("create", () => actions.createShift(member, cell.date))}
          icon={busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck2 className="h-4 w-4" />}
          label="Arbeidsdag"
        />
        <SegBtn
          active={!isWork}
          disabled={busy !== null || !isWork}
          onClick={() => setConfirmDelete(true)}
          icon={<Moon className="h-4 w-4" />}
          label="Fri"
        />
      </div>
      {!isWork && isPast && (
        <p className="-mt-2 text-[12px] leading-4 text-ab-fg-3">Dager som har vært kan ikke planlegges.</p>
      )}

      {pending && (
        <button
          type="button"
          onClick={actions.openRequests}
          className="flex w-full cursor-pointer items-center gap-2.5 rounded-ab-lg border border-[#FCD34D] bg-[#FFFBEB] px-3 py-2.5 text-left text-[13px] leading-5 text-[#92400E] hover:bg-[#FEF3C7] dark:border-[#78350F] dark:bg-[#271A05] dark:text-[#FCD34D]"
        >
          <ArrowRightLeft className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            {pending.to_date === cell.date ? (
              <>
                Ønsket ny arbeidsdag, flyttes fra <b>{shortDate(pending.from_date)}</b>
              </>
            ) : (
              <>
                Ber om å flytte til <b>{shortDate(pending.to_date)}</b>
              </>
            )}
          </span>
          <span className="text-[12px] font-semibold underline-offset-2 hover:underline">Behandle</span>
        </button>
      )}

      {isWork && cell.state !== "worked" && cell.state !== "no_show" && (
        <fieldset className="space-y-2">
          <legend className="flex w-full items-center justify-between text-[12px] font-semibold uppercase tracking-[0.06em] text-ab-fg-3">
            <span>Dagsmål</span>
            {override && (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => run("reset", () => actions.setGoals(member, cell, null))}
                className="cursor-pointer text-[12px] font-medium normal-case tracking-normal text-ab-accent-3 hover:underline disabled:opacity-50"
              >
                Bruk standard
              </button>
            )}
          </legend>
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              id="kal-goal-doors"
              label="Dører"
              value={doors}
              onChange={setDoors}
              placeholder={def?.doors != null ? String(def.doors) : "–"}
              suffix={doors === null && def?.doors != null ? "standard" : undefined}
            />
            <NumberField
              id="kal-goal-givers"
              label="Givere"
              value={givers}
              onChange={setGivers}
              placeholder={def?.givers != null ? String(def.givers) : "–"}
              suffix={givers === null && def?.givers != null ? "standard" : undefined}
              max={99}
            />
          </div>
          <p className="text-[12px] leading-4 text-ab-fg-3">
            {def
              ? `Tomt felt bruker standardmålet (${fmtNum(def.doors)} ${doorsWord(def.doors)} / ${fmtNum(def.givers)} ${giversWord(def.givers)}).`
              : "Ingen standardmål satt. Sett det under «Mål»."}
          </p>
          {dirty && (
            <div className="flex justify-end gap-2 pt-1">
              <Btn
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDoors(override ? cell.goals!.doors : null)
                  setGivers(override ? cell.goals!.givers : null)
                }}
              >
                Angre
              </Btn>
              <Btn
                size="sm"
                variant="primary"
                disabled={busy !== null}
                onClick={() =>
                  run("goals", () =>
                    actions.setGoals(member, cell, doors === null && givers === null ? null : { doors, givers }),
                  )
                }
              >
                {busy === "goals" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Lagre dagsmål
              </Btn>
            </div>
          )}
        </fieldset>
      )}

      {canNoShow && (
        <div className="flex items-center gap-3 rounded-ab-lg border border-ab-line px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold leading-5">Ikke møtt</div>
            <div className="text-[12px] leading-4 text-ab-fg-3">Promotøren møtte ikke på jobb denne dagen.</div>
          </div>
          <Switch
            checked={cell.state === "no_show"}
            disabled={busy !== null}
            label="Ikke møtt"
            onChange={(v) => run("noshow", () => actions.setNoShow(member, cell, v))}
          />
        </div>
      )}

      {isWork && (
        <div className="border-t border-ab-line-1 pt-3">
          {!confirmDelete ? (
            <Btn
              size="sm"
              variant="ghost"
              className="-ml-2 text-[#B91C1C] hover:bg-[#FEF2F2] hover:text-[#991B1B] dark:text-[#FCA5A5] dark:hover:bg-[#2A1215]"
              disabled={busy !== null}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Slett vakt
            </Btn>
          ) : (
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <p className="flex-1 text-[12px] leading-4 text-ab-fg-2">
                Vakten{cell.goals?.source === "override" ? " og dagsmålet" : ""} slettes, dagen blir fri.
                {pending ? " Forespørselen om flytting avbrytes." : ""}
              </p>
              <div className="flex gap-2">
                <Btn size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} disabled={busy !== null}>
                  Avbryt
                </Btn>
                <Btn
                  size="sm"
                  variant="danger"
                  autoFocus
                  disabled={busy !== null}
                  onClick={() =>
                    run("delete", async () => {
                      await actions.deleteShift(member, cell)
                      onClose()
                    })
                  }
                >
                  {busy === "delete" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Slett vakt
                </Btn>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SegBtn({
  active,
  disabled,
  onClick,
  icon,
  label,
}: {
  active: boolean
  disabled: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled && !active}
      onClick={active ? undefined : onClick}
      className={cn(
        "flex h-11 items-center justify-center gap-2 rounded-ab-md text-[13px] font-medium transition-colors md:h-9",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ab-accent",
        active
          ? "cursor-default bg-ab-elevated text-ab-fg shadow-[0_1px_2px_rgba(16,24,40,0.08)] ring-1 ring-ab-line"
          : "cursor-pointer text-ab-fg-2 hover:text-ab-fg disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:text-ab-fg-2",
      )}
    >
      {icon}
      {label}
    </button>
  )
}

export function Switch({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ab-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ab-elevated",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-[#DC2626]" : "bg-ab-line-2",
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-150 motion-reduce:transition-none",
          checked ? "translate-x-6" : "translate-x-1",
        )}
      />
    </button>
  )
}
