"use client"

import * as React from "react"
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  Filter,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  Maximize2,
} from "lucide-react"
import { useAuth } from "@/lib/auth/AuthContext"
import { cn } from "@/lib/utils"
import { PageHeader, Sparkline } from "@/components/ui-ab"

// ────────────────────────────────────────────────────────────────────────────────
// Types — match what the backend should serve. Until the endpoints land we use
// the mock generators below.
// ────────────────────────────────────────────────────────────────────────────────

type Period = "7d" | "30d" | "90d" | "YTD"

interface KPI {
  label: string
  value: string
  delta: { value: string; positive: boolean }
  caption: string
}

interface ChartPoint {
  date: string
  doors: number
  yesRate: number
}

interface ActivityRow {
  time: string
  agent: string
  action: string
  location: string
  campaign?: string
  tone: "info" | "success" | "warn" | "danger" | "neutral"
}

interface HorizonRow {
  name: string
  days: number[] // 60 intensity values 0..1
  jaPct: number
}

interface LeaderRow {
  rank: number
  initials: string
  name: string
  region: string
  score: number
  spark: number[]
  online: boolean
}

// ────────────────────────────────────────────────────────────────────────────────
// Mock data (deterministic — same seed every render so visuals don't twitch)
// ────────────────────────────────────────────────────────────────────────────────

