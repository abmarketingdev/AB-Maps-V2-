"use client"

/**
 * Employee Stats Dashboard — STRUCTURAL REBUILD (2026-05-17)
 *
 * Replaces the previous 4-equal-KPI / line-chart-+-donut / two-column-lists
 * layout with a bento + asymmetric chart + Uken-på-et-blikk + Personlig-innsikt
 * structure. All data is sourced from the existing useNewDashboardData hook —
 * no new endpoints, no new backend fields. Reads:
 *   - stats.summary.{total_responses, days_in_range, avg_per_day}
 *   - stats.status_counts.{ja, nei, ikke_hjemme, folg_opp}
 *   - stats.calculated_metrics.hit_rate
 *   - trends.trends.{ja, nei, ikke_hjemme, folg_opp}[{date, count}]
 *   - trends.date_range.{start, end, periods}
 *   - followUps.results[]
 *   - activities.results[]
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth/AuthContext';
import { useTheme } from 'next-themes';
import { useReducedMotion } from 'framer-motion';
import {
  Home,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  MapPin,
  Clock,
  Sparkles,
  Trophy,
  BarChart3,
  TrendingUp,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { useNewDashboardData } from '@/hooks/useNewDashboardData';
import { fetchAssignedCampaignsForEmployee, Campaign } from '@/services/campaignService';
import type {
  DashboardFilters as DashboardFiltersType,
  DashboardTrendDataPoint,
} from '@/types/dashboard';
import { MoodMascot } from '@/components/gamification/MoodMascot';
import { computeMood, type Mood } from '@/components/gamification/lib/mood';
import { cn } from '@/lib/utils';

// Thresholds mirror the dashboard hero (production Terskler defaults).
const STATS_MIN_JA_PROSENT = 3.0;
const STATS_MIN_DORER_PER_DAG = 70;

// Mood-driven headlines for the hero strip.
const HERO_HEADLINE: Record<Mood, string> = {
  'on-fire': 'Du brenner denne uken 🔥',
  'on-track': 'Du holder målene. Solid jobb.',
  'working-hard': 'Mye banking — ja-en kommer.',
  'needs-attention': 'La oss snu denne uken sammen.',
  new: 'Velkommen om bord!',
};

// Brighter palette tuned for hero zone — matches the dashboard rebuild.
// working-hard → sky/cyan so it doesn't read as melancholy blue.
const MOOD_HEX: Record<Mood, string> = {
  'on-fire': '#fbbf24',
  'on-track': '#34d399',
  'working-hard': '#38bdf8',
  'needs-attention': '#fb7185',
  new: '#f472b6',
};

const NB_WEEKDAY_SHORT = ['SØN', 'MAN', 'TIR', 'ONS', 'TOR', 'FRE', 'LØR'];
const NB_WEEKDAY_LONG = [
  'søndag',
  'mandag',
  'tirsdag',
  'onsdag',
  'torsdag',
  'fredag',
  'lørdag',
];

// Status display palette for the area chart legend + bottom list left-borders.
const STATUS_COLOR = {
  ja: '#10b981', // emerald-500
  folg_opp: '#3b82f6', // blue-500
  ikke_hjemme: '#f59e0b', // amber-500
  nei: '#f43f5e', // rose-500
} as const;

const STATUS_LABEL_NB: Record<string, string> = {
  ja: 'Ja',
  nei: 'Nei',
  ikke_hjemme: 'Ikke hjemme',
  folg_opp: 'Følg opp',
};

interface UkenDay {
  date: Date;
  iso: string;
  weekdayShort: string;
  weekdayLong: string;
  ja: number;
  nei: number;
  ikkeHjemme: number;
  folgOpp: number;
  total: number;
  jaPct: number;
  isToday: boolean;
}

// Map ISO date → counts using the trends arrays so the 7-day grid + best-day
// tile share a single source of truth.
function indexTrendsByDate(
  series: DashboardTrendDataPoint[] | undefined,
): Map<string, number> {
  const m = new Map<string, number>();
  if (!series) return m;
  for (const p of series) m.set(p.date.slice(0, 10), p.count);
  return m;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function nbDateShort(d: Date): string {
  return d.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit' });
}

function nbDateMedium(d: Date): string {
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
}

export default function EmployeeStatsDashboard() {
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const prefersReducedMotion = useReducedMotion();
  const isDark = resolvedTheme === 'dark';
  const [assignedCampaigns, setAssignedCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [campaignsError, setCampaignsError] = useState<string | null>(null);
  const {
    stats,
    trends,
    followUps,
    activities,
    loading,
    error,
    filters,
    updateFilters,
    refreshData,
  } = useNewDashboardData();

  useEffect(() => {
    const fetchCampaigns = async () => {
      if (!user?.user_info?.id) {
        setCampaignsLoading(false);
        return;
      }
      setCampaignsLoading(true);
      setCampaignsError(null);
      try {
        const campaigns = await fetchAssignedCampaignsForEmployee(user.user_info.id);
        setAssignedCampaigns(campaigns);
      } catch (err) {
        console.error('Failed to fetch assigned campaigns:', err);
        setCampaignsError(err instanceof Error ? err.message : 'Failed to load campaigns');
      } finally {
        setCampaignsLoading(false);
      }
    };
    fetchCampaigns();
  }, [user?.user_info?.id]);

  const handleFiltersChange = (newFilters: DashboardFiltersType) => {
    updateFilters(newFilters);
  };

  // ── Derived data ──────────────────────────────────────────────────
  const derived = useMemo(() => {
    const totalResponses = stats?.summary?.total_responses ?? 0;
    const jaCount = stats?.status_counts?.ja ?? 0;
    const neiCount = stats?.status_counts?.nei ?? 0;
    const ikkeHjemmeCount = stats?.status_counts?.ikke_hjemme ?? 0;
    const folgOppCount = stats?.status_counts?.folg_opp ?? 0;
    const hitRate =
      stats?.calculated_metrics?.hit_rate ??
      (totalResponses > 0 ? (jaCount / totalResponses) * 100 : 0);
    const avgPerDay = stats?.summary?.avg_per_day ?? 0;
    const daysInRange = stats?.summary?.days_in_range ?? 0;

    // Index daily counts per status for both the area chart + the
    // 7-day grid + best-day computation.
    const jaByDate = indexTrendsByDate(trends?.trends?.ja);
    const neiByDate = indexTrendsByDate(trends?.trends?.nei);
    const ikkeByDate = indexTrendsByDate(trends?.trends?.ikke_hjemme);
    const folgByDate = indexTrendsByDate(trends?.trends?.folg_opp);

    // Build full daily series spanning trends.date_range.start..end.
    const series: Array<{
      date: string;
      label: string;
      ja: number;
      folg_opp: number;
      ikke_hjemme: number;
      nei: number;
      total: number;
    }> = [];
    if (trends?.date_range?.start && trends?.date_range?.end) {
      const start = new Date(trends.date_range.start);
      const end = new Date(trends.date_range.end);
      const cur = startOfDay(start);
      const last = startOfDay(end);
      while (cur.getTime() <= last.getTime()) {
        const iso = isoDay(cur);
        const ja = jaByDate.get(iso) ?? 0;
        const folg = folgByDate.get(iso) ?? 0;
        const ikke = ikkeByDate.get(iso) ?? 0;
        const nei = neiByDate.get(iso) ?? 0;
        series.push({
          date: iso,
          label: nbDateShort(cur),
          ja,
          folg_opp: folg,
          ikke_hjemme: ikke,
          nei,
          total: ja + folg + ikke + nei,
        });
        cur.setDate(cur.getDate() + 1);
      }
    }

    // Sparkline: last 14 days total per day. Falls back to full series
    // if shorter than 14.
    const sparkData = series.slice(-14).map((d) => d.total);

    // Best day: max daily total.
    let bestDayCount = 0;
    let bestDayDate: Date | null = null;
    let bestDayWeekday = '';
    let bestDayWeekdayCounts: Record<number, { sum: number; n: number }> = {};
    for (const d of series) {
      if (d.total > bestDayCount) {
        bestDayCount = d.total;
        bestDayDate = new Date(d.date);
      }
      const wd = new Date(d.date).getDay();
      if (!bestDayWeekdayCounts[wd]) bestDayWeekdayCounts[wd] = { sum: 0, n: 0 };
      bestDayWeekdayCounts[wd].sum += d.total;
      bestDayWeekdayCounts[wd].n += 1;
    }
    // Best weekday pattern — average per day-of-week (ignores zero days
    // so a partial week doesn't drag down the average).
    let bestWeekdayAvg = 0;
    let bestWeekdayIdx = -1;
    for (const [wd, info] of Object.entries(bestDayWeekdayCounts)) {
      if (info.n === 0) continue;
      const avg = info.sum / info.n;
      if (avg > bestWeekdayAvg) {
        bestWeekdayAvg = avg;
        bestWeekdayIdx = Number(wd);
      }
    }
    if (bestDayDate) bestDayWeekday = NB_WEEKDAY_LONG[bestDayDate.getDay()];

    // "Uken på et blikk" — Monday through Sunday of the current week.
    const today = startOfDay(new Date());
    const dow = today.getDay(); // 0=Sun, 1=Mon
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(today);
    monday.setDate(monday.getDate() + mondayOffset);
    const uken: UkenDay[] = [];
    let ukenBestIdx = -1;
    let ukenBestTotal = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      const iso = isoDay(d);
      const ja = jaByDate.get(iso) ?? 0;
      const folg = folgByDate.get(iso) ?? 0;
      const ikke = ikkeByDate.get(iso) ?? 0;
      const nei = neiByDate.get(iso) ?? 0;
      const total = ja + folg + ikke + nei;
      const jaPct = total > 0 ? (ja / total) * 100 : 0;
      uken.push({
        date: d,
        iso,
        weekdayShort: NB_WEEKDAY_SHORT[d.getDay()],
        weekdayLong: NB_WEEKDAY_LONG[d.getDay()],
        ja,
        nei,
        ikkeHjemme: ikke,
        folgOpp: folg,
        total,
        jaPct,
        isToday: iso === isoDay(today),
      });
      if (total > ukenBestTotal) {
        ukenBestTotal = total;
        ukenBestIdx = i;
      }
    }

    const moodOutput = computeMood({
      jaProsent: hitRate,
      dorerPerDag: avgPerDay,
      minJaProsent: STATS_MIN_JA_PROSENT,
      minDorerPerDag: STATS_MIN_DORER_PER_DAG,
      daysOnPlatform: totalResponses > 0 ? 999 : 0,
    });

    return {
      totalResponses,
      jaCount,
      neiCount,
      ikkeHjemmeCount,
      folgOppCount,
      hitRate,
      avgPerDay,
      daysInRange,
      series,
      sparkData,
      bestDayCount,
      bestDayDate,
      bestDayWeekday,
      bestWeekdayAvg,
      bestWeekdayIdx,
      uken,
      ukenBestIdx,
      moodOutput,
    };
  }, [stats, trends]);

  // ── Empty state: no campaigns assigned ────────────────────────────
  if (!campaignsLoading && assignedCampaigns.length === 0 && !campaignsError) {
    return (
      <div className="flex-1 space-y-3 sm:space-y-4 p-3 md:p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-2 sm:space-y-4 lg:space-y-0">
          <div className="flex-1 min-w-0">
            <nav className="flex items-center space-x-1 text-xs sm:text-sm text-muted-foreground mb-2" aria-label="Breadcrumb">
              <Link
                href="/employee"
                className="hover:text-foreground transition-colors flex items-center gap-1 min-h-[44px] px-2 -ml-2 touch-manipulation"
              >
                <Home className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
              <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="text-foreground font-medium truncate">Min statistikk</span>
            </nav>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
              Min statistikk
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-1">
              Velkommen tilbake! Her får du en oversikt over din ytelse og aktivitet.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-ab-line bg-ab-subtle/40 px-6 py-16 text-center">
          <div className="flex flex-col items-center justify-center space-y-3 sm:space-y-4">
            <AlertCircle className="h-10 w-10 text-muted-foreground" strokeWidth={1.25} />
            <div className="space-y-2 px-2">
              <h3 className="text-base sm:text-lg font-semibold text-foreground">Ingen kampanjer tildelt</h3>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
                Du har ingen kampanjer tildelt ennå. Kontakt din leder for å få tildelt kampanjer og begynn å se din statistikk.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Mood / hero context ───────────────────────────────────────────
  const mood: Mood = derived.moodOutput.mood;
  const headline = HERO_HEADLINE[mood];
  const moodHex = MOOD_HEX[mood];
  const firstName = user?.user_info?.name?.split(' ')[0] || 'der';
  const seed = user?.user_info?.id || user?.user_info?.name || firstName;

  // Hero subtitle — concrete numbers, no fabrication.
  const heroPct = derived.totalResponses > 0 ? derived.hitRate.toFixed(1) : '0';
  const heroSubtitle =
    derived.totalResponses > 0
      ? `${derived.jaCount} ja av ${derived.totalResponses} pitcher denne perioden. Det er en treffrate på ${heroPct}%.`
      : 'Ingen pitcher registrert i valgt periode ennå.';

  // Period text for the overline.
  const periodText =
    derived.daysInRange > 0
      ? `Siste ${derived.daysInRange} dager`
      : trends?.date_range?.start && trends?.date_range?.end
      ? `${nbDateMedium(new Date(trends.date_range.start))} – ${nbDateMedium(new Date(trends.date_range.end))}`
      : 'Hele perioden';

  // Layered hero-tile gradient — same recipe as the dashboard rebuild.
  const a1 = isDark ? 0.33 : 0.22;
  const a2 = isDark ? 0.18 : 0.12;
  const a3 = isDark ? 0.12 : 0.08;
  const heroTileBg = `
    radial-gradient(circle at 70% 30%, ${moodHex}${Math.round(a1 * 255).toString(16).padStart(2, '0')}, transparent 60%),
    radial-gradient(circle at 20% 80%, ${moodHex}${Math.round(a2 * 255).toString(16).padStart(2, '0')}, transparent 50%),
    linear-gradient(135deg, ${moodHex}${Math.round(a3 * 255).toString(16).padStart(2, '0')} 0%, transparent 100%),
    var(--ab-bg-elevated)
  `;

  // Threshold-tinted color for the Ja-rate KPI.
  const hitRateColor =
    derived.hitRate >= STATS_MIN_JA_PROSENT * 1.5
      ? '#10b981'
      : derived.hitRate >= STATS_MIN_JA_PROSENT
      ? '#3b82f6'
      : '#f59e0b';

  // Personlig innsikt — pick the first truthy insight from a priority list.
  const insight: { title: string; body: string } = (() => {
    if (derived.bestWeekdayIdx >= 0 && derived.bestWeekdayAvg > 0) {
      return {
        title: 'Din mest produktive ukedag',
        body: `Dine beste dager er ${NB_WEEKDAY_LONG[derived.bestWeekdayIdx]} — gjennomsnitt ${derived.bestWeekdayAvg.toFixed(0)} dører.`,
      };
    }
    if (derived.totalResponses >= 100) {
      return {
        title: 'Milepæl',
        body: `Du har banket ${derived.totalResponses} dører totalt — det er nok til å fylle et helt nabolag!`,
      };
    }
    if (derived.bestDayCount > 0 && derived.bestDayDate) {
      return {
        title: 'Din beste dag',
        body: `Din beste dag var ${derived.bestDayWeekday} ${nbDateMedium(derived.bestDayDate)} med ${derived.bestDayCount} dører. Kan du slå den?`,
      };
    }
    return {
      title: 'En refleksjon',
      body: 'Hver dag du banker er en investering i fremtiden din.',
    };
  })();

  // Milestone pills — only render those with data.
  const milestonePills: Array<{ icon: string; label: string }> = [];
  if (derived.bestDayCount > 0) {
    milestonePills.push({ icon: '🏆', label: `Beste dag: ${derived.bestDayCount}` });
  }
  if (derived.totalResponses > 0) {
    milestonePills.push({ icon: '📈', label: `Totalt: ${derived.totalResponses} pitcher` });
  }
  if (derived.jaCount > 0) {
    milestonePills.push({ icon: '✅', label: `${derived.jaCount} ja` });
  }

  // Closing-rate SVG ring geometry.
  const ringR = 14;
  const ringCirc = 2 * Math.PI * ringR;
  const closingPct = Math.min(100, Math.max(0, derived.hitRate));
  const ringOffset = ringCirc * (1 - closingPct / 100);

  // Sparkline path (Recharts area, no grid/axes/legend).
  const sparkSeries = derived.sparkData.map((v, i) => ({ i, v }));

  return (
    <div className="flex-1 space-y-4 p-3 md:p-6 lg:p-8">
      {/* ───── STEP 2: HERO STRIP ─────────────────────────────────── */}
      <section
        className="relative overflow-hidden rounded-3xl border border-ab-line"
        style={{ background: heroTileBg, minHeight: 180 }}
      >
        {/* Subtle dotted-grid overlay for atmosphere. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'radial-gradient(currentColor 1px, transparent 1px)',
            backgroundSize: '16px 16px',
            color: 'var(--ab-fg)',
          }}
        />
        <div className="relative flex items-center gap-6 px-6 py-6">
          {/* Left zone: breadcrumb + 96px mascot */}
          <div className="shrink-0 flex flex-col items-start gap-3" style={{ minWidth: 120 }}>
            <nav className="flex items-center gap-1 text-[12px] text-muted-foreground" aria-label="Breadcrumb">
              <Link
                href="/employee"
                className="hover:text-foreground transition-colors inline-flex items-center gap-1"
              >
                <Home className="h-3.5 w-3.5" />
                <span>Dashboard</span>
              </Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-foreground font-medium">Min statistikk</span>
            </nav>
            <div className="flex flex-col items-center gap-1">
              <MoodMascot
                seed={seed}
                mood={derived.moodOutput}
                size="xl"
                showMoodIndicator
                showMoodLabel
                disablePulseGlow={mood === 'on-fire' && Boolean(prefersReducedMotion)}
              />
            </div>
          </div>

          {/* Center zone: title + subtitle + milestone pills */}
          <div className="min-w-0 flex-1 space-y-2">
            <p
              className="text-[11px] uppercase tracking-[0.12em] font-semibold"
              style={{ color: moodHex }}
            >
              MIN STATISTIKK · {periodText}
            </p>
            <h1 className="text-[28px] md:text-[32px] font-semibold tracking-tight text-foreground leading-tight">
              {headline}
            </h1>
            <p className="text-[14px] text-muted-foreground leading-relaxed max-w-2xl">
              Hei {firstName}. {heroSubtitle}
            </p>
            {milestonePills.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {milestonePills.map((p, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-full border border-ab-line/60 bg-ab-elevated/60 backdrop-blur-sm px-3 py-1 text-[12px] text-foreground tabular-nums"
                  >
                    <span aria-hidden>{p.icon}</span>
                    <span>{p.label}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Right zone: refresh */}
          <div className="hidden md:flex shrink-0 items-start">
            <button
              type="button"
              onClick={refreshData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-full border border-ab-line/60 bg-ab-elevated/60 backdrop-blur-sm px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground hover:border-ab-line transition disabled:opacity-50"
              aria-label="Oppdater"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Oppdater
            </button>
          </div>
        </div>
      </section>

      {/* Campaigns Error State */}
      {campaignsError && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Kunne ikke laste kampanjer: {campaignsError}
          </p>
        </div>
      )}

      {/* Filters Bar (existing component, kept) */}
      {!campaignsLoading && assignedCampaigns.length > 0 && (
        <DashboardFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onRefresh={refreshData}
          loading={loading}
          availableCampaigns={assignedCampaigns}
        />
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* ───── STEP 3: BENTO GRID (6-COL, MISMATCHED SPANS) ───────── */}
      {!campaignsLoading && assignedCampaigns.length > 0 && (
        <section
          className="grid gap-4"
          style={{
            gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
            gridAutoRows: '120px',
          }}
        >
          {/* Tile A — Totale pitcher (3×2, HERO TILE) */}
          <div
            className="relative overflow-hidden rounded-2xl p-6 flex flex-col"
            style={{
              gridColumn: 'span 3 / span 3',
              gridRow: 'span 2 / span 2',
              background: heroTileBg,
              boxShadow: `inset 0 0 0 1px ${moodHex}26, 0 0 0 1px ${moodHex}14`,
            }}
          >
            <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
              TOTALE PITCHER
            </div>
            <div className="mt-2 text-[72px] font-bold tabular-nums leading-none text-foreground">
              {derived.totalResponses}
            </div>
            {sparkSeries.length >= 2 && (
              <div className="mt-2 h-12">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparkSeries} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="sparkA" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={moodHex} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={moodHex} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="v"
                      stroke={moodHex}
                      strokeWidth={1.5}
                      fill="url(#sparkA)"
                      isAnimationActive={!prefersReducedMotion}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="mt-auto text-[11px] text-muted-foreground tabular-nums">
              {derived.daysInRange > 0 ? `${derived.daysInRange} dager i perioden` : 'Hele perioden'}
            </div>
          </div>

          {/* Tile B — Ja (2×1) */}
          <div
            className="relative rounded-2xl border border-ab-line bg-ab-elevated p-5 hover:border-ab-line-2 transition-colors duration-150"
            style={{ gridColumn: 'span 2 / span 2' }}
          >
            <div className="flex items-start justify-between">
              <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
                JA
              </div>
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-[36px] font-semibold tabular-nums leading-none text-foreground">
              {derived.jaCount}
            </div>
            <div
              className="mt-1 text-[12px] tabular-nums font-medium"
              style={{ color: hitRateColor }}
            >
              {derived.hitRate.toFixed(1)}% treffrate
            </div>
          </div>

          {/* Tile C — Closing rate (1×1) */}
          <div
            className="relative rounded-2xl border border-ab-line bg-ab-elevated p-4 flex flex-col"
            style={{ gridColumn: 'span 1 / span 1' }}
          >
            <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
              CLOSING
            </div>
            <div className="flex-1 flex items-center gap-3 mt-1">
              <div className="text-[24px] font-semibold tabular-nums leading-none text-foreground">
                {derived.hitRate.toFixed(0)}%
              </div>
              <svg width={36} height={36} viewBox="0 0 36 36" className="-mr-1">
                <circle
                  cx={18}
                  cy={18}
                  r={ringR}
                  fill="none"
                  stroke="var(--ab-line)"
                  strokeWidth={3}
                />
                <circle
                  cx={18}
                  cy={18}
                  r={ringR}
                  fill="none"
                  stroke={hitRateColor}
                  strokeWidth={3}
                  strokeDasharray={ringCirc}
                  strokeDashoffset={ringOffset}
                  strokeLinecap="round"
                  transform="rotate(-90 18 18)"
                  style={{ transition: prefersReducedMotion ? 'none' : 'stroke-dashoffset 600ms ease-out' }}
                />
              </svg>
            </div>
          </div>

          {/* Tile D — Snitt / dag (2×1) */}
          <div
            className="relative rounded-2xl border border-ab-line bg-ab-elevated p-5"
            style={{ gridColumn: 'span 2 / span 2' }}
          >
            <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
              SNITT / DAG
            </div>
            <div className="mt-2 text-[36px] font-semibold tabular-nums leading-none text-foreground">
              {derived.avgPerDay.toFixed(1)}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">
              {derived.daysInRange} dager
            </div>
          </div>

          {/* Tile E — Beste dag (1×1) */}
          <div
            className="relative rounded-2xl border border-ab-line bg-ab-elevated p-4 flex flex-col"
            style={{ gridColumn: 'span 1 / span 1' }}
          >
            <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
              BESTE DAG
            </div>
            <div className="mt-1 text-[32px] font-semibold tabular-nums leading-none text-foreground">
              {derived.bestDayCount || '—'}
            </div>
            <div className="mt-auto text-[11px] text-muted-foreground">
              {derived.bestDayDate ? nbDateMedium(derived.bestDayDate) : '—'}
            </div>
          </div>
        </section>
      )}

      {/* ───── STEP 4: CHARTS — STACKED AREA + DONUT (4+2) ────────── */}
      {!campaignsLoading && assignedCampaigns.length > 0 && (
        <section className="grid gap-4 md:grid-cols-6">
          <div className="md:col-span-4 rounded-2xl border border-ab-line bg-ab-elevated p-5 min-h-[280px] flex flex-col">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="text-[16px] font-semibold text-foreground">
                  Dører banket per dag
                </h3>
                <p className="text-[12px] text-muted-foreground">
                  Fargekodet etter resultat
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR.ja }} /> Ja
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR.folg_opp }} /> Følg opp
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR.ikke_hjemme }} /> Ikke hjemme
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR.nei }} /> Nei
                </span>
              </div>
            </div>
            <div className="flex-1 min-h-[200px] relative">
              {derived.series.length >= 2 && derived.series.some((d) => d.total > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={derived.series}
                    margin={{ top: 8, right: 8, bottom: 0, left: -10 }}
                  >
                    <defs>
                      {(['ja', 'folg_opp', 'ikke_hjemme', 'nei'] as const).map((k) => (
                        <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={STATUS_COLOR[k]} stopOpacity={0.5} />
                          <stop offset="100%" stopColor={STATUS_COLOR[k]} stopOpacity={0.05} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--ab-line)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      stroke="var(--ab-fg-3)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      stroke="var(--ab-fg-3)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={28}
                    />
                    <RTooltip
                      contentStyle={{
                        background: 'var(--ab-bg-elevated)',
                        border: '1px solid var(--ab-line)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: 'var(--ab-fg)', fontWeight: 600 }}
                      formatter={(value: number, name: string) => [
                        value,
                        STATUS_LABEL_NB[name] ?? name,
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="ja"
                      stackId="1"
                      stroke={STATUS_COLOR.ja}
                      fill="url(#grad-ja)"
                      strokeWidth={1.5}
                      isAnimationActive={!prefersReducedMotion}
                    />
                    <Area
                      type="monotone"
                      dataKey="folg_opp"
                      stackId="1"
                      stroke={STATUS_COLOR.folg_opp}
                      fill="url(#grad-folg_opp)"
                      strokeWidth={1.5}
                      isAnimationActive={!prefersReducedMotion}
                    />
                    <Area
                      type="monotone"
                      dataKey="ikke_hjemme"
                      stackId="1"
                      stroke={STATUS_COLOR.ikke_hjemme}
                      fill="url(#grad-ikke_hjemme)"
                      strokeWidth={1.5}
                      isAnimationActive={!prefersReducedMotion}
                    />
                    <Area
                      type="monotone"
                      dataKey="nei"
                      stackId="1"
                      stroke={STATUS_COLOR.nei}
                      fill="url(#grad-nei)"
                      strokeWidth={1.5}
                      isAnimationActive={!prefersReducedMotion}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                  <BarChart3 className="h-10 w-10 text-muted-foreground/60 mb-3" strokeWidth={1.25} />
                  <p className="text-[13px] text-muted-foreground max-w-sm">
                    Lite data å vise. Registrer salg så bygger denne grafen seg opp.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Donut — restyled center label + 2-col legend */}
          <div className="md:col-span-2 rounded-2xl border border-ab-line bg-ab-elevated p-5 min-h-[280px] flex flex-col">
            <h3 className="text-[16px] font-semibold text-foreground">Statusfordeling</h3>
            <p className="text-[12px] text-muted-foreground mb-3">
              Per resultat
            </p>
            <div className="relative flex-1 min-h-[160px]">
              {derived.totalResponses > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'ja', value: derived.jaCount },
                          { name: 'folg_opp', value: derived.folgOppCount },
                          { name: 'ikke_hjemme', value: derived.ikkeHjemmeCount },
                          { name: 'nei', value: derived.neiCount },
                        ]}
                        dataKey="value"
                        innerRadius={48}
                        outerRadius={72}
                        paddingAngle={2}
                        stroke="var(--ab-bg-elevated)"
                        strokeWidth={2}
                        isAnimationActive={!prefersReducedMotion}
                      >
                        <Cell fill={STATUS_COLOR.ja} />
                        <Cell fill={STATUS_COLOR.folg_opp} />
                        <Cell fill={STATUS_COLOR.ikke_hjemme} />
                        <Cell fill={STATUS_COLOR.nei} />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center label */}
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
                      TOTALT
                    </div>
                    <div className="text-[24px] font-semibold tabular-nums leading-none text-foreground">
                      {derived.totalResponses}
                    </div>
                    <div className="text-[10px] text-muted-foreground">pitcher</div>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-[12px] text-muted-foreground">Ingen data</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-3 text-[11px]">
              {(['ja', 'folg_opp', 'ikke_hjemme', 'nei'] as const).map((k) => {
                const val = derived[
                  k === 'ja' ? 'jaCount'
                  : k === 'folg_opp' ? 'folgOppCount'
                  : k === 'ikke_hjemme' ? 'ikkeHjemmeCount'
                  : 'neiCount'
                ];
                return (
                  <div key={k} className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ background: STATUS_COLOR[k] }}
                    />
                    <span className="text-muted-foreground">{STATUS_LABEL_NB[k]}</span>
                    <span className="ml-auto font-medium tabular-nums text-foreground">{val}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ───── STEP 5: UKEN PÅ ET BLIKK ───────────────────────────── */}
      {!campaignsLoading && assignedCampaigns.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-[18px] font-semibold text-foreground">Uken på et blikk</h2>
            <p className="text-[12px] text-muted-foreground">Hver dag — på et øyeblikk</p>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {derived.uken.map((d, i) => {
              const isBest = i === derived.ukenBestIdx && d.total > 0;
              const barFill =
                d.jaPct >= STATS_MIN_JA_PROSENT
                  ? '#10b981'
                  : d.jaPct >= STATS_MIN_JA_PROSENT * 0.6
                  ? '#f59e0b'
                  : '#f43f5e';
              const fillWidth = Math.min(
                100,
                (d.jaPct / STATS_MIN_JA_PROSENT) * 100,
              );
              const tooltipText = d.total > 0
                ? `${d.weekdayLong}: ${d.ja} ja · ${d.nei} nei · ${d.ikkeHjemme} ikke hjemme · ${d.folgOpp} følg opp`
                : `${d.weekdayLong}: ingen aktivitet`;
              return (
                <div
                  key={d.iso}
                  title={tooltipText}
                  className={cn(
                    'relative rounded-xl border bg-ab-elevated p-4 h-32 flex flex-col justify-between transition-all duration-150 hover:bg-ab-subtle/40',
                    d.isToday
                      ? 'ring-2 ring-ab-accent/30 border-ab-accent/30'
                      : 'border-ab-line',
                  )}
                  style={d.isToday ? { background: `linear-gradient(180deg, ${moodHex}10 0%, var(--ab-bg-elevated) 60%)` } : undefined}
                >
                  {isBest && (
                    <Trophy className="absolute top-2 right-2 h-3.5 w-3.5 text-amber-500" />
                  )}
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                      {d.weekdayShort}
                    </span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {d.date.getDate()}.{d.date.getMonth() + 1}
                    </span>
                  </div>
                  <div className={cn(
                    'text-[28px] font-bold tabular-nums leading-none',
                    d.total > 0 ? 'text-foreground' : 'text-muted-foreground',
                  )}>
                    {d.total > 0 ? d.total : '—'}
                  </div>
                  {d.total > 0 ? (
                    <div className="h-1.5 w-full rounded-full bg-ab-subtle overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${fillWidth}%`,
                          background: barFill,
                          transition: prefersReducedMotion ? 'none' : 'width 600ms ease-out',
                        }}
                      />
                    </div>
                  ) : (
                    <div className="h-1.5" />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ───── STEP 6: BOTTOM SECTIONS — RESTYLED LISTS ───────────── */}
      {!campaignsLoading && assignedCampaigns.length > 0 && (
        <section className="grid gap-4 md:grid-cols-2">
          {/* Følg opp */}
          <div className="rounded-2xl border border-ab-line bg-ab-elevated p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[18px] font-semibold text-foreground">Følg opp</h3>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ab-line bg-ab-subtle px-2.5 py-1 text-[11px] text-muted-foreground tabular-nums">
                {followUps?.results?.length ?? 0} venter
              </span>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-20 rounded-xl bg-ab-subtle/40 animate-pulse" />
                ))}
              </div>
            ) : (followUps?.results?.length ?? 0) === 0 ? (
              <p className="text-[13px] text-muted-foreground text-center py-8">
                Ingen oppfølginger i valgt periode.
              </p>
            ) : (
              <div className="space-y-2">
                {(followUps?.results ?? []).slice(0, 6).map((f) => {
                  const recorded = new Date(f.recorded_at);
                  const ageDays = (Date.now() - recorded.getTime()) / 86400000;
                  const leftBorder = ageDays < 3 ? '#3b82f6' : '#f59e0b';
                  const coords = f.position?.coordinates ?? [];
                  return (
                    <div
                      key={f.id}
                      className="rounded-xl border border-ab-line bg-ab-canvas p-4 hover:bg-ab-subtle/60 transition-colors"
                      style={{ borderLeftWidth: 2, borderLeftColor: leftBorder }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border"
                          style={{
                            background: `${leftBorder}1f`,
                            borderColor: `${leftBorder}66`,
                            color: leftBorder,
                          }}
                        >
                          Følg opp
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {recorded.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="mt-2 flex items-start gap-1.5 text-[14px] font-medium text-foreground">
                        <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{f.address_text}</span>
                      </div>
                      {f.campaign?.name && (
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {f.campaign.name}
                        </div>
                      )}
                      {f.notes && (
                        <p className="mt-1 text-[12px] text-muted-foreground line-clamp-2">
                          {f.notes}
                        </p>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        {coords.length === 2 && (
                          <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                            {coords[1].toFixed(4)}, {coords[0].toFixed(4)}
                          </span>
                        )}
                        <button
                          type="button"
                          className="ml-auto inline-flex items-center gap-1 text-[12px] text-ab-accent hover:text-ab-accent-2 transition"
                        >
                          Marker som fulgt opp
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Nylige registreringer */}
          <div className="rounded-2xl border border-ab-line bg-ab-elevated p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[18px] font-semibold text-foreground">Nylige registreringer</h3>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ab-line bg-ab-subtle px-2.5 py-1 text-[11px] text-muted-foreground tabular-nums">
                {activities?.results?.length ?? 0} totalt
              </span>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 rounded-xl bg-ab-subtle/40 animate-pulse" />
                ))}
              </div>
            ) : (activities?.results?.length ?? 0) === 0 ? (
              <p className="text-[13px] text-muted-foreground text-center py-8">
                Ingen registreringer enda.
              </p>
            ) : (
              <div className="space-y-2">
                {(activities?.results ?? []).slice(0, 8).map((a) => {
                  const statusKey = (a.metadata?.status || a.status || '').toLowerCase();
                  const c =
                    statusKey === 'ja' ? STATUS_COLOR.ja
                    : statusKey === 'nei' ? STATUS_COLOR.nei
                    : statusKey === 'ikke_hjemme' ? STATUS_COLOR.ikke_hjemme
                    : statusKey === 'folg_opp' ? STATUS_COLOR.folg_opp
                    : '#94a3b8';
                  const recorded = new Date(a.recorded_at || a.created_at);
                  return (
                    <div
                      key={a.id}
                      className="rounded-xl border border-ab-line bg-ab-canvas p-3 hover:bg-ab-subtle/60 transition-colors"
                      style={{ borderLeftWidth: 2, borderLeftColor: c }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                            <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                            <span className="truncate">{a.address_text || a.metadata?.address_text || '—'}</span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                            {a.campaign?.name && <span>{a.campaign.name}</span>}
                            <span>·</span>
                            <span className="tabular-nums">
                              {recorded.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border whitespace-nowrap"
                          style={{
                            background: `${c}1f`,
                            borderColor: `${c}66`,
                            color: c,
                          }}
                        >
                          {STATUS_LABEL_NB[statusKey] ?? (a.status || '—')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ───── STEP 7: PERSONLIG INNSIKT ──────────────────────────── */}
      {!campaignsLoading && assignedCampaigns.length > 0 && (
        <section className="relative overflow-hidden rounded-2xl border border-ab-line bg-ab-elevated p-6">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl opacity-30"
            style={{ background: moodHex }}
          />
          <div className="relative flex items-start gap-4">
            <div className="shrink-0 inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-ab-accent/10 border border-ab-accent/20">
              <Sparkles className="h-6 w-6 text-ab-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
                PERSONLIG INNSIKT
              </p>
              <h3 className="mt-1 text-[14px] font-semibold text-foreground">
                {insight.title}
              </h3>
              <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed max-w-3xl">
                {insight.body}
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
