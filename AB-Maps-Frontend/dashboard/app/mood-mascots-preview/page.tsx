"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { FlaskConical, Database, Cpu, Sparkles, Check } from "lucide-react";
import ClientLayout from "../ClientLayout";
import { ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { PageHeader } from "@/components/ui-ab";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { MoodMascot } from "@/components/gamification/MoodMascot";
import { MoodMascotCard } from "@/components/gamification/MoodMascotCard";
import {
  ALL_MOODS,
  FALLBACK_MOOD,
  computeMood,
  getMoodMeta,
  type Mood,
} from "@/components/gamification/lib/mood";

// Global threshold values for the preview — matches production Terskler defaults.
// TODO(backend): when this rolls out, source these from analyticsService.getThresholds().
const MIN_JA_PROSENT = 3.0;
const MIN_DORER_PER_DAG = 70;

// Seeded names for the demo team — designed to produce varied moods via the rules.
const DEMO_TEAM: Array<{
  name: string;
  dorerPerDag: number;
  jaProsent: number;
  rankPercentile?: number;
  daysOnPlatform?: number;
  rank?: number;
}> = [
  { name: "Ribaz Izadi",            dorerPerDag: 88,   jaProsent: 12.4, rankPercentile: 2,  rank: 1 },
  { name: "Amyar Allahwaisy",       dorerPerDag: 91.9, jaProsent: 8.0,  rankPercentile: 5,  rank: 2 },
  { name: "Hossein Lalak",          dorerPerDag: 96.4, jaProsent: 3.4,  rank: 3 },
  { name: "Axel Ange Dossou Gouin", dorerPerDag: 87.6, jaProsent: 5.4,  rank: 4 },
  { name: "Kareem Kelkoul",         dorerPerDag: 77.4, jaProsent: 3.4,  rank: 5 },
  { name: "Nadeem Rana Kristiansen",dorerPerDag: 99.9, jaProsent: 2.1,  rankPercentile: 5, rank: 6 },
  { name: "Tobias Doksæter",        dorerPerDag: 50,   jaProsent: 1.0,  rank: 7 },
  { name: "Frida Halvorsen",        dorerPerDag: 65,   jaProsent: 4.0,  daysOnPlatform: 4, rank: 8 },
  { name: "Sigid Evjen",            dorerPerDag: 12,   jaProsent: 0.0,  rank: 9 },
];

// Demo seeds for the mood gallery — each mood gets a different mascot face so
// the demo feels varied. Use deterministic strings.
const MOOD_SEEDS: Record<Mood, string> = {
  "on-fire": "demo-fire",
  "on-track": "demo-ontrack",
  "working-hard": "demo-working",
  "needs-attention": "demo-attention",
  new: "demo-new",
};

export default function MoodMascotsPreviewPage() {
  const reduce = useReducedMotion();

  return (
    <ProtectedRoute>
      <ClientLayout>
        <div className="relative flex flex-col min-h-screen bg-ab-base bg-page-glow">
          {/* Atmosphere — matches Statistikk / Rapport / Områder / Kampanjer */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-dot-grid opacity-[0.035] dark:opacity-[0.06]"
            style={{
              maskImage: "linear-gradient(to bottom, black, transparent 70%)",
              WebkitMaskImage:
                "linear-gradient(to bottom, black, transparent 70%)",
            }}
          />

          <div className="relative z-10 flex flex-col flex-1 min-h-screen">
            <PageHeader
              eyebrow="POC · GAMIFICATION"
              title="Mood-maskoter"
              description="Forhåndsvisning av maskotsystemet. Hver ansatt får en personlig maskot som endrer humør basert på dagens ytelse. Dette er en isolert demo — ingen andre sider er endret."
              action={
                <Badge
                  variant="outline"
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border-ab-warning/30 bg-ab-warning/10 text-ab-warning text-[11px] font-medium uppercase tracking-wider"
                >
                  <FlaskConical className="h-3 w-3" />
                  Kun forhåndsvisning
                </Badge>
              }
            />

            <motion.div
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto max-w-7xl px-6 pt-2 pb-12 w-full"
            >
              {/* ───────── Section 1 — All 4 moods ───────── */}
              <Section
                title="Alle 4 humør"
                subtitle="Komplett oversikt over hvordan maskotene reagerer på ytelsesdata. Fire enkle tilstander — én tilstand per handling."
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {ALL_MOODS.map((m, idx) => {
                    const meta = getMoodMeta(m);
                    return (
                      <motion.div
                        key={m}
                        initial={reduce ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.22,
                          delay: idx * 0.04,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        className="bg-ab-elevated border border-ab-line rounded-xl p-5 flex flex-col items-center text-center"
                      >
                        <MoodMascot
                          seed={MOOD_SEEDS[m]}
                          mood={meta}
                          size="lg"
                          showMoodIndicator
                        />
                        <div className="mt-4 text-[14px] font-semibold text-ab-fg">
                          {meta.label}
                        </div>
                        <p className="mt-1 text-[12px] text-ab-fg-3 leading-snug">
                          {meta.description}
                        </p>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Fallback tile — shown separately so it doesn't compete
                    with the 4 main moods. */}
                <div className="mt-4 bg-ab-subtle/40 border border-dashed border-ab-line-1 rounded-xl p-5 flex items-center gap-5">
                  <MoodMascot
                    seed={MOOD_SEEDS[FALLBACK_MOOD]}
                    mood={getMoodMeta(FALLBACK_MOOD)}
                    size="lg"
                    showMoodIndicator
                  />
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-ab-fg-3 font-semibold">
                      RESERVE-TILSTAND
                    </div>
                    <div className="mt-1 text-[14px] font-semibold text-ab-fg">
                      {getMoodMeta(FALLBACK_MOOD).label}
                    </div>
                    <p className="mt-1 text-[12px] text-ab-fg-2 leading-relaxed max-w-md">
                      Vises for ansatte med færre enn 7 dager på plattformen,
                      eller når ytelsesdata mangler. Kommer aldri i ranking
                      eller varsler.
                    </p>
                  </div>
                </div>
              </Section>

              {/* ───────── Section 2 — Example team ───────── */}
              <Section
                title="Eksempelteam"
                subtitle="Slik vil Ansattranking se ut med maskoter."
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {DEMO_TEAM.map((m, idx) => {
                    const mood = computeMood({
                      jaProsent: m.jaProsent,
                      dorerPerDag: m.dorerPerDag,
                      minJaProsent: MIN_JA_PROSENT,
                      minDorerPerDag: MIN_DORER_PER_DAG,
                      rankPercentile: m.rankPercentile,
                      daysOnPlatform: m.daysOnPlatform,
                    });
                    return (
                      <motion.div
                        key={m.name}
                        initial={reduce ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.22,
                          delay: idx * 0.04,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                      >
                        <MoodMascotCard
                          name={m.name}
                          seed={m.name}
                          mood={mood}
                          stats={{
                            dorerPerDag: m.dorerPerDag,
                            jaProsent: m.jaProsent,
                            minJaProsent: MIN_JA_PROSENT,
                            minDorerPerDag: MIN_DORER_PER_DAG,
                          }}
                          rank={m.rank}
                        />
                      </motion.div>
                    );
                  })}
                </div>
              </Section>

              {/* ───────── Section 3 — How it works ───────── */}
              <Section
                title="Slik fungerer det"
                subtitle="Humør beregnes automatisk fra eksisterende ytelsesdata — ingen ekstra backend-arbeid."
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <HowItWorksCard
                    icon={Database}
                    title="Eksisterende data"
                    description="Bruker dører/dag, ja %, terskel og rangering som allerede finnes i API-et."
                    tint="accent"
                  />
                  <HowItWorksCard
                    icon={Cpu}
                    title="Beregnet i sanntid"
                    description="Humør bestemmes klientside — oppdateres automatisk når data endres."
                    tint="success"
                  />
                  <HowItWorksCard
                    icon={Sparkles}
                    title="Personlig maskot"
                    description="Hver ansatt får en unik DiceBear-maskot generert fra ID-en sin."
                    tint="purple"
                  />
                </div>
              </Section>

              {/* ───────── Section 4 — Rollout plan ───────── */}
              <Section
                title="Neste steg — utrulling"
                subtitle="Hvor maskotene vil vises når godkjent."
              >
                <div className="bg-ab-elevated border border-ab-line rounded-xl divide-y divide-ab-line-1 overflow-hidden">
                  {[
                    {
                      page: "Ytelse-fanen i Analytikkdashbord",
                      detail: "Erstatter avatarer i Ansattranking-tabellen.",
                    },
                    {
                      page: "Statistikk",
                      detail:
                        "Mini-maskot ved siden av ansatt-navn på hver salgsrad.",
                    },
                    {
                      page: "Rapport",
                      detail: "Maskot i rangering og detaljvisning.",
                    },
                    {
                      page: "Områder",
                      detail: "Maskotene i arbeidsbelastnings-docken.",
                    },
                    {
                      page: "Admin Dashboard",
                      detail: "Maskot i stedet for initialer.",
                    },
                  ].map((row) => (
                    <div
                      key={row.page}
                      className="flex items-start gap-3 px-5 py-3.5 hover:bg-ab-subtle/40 transition-colors"
                    >
                      <span className="h-5 w-5 rounded-full inline-flex items-center justify-center bg-ab-success/15 text-ab-success shrink-0 mt-0.5">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      <div className="min-w-0">
                        <div className="text-[14px] font-semibold text-ab-fg">
                          {row.page}
                        </div>
                        <div className="text-[12px] text-ab-fg-3 mt-0.5">
                          {row.detail}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[12px] text-ab-fg-3">
                  Denne forhåndsvisningen påvirker ikke andre sider. Når godkjent
                  — én prompt for å rulle ut overalt.
                </p>
              </Section>
            </motion.div>
          </div>
        </div>
      </ClientLayout>
    </ProtectedRoute>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 first:mt-6">
      <div className="mb-4">
        <h2 className="text-[18px] font-semibold tracking-tight text-ab-fg">
          {title}
        </h2>
        <p className="text-[12px] text-ab-fg-3 mt-1">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function HowItWorksCard({
  icon: Icon,
  title,
  description,
  tint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  tint: "accent" | "success" | "purple";
}) {
  const tintMap: Record<typeof tint, string> = {
    accent: "bg-ab-accent/10 text-ab-accent",
    success: "bg-ab-success/10 text-ab-success",
    purple: "bg-purple-500/10 text-purple-600 dark:text-purple-300",
  };
  return (
    <div className="bg-ab-elevated border border-ab-line rounded-xl p-5 hover:border-ab-line-2 transition-colors duration-180">
      <span
        className={cn(
          "h-10 w-10 rounded-lg inline-flex items-center justify-center",
          tintMap[tint],
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="mt-4 text-[15px] font-semibold text-ab-fg">{title}</div>
      <p className="mt-1 text-[12px] text-ab-fg-2 leading-relaxed">
        {description}
      </p>
    </div>
  );
}
