"use client"

/**
 * /demo — role-picker landing for local demo runs (NEXT_PUBLIC_DEMO_MODE=true).
 * Only useful when the demo env var is set. On prod (env unset) this page
 * still renders but tells the user demo mode is off and links back to /login.
 */

import { motion } from "framer-motion"
import { Shield, User, ArrowRight, Sparkles } from "lucide-react"
import { demoAuth, type DemoRole } from "@/lib/auth/demoAuth"

interface RoleCard {
  role: DemoRole
  title: string
  subtitle: string
  personName: string
  destination: string
  color: string
  Icon: React.ElementType
  bullets: string[]
  isNew?: boolean
}

const ROLES: RoleCard[] = [
  {
    role: "admin",
    title: "Admin / Superuser",
    subtitle: "Hierarchical Salgssjefer view — new 2026-08-06",
    personName: "Lars Andersen",
    destination: "/dashbord",
    color: "#8B5CF6",
    Icon: Shield,
    isNew: true,
    bullets: [
      "SALGSSJEFER hierarchical grouping (chief → teams → promoters)",
      "MÅL MÅNED + MÅL UKE — org-wide aggregate",
      "Aggregate progress bar per chief",
      "LØNN + TOPPLISTER — global scope",
      "Live SANNTID widgets across the whole org",
    ],
  },
  {
    role: "chief",
    title: "Salgsleder / Teamleder",
    subtitle: "Boss's Image #3 — flat team list they own",
    personName: "Andreas Rikstad",
    destination: "/dashbord",
    color: "#F59E0B",
    Icon: Sparkles,
    isNew: true,
    bullets: [
      "MÅL MÅNED + MÅL UKE tiles",
      "Expandable TEAM cards (Oslo Nord / Sør / Vest)",
      "LØNN row with per-team Lederprovisjon breakdown",
      "TOPPLISTER (real leaderboard w/ Roy mascots)",
      "Live SANNTID widgets below (KPI + trend + campaigns)",
    ],
  },
  {
    role: "employee",
    title: "Promotør (sales rep)",
    subtitle: "Boss's Image #4 — the new view",
    personName: "Ida Solberg",
    destination: "/employee/dashbord",
    color: "#3461FF",
    Icon: User,
    isNew: true,
    bullets: [
      "Personal MÅL MÅNED + MÅL UKE",
      "LØNN row (Aktive givere / Sum vervinger / Estimert lønn)",
      "TOPPLISTER — see where you rank",
      "DIN DAG with GoalRing + streak + Registrer dør button",
    ],
  },
]

export default function DemoLanding() {
  const preview = (r: RoleCard) => {
    demoAuth.set(r.role)
    // Full-page navigation forces AuthContext to remount and pick up the
    // freshly-stored role from localStorage. router.push() would keep the
    // stale (null) user in memory → ProtectedRoute would kick us to /login.
    window.location.href = r.destination
  }

  if (!demoAuth.DEMO) {
    return (
      <div className="min-h-screen bg-ab-base flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-ab-line bg-ab-elevated p-8 text-center">
          <Shield className="h-10 w-10 text-ab-fg-3 mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-ab-fg">Demo mode is off</h1>
          <p className="mt-2 text-sm text-ab-fg-3">
            Set <code className="rounded bg-ab-hover px-1 py-0.5 text-xs">NEXT_PUBLIC_DEMO_MODE=true</code> in <code className="rounded bg-ab-hover px-1 py-0.5 text-xs">.env.local</code> and restart <code className="rounded bg-ab-hover px-1 py-0.5 text-xs">npm run dev</code>.
          </p>
          <a href="/login" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-ab-accent hover:underline">
            Go to normal login <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ab-base relative overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-amber-500/8 blur-3xl" />
        <div className="absolute top-1/2 -right-32 h-80 w-80 rounded-full bg-blue-600/8 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-purple-600/6 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-12 sm:py-16">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-ab-fg-3">
            AB Maps · Local preview
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-ab-fg">
            Velg en rolle for å se dashboardet
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-ab-fg-3">
            Dette er et lokal preview av det nye Salgsleder-/Teamleder- og Promotør-dashboardet.
            Ingen backend nødvendig — data er dummy for demoen. På produksjon vil ekte data vises.
          </p>
        </motion.div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {ROLES.map((r, i) => (
            <motion.button
              key={r.role}
              type="button"
              onClick={() => preview(r)}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              className="group relative text-left overflow-hidden rounded-2xl border border-ab-line bg-ab-elevated p-6 transition-all duration-200 hover:border-ab-line-2"
              style={{ boxShadow: "0 8px 24px -12px rgba(0,0,0,0.4)" } as React.CSSProperties}
            >
              {/* Accent bar */}
              <div
                className="absolute inset-x-0 top-0 h-[3px]"
                style={{ background: `linear-gradient(90deg, transparent, ${r.color}, transparent)` }}
              />

              <div className="flex items-start justify-between gap-3 mb-4">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ background: `${r.color}18`, color: r.color, boxShadow: `0 6px 20px -8px ${r.color}88` }}
                >
                  <r.Icon className="h-5 w-5" />
                </div>
                {r.isNew ? (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                    Ny visning
                  </span>
                ) : (
                  <span className="rounded-full bg-ab-hover px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ab-fg-3">
                    Uendret
                  </span>
                )}
              </div>

              <h2 className="text-lg font-bold text-ab-fg">{r.title}</h2>
              <p className="mt-0.5 text-xs text-ab-fg-3">{r.subtitle}</p>
              <p className="mt-1 text-[11px] text-ab-fg-4">Logger inn som «{r.personName}»</p>

              <ul className="mt-4 space-y-1.5">
                {r.bullets.map((b, j) => (
                  <li key={j} className="flex items-start gap-2 text-[12px] text-ab-fg-2">
                    <span
                      className="mt-1 h-1 w-1 shrink-0 rounded-full"
                      style={{ background: r.color }}
                    />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5 flex items-center justify-between">
                <span className="text-[11px] font-mono text-ab-fg-3">{r.destination}</span>
                <span
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition-transform group-hover:translate-x-0.5"
                  style={{ background: r.color }}
                >
                  Åpne <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </motion.button>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="mt-8 rounded-2xl border border-ab-line-1 bg-ab-elevated/40 p-4"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ab-fg-3">
            Ting å vite om denne demoen
          </p>
          <ul className="mt-2 space-y-1 text-xs text-ab-fg-2">
            <li>· Ingen ekte backend kjører — alt du ser er dummy data.</li>
            <li>· «Registrer dør» knappen i Promotør-visningen åpner modalen; POST-en vil feile fordi backend ikke er der. Modalen er der for å vise UX.</li>
            <li>· Bytt rolle når som helst — kom tilbake til <code className="rounded bg-ab-hover px-1 py-0.5">/demo</code>.</li>
            <li>· Ingen ekte innlogging — passord/token er hoppet over i demo-modus.</li>
          </ul>
        </motion.div>
      </div>
    </div>
  )
}