function seededRand(seed: number) {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

const rand30 = seededRand(7)
const chart30: ChartPoint[] = Array.from({ length: 30 }, (_, i) => {
  const base = 240 + Math.sin(i / 4) * 100 + rand30() * 80
  return {
    date: `${String(((i + 13) % 31) + 1).padStart(2, "0")}/${String((i + 13) > 31 ? 5 : 4).padStart(2, "0")}`,
    doors: Math.round(base),
    yesRate: +(2.5 + Math.sin(i / 3 + 1) * 0.7 + rand30() * 0.4).toFixed(2),
  }
})

const liveActivity: ActivityRow[] = [
  { time: "19:03:49", agent: "Lukas Blohne",      action: "loggførte oppfølging i",   location: "Sagene",       campaign: "Talkmore",         tone: "warn"  },
  { time: "19:03:42", agent: "Embla Berg Dawson", action: "fullførte område",          location: "Sagene Vest",   campaign: "Norsk Folkehjelp", tone: "info"  },
  { time: "19:03:14", agent: "Gard Moen",         action: "registrerte nytt salg i",   location: "Oslo Nord",     campaign: "CARE",             tone: "success" },
  { time: "19:02:58", agent: "Anna Berg",         action: "startet område",            location: "Grünerløkka",   campaign: "Norsk Folkehjelp", tone: "info"  },
  { time: "19:02:31", agent: "Bjørn Lie",         action: "registrerte nytt salg i",   location: "Oslo Øst",      campaign: "Talkmore",         tone: "success" },
  { time: "19:01:55", agent: "Cato Holm",         action: "loggførte avslag i",        location: "Frogner",       campaign: "Blå Kors",         tone: "danger"  },
  { time: "19:01:22", agent: "Kåre Sand",         action: "fullførte rute",            location: "Oslo Sør",      campaign: "Strømmestiftelsen", tone: "info" },
  { time: "19:00:48", agent: "Frida Aas",         action: "registrerte nytt salg i",   location: "Sagene Øst",    campaign: "CARE",             tone: "success" },
]

const teamHorizon: HorizonRow[] = (() => {
  const names = ["Anna Berg","Bjørn Lie","Cato Holm","Dina Sørli","Eirik Vik","Frida Aas","Gard Moen","Hilde Tøn","Ivar Rud","Jenny Lo","Kåre Sand","Liv Strøm"]
  const pcts  = [18.4,  21.2,  12.1,  16.7,  19.8,  14.4,  22.6,  11.0,  17.9,  15.3,  20.1,  13.2]
  return names.map((name, idx) => {
    const rnd = seededRand(idx * 17 + 3)
    return {
      name,
      jaPct: pcts[idx],
      days: Array.from({ length: 60 }, (_, d) => {
        const wave = 0.45 + Math.sin((d + idx) / 6) * 0.3 + rnd() * 0.4
        return Math.max(0, Math.min(1, wave))
      }),
    }
  })
})()

const leaderboard: LeaderRow[] = [
  { rank: 1, initials: "GM", name: "Gard Moen",  region: "Oslo Nord", score: 100, spark: [60, 72, 55, 80, 76, 88, 95, 100], online: true  },
  { rank: 2, initials: "BL", name: "Bjørn Lie",  region: "Oslo Øst",  score: 82,  spark: [50, 56, 60, 64, 70, 75, 78, 82],   online: true  },
  { rank: 3, initials: "KS", name: "Kåre Sand",  region: "Oslo Sør",  score: 80,  spark: [42, 50, 58, 62, 68, 72, 76, 80],   online: true  },
  { rank: 4, initials: "EV", name: "Eirik Vik",  region: "Oslo Vest", score: 79,  spark: [40, 48, 55, 62, 66, 70, 76, 79],   online: false },
  { rank: 5, initials: "AB", name: "Anna Berg",  region: "Oslo Øst",  score: 76,  spark: [38, 45, 50, 58, 64, 68, 72, 76],   online: true  },
  { rank: 6, initials: "IR", name: "Ivar Rud",   region: "Oslo Sør",  score: 66,  spark: [30, 38, 44, 50, 55, 60, 63, 66],   online: false },
  { rank: 7, initials: "DS", name: "Dina Sørli", region: "Oslo Øst",  score: 59,  spark: [25, 32, 38, 44, 48, 52, 56, 59],   online: true  },
  { rank: 8, initials: "JL", name: "Jenny Lo",   region: "Oslo Sør",  score: 51,  spark: [20, 26, 32, 36, 40, 44, 48, 51],   online: false },
]

const consistency26: number[][] = (() => {
  // 5 weekdays × 26 weeks, intensity 0..3
  const rnd = seededRand(101)
  return Array.from({ length: 5 }, () =>
    Array.from({ length: 26 }, () => Math.floor(rnd() * 4)),
  )
})()

// ────────────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────────────

export function DashboardContent() {
  const { user } = useAuth()
  const [period, setPeriod] = React.useState<Period>("30d")

  // Hooked KPI values (today shown as "live"); when wiring to backend, fetch
  // /api/dashboard/quick-stats and map fields → these locals.
  const kpis: KPI[] = [
    { label: "I DAG",            value: "312",    delta: { value: "+8.4 %",  positive: true }, caption: "dører banket" },
    { label: "DENNE UKEN",       value: "1 847",  delta: { value: "+12.1 %", positive: true }, caption: "vs forrige uke" },
    { label: "DENNE MÅNEDEN",    value: "7 482",  delta: { value: "+4.6 %",  positive: true }, caption: "på spor" },
    { label: "KONVERTERING",     value: "3.28 %", delta: { value: "+0.4 pp", positive: true }, caption: "rullerende 30d" },
    { label: "AKTIVE ANSATTE",   value: "73",     delta: { value: "5 inaktiv", positive: true }, caption: "av 78 totalt" },
    { label: "MÅL-FREMGANG",     value: "75.6 %", delta: { value: "+12 foran", positive: true }, caption: "tempo" },
  ]

  const today = new Date().toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  const campaignName = "Norsk Folkehjelp"
  const greetingName = user?.user_info?.name?.split(" ")[0] || "Lars"

  return (
    <div className="flex-1 flex flex-col bg-ab-base text-ab-fg">
      <PageHeader
        eyebrow={`OSLO ØST · 6 KAMPANJER · OVERSIKT`}
        title="Dashbord"
        description={`Live drift på tvers av aktive kampanjer · ${today.charAt(0).toUpperCase() + today.slice(1)}`}
        action={
          <div className="flex items-center gap-2">
            <button className="ab-btn"><Filter className="h-3.5 w-3.5" /> Filter</button>
            <button className="ab-btn"><Download className="h-3.5 w-3.5" /> Eksport</button>
          </div>
        }
      />

      <div className="px-4 md:px-6 py-6 max-w-[1600px] mx-auto w-full space-y-6">
        {/* ─────────────── KPI Strip (single row, vertical dividers) ─────────────── */}
        <section
          className={cn(
            "rounded-ab-lg border border-ab-line bg-ab-elevated",
            "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
            "divide-y divide-ab-line-1 sm:divide-y-0 sm:divide-x",
          )}
        >
          {kpis.map((k) => (
            <div key={k.label} className="p-4 md:p-5 space-y-2">
              <div className="eyebrow">{k.label}</div>
              <div className="mono text-[28px] md:text-[32px] leading-none font-semibold tracking-tight text-ab-fg">
                {k.value}
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className={cn("mono inline-flex items-center gap-0.5 font-medium", k.delta.positive ? "text-ab-success" : "text-ab-danger")}>
                  {k.delta.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {k.delta.value}
                </span>
                <span className="text-ab-fg-3">{k.caption}</span>
              </div>
            </div>
          ))}
        </section>

        {/* ─────────────── Main Chart ─────────────── */}
        <SectionFrame>
          <div className="flex items-center justify-between px-4 md:px-5 pt-4 md:pt-5 pb-2">
            <div>
              <div className="text-[13px] font-semibold text-ab-fg">
                Dører banket vs ja-prosent
                <span className="text-ab-fg-3 font-normal"> · siste {period === "7d" ? "7 dager" : period === "30d" ? "30 dager" : period === "90d" ? "90 dager" : "året"}</span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-[11px] text-ab-fg-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-3 rounded-sm bg-[var(--ab-accent-9)]/30 border border-[var(--ab-accent-9)]/40" />
                  Dører banket
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-px w-3 bg-[var(--ab-accent-11)]" />
                  Ja-prosent
                </span>
              </div>
            </div>
            <PeriodTabs value={period} onChange={setPeriod} />
          </div>
          <div className="px-2 md:px-3 pb-4 h-[280px] md:h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart30} margin={{ top: 10, right: 24, bottom: 8, left: 8 }}>
                <defs>
                  <linearGradient id="doorsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor="var(--ab-accent-9)"  stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--ab-accent-9)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--ab-border-subtle)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--ab-text-quaternary)" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="doors" stroke="var(--ab-text-quaternary)" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="rate"  orientation="right" stroke="var(--ab-text-quaternary)" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                <RTooltip
                  contentStyle={{
                    background: "var(--ab-bg-overlay)",
                    border: "1px solid var(--ab-border-strong)",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "var(--ab-text-primary)",
                  }}
                  labelStyle={{ color: "var(--ab-text-tertiary)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}
                  cursor={{ stroke: "var(--ab-border-strong)", strokeDasharray: "2 4" }}
                />
                <Area  yAxisId="doors" type="monotone" dataKey="doors"  stroke="none" fill="url(#doorsFill)" />
                <Line  yAxisId="rate"  type="monotone" dataKey="yesRate" stroke="var(--ab-accent-11)" strokeWidth={1.75} dot={{ r: 2.5, fill: "var(--ab-text-primary)", stroke: "var(--ab-accent-11)", strokeWidth: 1 }} activeDot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </SectionFrame>

        {/* ─────────────── Live activity + Goal pacing ─────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
          <SectionFrame>
            <header className="px-4 md:px-5 pt-4 md:pt-5 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative inline-flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-ab-teal opacity-60 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-ab-teal" />
                </span>
                <span className="text-[13px] font-semibold text-ab-fg">Live aktivitet</span>
              </div>
              <span className="eyebrow">LIVE · oppdateres automatisk</span>
            </header>
            <ul className="divide-y divide-ab-line-1">
              {liveActivity.map((a, i) => (
                <li
                  key={i}
                  className="px-4 md:px-5 py-2.5 flex items-center gap-3 text-[12.5px] hover:bg-ab-hover/40 transition-colors"
                >
                  <span className="mono text-[11px] text-ab-fg-3 w-[60px] shrink-0">{a.time}</span>
                  <ToneDot tone={a.tone} />
                  <span className="text-ab-fg-2 truncate flex-1">
                    <span className="text-ab-fg font-medium">{a.agent}</span>{" "}
                    {a.action}{" "}
                    <span className="text-ab-fg font-medium">{a.location}</span>
                  </span>
                  {a.campaign && (
                    <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-[4px] border border-ab-line text-[10px] text-ab-fg-2 mono whitespace-nowrap">
                      {a.campaign}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </SectionFrame>

          <SectionFrame>
            <header className="px-4 md:px-5 pt-4 md:pt-5 pb-2 flex items-center justify-between">
              <div>
                <span className="text-[13px] font-semibold text-ab-fg">Mål-tempo</span>
                <span className="text-ab-fg-3 text-[12px]"> · denne måneden</span>
              </div>
              <span className="ab-pill success">12 foran</span>
            </header>
            <div className="px-4 md:px-5 pb-4 md:pb-5 pt-2">
              <div className="flex items-baseline gap-2">
                <span className="mono text-[44px] md:text-[52px] leading-none font-semibold text-ab-fg">189</span>
                <span className="text-ab-fg-3 text-[14px]">/ 250</span>
              </div>
              <p className="text-[11px] text-ab-fg-3 mt-1">61 dører igjen denne måneden</p>

              {/* PACE bar */}
              <div className="mt-6">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-ab-fg-3 mb-1.5">
                  <span>Tempo</span>
                  <span className="mono text-ab-fg-2">{Math.round((189 / 250) * 100)} %</span>
                </div>
                <div className="relative h-1.5 rounded-full bg-ab-active overflow-visible">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-ab-accent" style={{ width: "75.6%" }} />
                  {/* expected pace marker (e.g. 67% if 20 of 30 days passed) */}
                  <div className="absolute -top-1 h-3.5 w-[2px] bg-ab-fg" style={{ left: "63%" }} title="Forventet tempo" />
                </div>
                <div className="flex items-center justify-between text-[10px] text-ab-fg-4 mt-2">
                  <span>0</span>
                  <span className="mono">forventet · 158</span>
                  <span className="mono">250</span>
                </div>
              </div>

              {/* mini stats */}
              <div className="mt-6 grid grid-cols-2 gap-3 pt-4 border-t border-ab-line-1">
                <div>
                  <div className="eyebrow">snitt / dag</div>
                  <div className="mono text-[18px] font-semibold text-ab-fg mt-0.5">9.5</div>
                </div>
                <div>
                  <div className="eyebrow">dager igjen</div>
                  <div className="mono text-[18px] font-semibold text-ab-fg mt-0.5">10</div>
                </div>
              </div>
            </div>
          </SectionFrame>
        </div>

        {/* ─────────────── Team-horisont heatmap ─────────────── */}
        <SectionFrame>
          <header className="px-4 md:px-5 pt-4 md:pt-5 pb-3 flex items-center justify-between">
            <div>
              <div className="eyebrow">TEAM-HORISONT · 60 DAGER × {teamHorizon.length} ANSATTE</div>
              <div className="text-[11px] text-ab-fg-3 mt-1">Mørkere = mer aktivitet</div>
            </div>
            <div className="flex items-center gap-1">
              <button className="ab-btn icon ghost"><Filter className="h-3.5 w-3.5" /></button>
              <button className="ab-btn icon ghost"><Maximize2 className="h-3.5 w-3.5" /></button>
            </div>
          </header>
          <div className="px-4 md:px-5 pb-4 md:pb-5">
            <div className="overflow-x-auto">
              <div className="flex flex-col gap-1 min-w-[640px]">
                {teamHorizon.map((row) => (
                  <div key={row.name} className="flex items-center gap-3">
                    <span className="text-[11.5px] text-ab-fg-2 w-[78px] shrink-0 truncate">{row.name}</span>
                    <div className="flex-1 grid grid-cols-60 gap-[2px]" style={{ gridTemplateColumns: "repeat(60, minmax(0, 1fr))" }}>
                      {row.days.map((v, i) => (
                        <div
                          key={i}
                          title={`Dag ${i + 1}: ${Math.round(v * 100)}`}
                          className="h-[14px] rounded-[2px] transition-colors"
                          style={{
                            backgroundColor:
                              v < 0.15
                                ? "rgba(0,0,0,0.35)"
                                : `color-mix(in srgb, var(--ab-accent-11) ${Math.round(v * 90)}%, var(--ab-bg-active))`,
                          }}
                        />
                      ))}
                    </div>
                    <span className="mono text-[11px] text-ab-fg-3 w-[44px] text-right">{row.jaPct.toFixed(1)} %</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionFrame>

        {/* ─────────────── Leaderboard + Consistency grid ─────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionFrame>
            <header className="px-4 md:px-5 pt-4 md:pt-5 pb-3 flex items-center justify-between">
              <div className="eyebrow">RANGERING · SALG DENNE UKEN</div>
              <button className="ab-btn icon ghost"><MoreHorizontal className="h-3.5 w-3.5" /></button>
            </header>
            <ul className="divide-y divide-ab-line-1">
              {leaderboard.map((r) => (
                <li key={r.rank} className="relative px-4 md:px-5 py-2.5 flex items-center gap-3 hover:bg-ab-hover/40 transition-colors">
                  {r.rank <= 3 && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5"
                      style={{ background: r.rank === 1 ? "#C8A24A" : r.rank === 2 ? "#B0B4BA" : "#B08A4A" }}
                    />
                  )}
                  <span className="mono text-[12px] text-ab-fg-3 w-4 text-right">{r.rank}</span>
                  <div className="relative">
                    <div className="h-8 w-8 rounded-full bg-ab-active border border-ab-line flex items-center justify-center text-[11px] font-semibold text-ab-fg-2">
                      {r.initials}
                    </div>
                    {r.online && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-ab-teal border-2 border-ab-elevated" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-ab-fg font-medium truncate">{r.name}</div>
                    <div className="text-[10.5px] text-ab-fg-3 truncate">{r.region}</div>
                  </div>
                  <div className="mono text-[15px] font-semibold text-ab-fg w-12 text-right">{r.score}</div>
                  <div className="hidden sm:block w-[88px] -mr-1">
                    <Sparkline data={r.spark} width={88} height={26} stroke="var(--ab-accent-11)" fill />
                  </div>
                </li>
              ))}
            </ul>
          </SectionFrame>

          <SectionFrame>
            <header className="px-4 md:px-5 pt-4 md:pt-5 pb-3 flex items-center justify-between">
              <div className="eyebrow">KONSISTENS · 26 UKER</div>
              <button className="ab-btn icon ghost"><MoreHorizontal className="h-3.5 w-3.5" /></button>
            </header>
            <div className="px-4 md:px-5 pb-4 md:pb-5">
              <div className="grid gap-1.5" style={{ gridTemplateColumns: "auto 1fr" }}>
                {["M", "T", "O", "T", "F"].map((dayLabel, dayIdx) => (
                  <React.Fragment key={dayLabel + dayIdx}>
                    <span className="text-[10px] text-ab-fg-3 mono w-3 leading-[14px]">{dayLabel}</span>
                    <div className="grid gap-[3px]" style={{ gridTemplateColumns: "repeat(26, minmax(0, 1fr))" }}>
                      {consistency26[dayIdx].map((v, w) => (
                        <div
                          key={w}
                          title={`Uke ${w + 1}: ${v}`}
                          className="aspect-square rounded-[2px]"
                          style={{
                            backgroundColor:
                              v === 0
                                ? "var(--ab-bg-active)"
                                : `color-mix(in srgb, var(--ab-accent-11) ${20 + v * 25}%, var(--ab-bg-active))`,
                          }}
                        />
                      ))}
                    </div>
                  </React.Fragment>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-end gap-2 text-[10px] text-ab-fg-3">
                <span>Mindre</span>
                {[0, 1, 2, 3].map((v) => (
                  <span
                    key={v}
                    className="h-3 w-3 rounded-[2px]"
                    style={{
                      backgroundColor:
                        v === 0
                          ? "var(--ab-bg-active)"
                          : `color-mix(in srgb, var(--ab-accent-11) ${20 + v * 25}%, var(--ab-bg-active))`,
                    }}
                  />
                ))}
                <span>Mer</span>
              </div>
            </div>
          </SectionFrame>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────────
// Small inline subcomponents
// ────────────────────────────────────────────────────────────────────────────────

function SectionFrame({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-ab-lg border border-ab-line bg-ab-elevated overflow-hidden">
      {children}
    </section>
  )
}

const periodOpts: Period[] = ["7d", "30d", "90d", "YTD"]

function PeriodTabs({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="inline-flex p-0.5 rounded-ab-md border border-ab-line bg-ab-base">
      {periodOpts.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={cn(
            "h-7 px-2.5 text-[11px] font-semibold tracking-wider uppercase rounded-[4px] transition-colors",
            value === p ? "bg-ab-hover text-ab-fg" : "text-ab-fg-3 hover:text-ab-fg",
          )}
        >
          {p}
        </button>
      ))}
    </div>
  )
}

function ToneDot({ tone }: { tone: ActivityRow["tone"] }) {
  const color =
    tone === "success" ? "var(--ab-success-fg)" :
    tone === "danger"  ? "var(--ab-danger-fg)"  :
    tone === "warn"    ? "var(--ab-warning-fg)" :
    tone === "info"    ? "var(--ab-accent-11)"  :
    "var(--ab-text-tertiary)"
  return <span className="inline-block h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
}
