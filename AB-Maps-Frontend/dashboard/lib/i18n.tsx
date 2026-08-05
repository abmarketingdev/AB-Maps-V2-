"use client"

/**
 * Norwegian → English i18n for the new leader dashboards.
 * NORSK is the source-of-truth string (what the boss sees by default);
 * ENGLISH is a mapping so the developer (or anyone who doesn't read Norwegian)
 * can flip and understand. Language choice persists in localStorage.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

export type Lang = "no" | "en"

// NORSK → ENGLISH map. Missing keys fall back to the Norwegian source.
const DICT: Record<string, string> = {
  // Greetings + role chips
  "God morgen": "Good morning",
  "God dag": "Good afternoon",
  "God kveld": "Good evening",
  "Promotør": "Promoter",
  "Salgsleder / Teamleder": "Sales lead / Team lead",
  "La oss knuse dagen sammen": "Let's crush the day together",
  "Registrer dør": "Register door",

  // Section labels
  "Mål måned": "Month goals",
  "Mål uke": "Week goals",
  "Din dag": "Your day",
  "Sanntid": "Real-time",
  "Team": "Teams",
  "Lønn": "Salary",
  "Topplister": "Leaderboards",

  // Tile labels
  "Dører banket": "Doors knocked",
  "Antall givere": "Donors",
  "Givere team": "Team donors",
  "Antall givere team": "Team donors",
  "Givere prosjekt": "Project donors",
  "Antall givere prosjekt": "Project donors",
  "Snitt / dag": "Avg / day",
  "Snitt / team": "Avg / team",
  "I dag": "Today",
  "Team i dag": "Team today",

  // Tile helper text
  "Månedens ryggrad — hver dør teller": "The month's backbone — every door counts",
  "Sum for alle": "Total across all",
  "teamene — månedens hovedmål": "teams — the main goal of the month",
  "dører": "doors",
  "givere": "donors",
  "igjen": "remaining",

  // Din dag / Sanntid
  "Sanntid — oppdateres hvert 20. sekund": "Real-time — refreshed every 20 seconds",
  "Live tall og trend for hele teamet ditt": "Live numbers and trends across your whole team",
  "Klikk et team for å se promotørene bak tallene": "Click a team to see the promoters behind the numbers",
  "Klikk Sum vervinger eller Lederprovisjon for team-fordeling": "Click Sum recruitments or Leader commission for team breakdown",
  "Live": "Live",

  // Header pill
  "team": "teams",
  "promotører": "promoters",

  // TeamPanel
  "Leder": "Lead",
  "Dører": "Doors",
  "Rekrutt.": "Recr.",
  "Aktive": "Active",
  "Vervinger": "Earnings",
  "Rekruttert": "Recruited",
  "Team totalt": "Team total",

  // Lønn tiles + expandable breakdown
  "Aktive givere": "Active donors",
  "Sum vervinger": "Total recruitments",
  "Lederprovisjon": "Leader commission",
  "Estimert lønn": "Estimated salary",
  "Per team": "Per team",
  "ved oppnåelse av mål": "when goal is reached",
  "kr": "kr",

  // Topplister columns
  "Antall dører banket": "Doors knocked",
  "Beste selgere denne perioden": "Top sellers this period",
  "Rekrutterte givere": "Recruited donors",
  "Flest nye givere": "Most new donors",
  "Aktive givere (%)": "Active donors (%)",
  "Høyest aktivitetsandel": "Highest activity ratio",
  // New Phase-4 labels (col 3 relabelled from "Aktive givere %" to "Mest konsistent"
  // because backend supports `consistency` metric but not a true active_percent).
  "Mest konsistent": "Most consistent",
  "Høyest aktivitet daglig": "Highest daily activity",

  // Embedded promoter widgets
  "Registrer en dør nå": "Register a door now",
  "Ja / Nei / Ikke hjemme / Følg opp — samme som før": "Yes / No / Not home / Follow up — same as before",
  "Laster dagen din …": "Loading your day …",
  "Kunne ikke laste dagsdata (backend forsøkt kontaktet). Registrer-knapp fortsatt tilgjengelig via dør-appen.":
    "Could not load today's data (backend was contacted). Register button still available via the door app.",
  "Du knuser det i dag!": "You're crushing it today!",
  "Du ligger foran ditt eget snitt.": "You're ahead of your own average.",
  "Hold tempoet — du nærmer deg.": "Keep the pace — you're closing in.",
  "ja-rate i dag": "yes-rate today",
  "pp vs ditt snitt": "pp vs your average",
  "Du er": "You are",
  "dører foran": "doors ahead",
  "dører bak": "doors behind",
  "ditt 7-dagers snitt på": "your 7-day average of",
}

interface LangCtx { lang: Lang; setLang: (l: Lang) => void; t: (no: string) => string }
const Ctx = createContext<LangCtx>({ lang: "no", setLang: () => {}, t: (s) => s })

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("no")
  useEffect(() => {
    try {
      const saved = localStorage.getItem("abmaps-lang") as Lang | null
      if (saved === "no" || saved === "en") setLangState(saved)
    } catch {}
  }, [])
  const setLang = (l: Lang) => {
    setLangState(l)
    try { localStorage.setItem("abmaps-lang", l) } catch {}
  }
  const t = (no: string) => lang === "no" ? no : (DICT[no] ?? no)
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>
}

export function useLang() {
  return useContext(Ctx)
}

/** Floating NO/EN toggle pill — fixed top-right on any page it's placed. */
export function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang } = useLang()
  return (
    <div
      className={
        "fixed top-4 right-4 z-40 flex items-center rounded-full border border-ab-line bg-ab-elevated/85 backdrop-blur-md overflow-hidden shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] " +
        (className ?? "")
      }
    >
      <button
        onClick={() => setLang("no")}
        className={
          "px-3 h-8 text-[11px] font-semibold tracking-wider transition-colors " +
          (lang === "no" ? "bg-ab-accent text-white" : "text-ab-fg-3 hover:text-ab-fg")
        }
        aria-pressed={lang === "no"}
      >NO</button>
      <button
        onClick={() => setLang("en")}
        className={
          "px-3 h-8 text-[11px] font-semibold tracking-wider transition-colors " +
          (lang === "en" ? "bg-ab-accent text-white" : "text-ab-fg-3 hover:text-ab-fg")
        }
        aria-pressed={lang === "en"}
      >EN</button>
    </div>
  )
}
