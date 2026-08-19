/**
 * Promoter scheduling API — whole-day shifts + trade-two-shifts swap requests.
 * Backed by the maps `scheduling` app (/api/scheduling/…). Same fetchWithAuth pattern as
 * services/todoService.ts.
 */
import { fetchWithAuth } from "@/lib/auth/fetchWithAuth"

export type PersonType = "employee" | "manager"

export interface ShiftPerson {
  id: string
  type: PersonType
  name?: string
  email?: string
  ab_person_id?: string | null
  resolved: boolean
}

export interface Shift {
  id: string
  team_id: string
  employee_id: string | null
  manager_id: string | null
  campaign_id: string | null
  date: string            // YYYY-MM-DD
  note: string
  person: ShiftPerson
  mine: boolean
  created_by_id: string | null
  created_at: string
  updated_at: string
}

export type SwapStatus = "pending" | "accepted" | "declined" | "cancelled"

export interface SwapRequest {
  id: string
  requested_by_id: string
  target_id: string
  from_shift: string
  to_shift: string
  from_shift_detail: Shift
  to_shift_detail: Shift
  status: SwapStatus
  note: string
  decline_reason: string
  reviewed_at: string | null
  created_at: string
}

const SHIFTS = "/api/scheduling/shifts/"
const SWAPS = "/api/scheduling/swap-requests/"

function qs(params: Record<string, any>): string {
  const p = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") p.append(k, String(v)) })
  const s = p.toString()
  return s ? `?${s}` : ""
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error((await res.text().catch(() => "")) || `HTTP ${res.status}`)
  return res.status === 204 ? (undefined as unknown as T) : res.json()
}

function asList<T>(res: any): T[] {
  return Array.isArray(res) ? res : (res?.results ?? [])
}

// ── Shifts ──
export async function listShifts(opts: { team_id?: string; date_from?: string; date_to?: string; campaign_id?: string; person?: string } = {}): Promise<Shift[]> {
  const res = await fetchWithAuth(`${SHIFTS}${qs(opts)}`)
  return asList<Shift>(await jsonOrThrow<any>(res))
}

export async function createShift(body: { team_id: string; date: string; employee_id?: string; manager_id?: string; campaign_id?: string; note?: string }): Promise<Shift> {
  const res = await fetchWithAuth(SHIFTS, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  return jsonOrThrow<Shift>(res)
}

export async function deleteShift(id: string): Promise<void> {
  await jsonOrThrow<void>(await fetchWithAuth(`${SHIFTS}${id}/`, { method: "DELETE" }))
}

// ── Swap requests ──
export async function listSwapRequests(status?: SwapStatus): Promise<SwapRequest[]> {
  const res = await fetchWithAuth(`${SWAPS}${qs({ status })}`)
  return asList<SwapRequest>(await jsonOrThrow<any>(res))
}

export async function requestSwap(body: { from_shift: string; to_shift: string; note?: string }): Promise<SwapRequest> {
  const res = await fetchWithAuth(`${SWAPS}request/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  return jsonOrThrow<SwapRequest>(res)
}

export async function reviewSwap(id: string, action: "accept" | "decline" | "cancel", decline_reason = ""): Promise<SwapRequest> {
  const res = await fetchWithAuth(`${SWAPS}${id}/${action}/`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action === "decline" ? { decline_reason } : {}),
  })
  return jsonOrThrow<SwapRequest>(res)
}
