"use client"

/**
 * Shared today-data context for the promoter dashboard.
 *
 * The old flow had EmbeddedPromoterWidgets fetching /api/employee/me/today/
 * on its own. Now the parent PromoterDashboard wraps everything in this
 * provider — so the bento "I dag" tile up top and the live GoalRing / Streak /
 * ResponseDonut below both read from the SAME fetched values, no duplicate
 * polling, no drift. The Registrer-dør button anywhere can call refetch()
 * to trigger an immediate refresh, and can call setRegisterOpen(true) to
 * pop the modal.
 */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { fetchEmployeeToday } from "@/lib/api/employeeDashboard"
import {
  emptyEmployeeDay,
  type EmployeeDayData,
} from "@/components/dashboard/v2/employee/employeeLogic"
import { makeDemoEmployeeDay } from "./demoBackendData"

const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true"

type Status = "loading" | "ok" | "error"

interface EmployeeTodayCtx {
  data: EmployeeDayData
  status: Status
  refetch: () => Promise<void>
  registerOpen: boolean
  setRegisterOpen: (v: boolean) => void
}

const Ctx = createContext<EmployeeTodayCtx | null>(null)

export function EmployeeTodayProvider({
  firstName,
  children,
}: { firstName: string; children: ReactNode }) {
  const [data, setData] = useState<EmployeeDayData>(() =>
    DEMO ? makeDemoEmployeeDay(firstName) : emptyEmployeeDay(firstName),
  )
  const [status, setStatus] = useState<Status>(DEMO ? "ok" : "loading")
  const [registerOpen, setRegisterOpen] = useState(false)

  const refetch = useCallback(async () => {
    if (DEMO) return
    try {
      const d = await fetchEmployeeToday()
      setData(d)
      setStatus("ok")
    } catch {
      /* keep previous data, don't flap error on background poll */
    }
  }, [])

  useEffect(() => {
    if (DEMO) {
      setData(makeDemoEmployeeDay(firstName))
      setStatus("ok")
      return
    }
    let cancelled = false
    setStatus("loading")
    fetchEmployeeToday()
      .then(d => { if (!cancelled) { setData(d); setStatus("ok") } })
      .catch(() => { if (!cancelled) setStatus("error") })
    const id = window.setInterval(() => { void refetch() }, 20000)
    return () => { cancelled = true; window.clearInterval(id) }
  }, [firstName, refetch])

  return (
    <Ctx.Provider value={{ data, status, refetch, registerOpen, setRegisterOpen }}>
      {children}
    </Ctx.Provider>
  )
}

export function useEmployeeToday() {
  const c = useContext(Ctx)
  if (!c) throw new Error("useEmployeeToday must be used inside <EmployeeTodayProvider>")
  return c
}
