"use client"

// Admin: «Tildel kurs» / «Fjern» — a person with an open assignment cannot use the map until
// they finish the course (Maps answers 403 course_required). Admins are never blocked.
import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MobileDialog } from "@/components/admin"
import { useToast } from "@/hooks/use-toast"
import { assignCourse, listAssignments, revokeAssignment, type CourseAssignment } from "@/services/courseGateService"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string | null
  userName: string
  sections: { id: number; title: string; is_active?: boolean; lessons?: unknown[] }[]
}

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" }) : ""
}

export function CourseAssignmentDialog({ open, onOpenChange, userId, userName, sections }: Props) {
  const { toast } = useToast()
  const [rows, setRows] = useState<CourseAssignment[]>([])
  const [loading, setLoading] = useState(false)
  const [sectionId, setSectionId] = useState<string>("")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      setRows(await listAssignments(userId))
    } catch (e) {
      toast({ title: "Kunne ikke hente tildelte kurs", description: String((e as Error).message), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [userId, toast])

  useEffect(() => {
    if (open) { setSectionId(""); setReason(""); load() }
  }, [open, load])

  const openRows = rows.filter((r) => r.is_open)
  const closedRows = rows.filter((r) => !r.is_open).slice(0, 5)
  const assignable = sections.filter((s) => s.is_active !== false && (s.lessons?.length ?? 1) > 0)

  const onAssign = async () => {
    if (!userId || !sectionId) return
    setBusy(true)
    try {
      const row = await assignCourse(userId, Number(sectionId), reason.trim())
      toast({
        title: row.already_completed ? "Kurset er allerede fullført" : "Kurs tildelt",
        description: row.already_completed
          ? `${userName} har allerede fullført «${row.section_title}», så kartet blir ikke sperret.`
          : `${userName} må fullføre «${row.section_title}» før kartet kan brukes.`,
      })
      setSectionId(""); setReason("")
      await load()
    } catch (e) {
      toast({ title: "Kunne ikke tildele kurs", description: String((e as Error).message), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const onRevoke = async (row: CourseAssignment) => {
    setBusy(true)
    try {
      await revokeAssignment(row.id)
      toast({ title: "Tildeling fjernet", description: `«${row.section_title}» er fjernet for ${userName}.` })
      await load()
    } catch (e) {
      toast({ title: "Kunne ikke fjerne", description: String((e as Error).message), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <MobileDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Kurs som må fullføres"
      description={`${userName} kan ikke bruke kartet før tildelte kurs er fullført. Administratorer sperres aldri.`}
      maxWidth="max-w-lg"
      footer={<Button variant="outline" onClick={() => onOpenChange(false)}>Lukk</Button>}
    >
      <div className="space-y-5">
        <div>
          <div className="mb-2 text-sm font-medium text-slate-700">Tildelt nå</div>
          {loading ? (
            <div className="text-sm text-slate-500">Laster …</div>
          ) : openRows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-500">Ingen kurs tildelt. Kartet er åpent.</div>
          ) : (
            <ul className="space-y-2">
              {openRows.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900">{r.section_title}</div>
                    <div className="text-xs text-slate-500">
                      Tildelt {fmt(r.assigned_at)}{r.assigned_by_name ? ` av ${r.assigned_by_name}` : ""}{r.reason ? ` · ${r.reason}` : ""}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => onRevoke(r)}>Fjern</Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium text-slate-700">Tildel kurs</div>
          <Select value={sectionId} onValueChange={setSectionId}>
            <SelectTrigger><SelectValue placeholder="Velg kurs" /></SelectTrigger>
            <SelectContent>
              {assignable.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea placeholder="Årsak (valgfritt)" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          <Button className="w-full" disabled={!sectionId || busy} onClick={onAssign}>Tildel kurs</Button>
        </div>

        {closedRows.length > 0 && (
          <div>
            <div className="mb-2 text-sm font-medium text-slate-700">Tidligere</div>
            <ul className="space-y-1">
              {closedRows.map((r) => (
                <li key={r.id} className="flex items-center justify-between text-sm text-slate-600">
                  <span className="truncate">{r.section_title}</span>
                  <Badge variant="outline">{r.completed_at ? `Fullført ${fmt(r.completed_at)}` : `Fjernet ${fmt(r.revoked_at)}`}</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </MobileDialog>
  )
}
