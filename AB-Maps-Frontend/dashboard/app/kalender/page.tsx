"use client"

import { ShiftCalendar } from "@/components/dashboard/leader/ShiftCalendar"

export default function KalenderPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-5">
        <p className="font-mono text-[11px] uppercase tracking-wider text-ab-fg-4">Planlegging</p>
        <h1 className="font-instrument text-3xl text-ab-fg">Vaktplan</h1>
        <p className="mt-1 max-w-2xl text-sm text-ab-fg-3">
          Salgssjefer og teamledere planlegger promotørenes vakter. Promotører ser sin egen og
          teamets plan, og kan be om å bytte vakt med en lagkamerat.
        </p>
      </div>
      <ShiftCalendar />
    </div>
  )
}
