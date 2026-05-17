# Mascot Rollout — File Changes

Generated: 2026-05-17T12:31:26Z
Starting SHA: f96b1102691701b62a82f957fabff942013cb764
Branch: main
Snapshot dir (pre-mascot state for the 3 files about to be wired):
  /tmp/abmaps-before-mascot-rollout-20260517T123126Z/

> Note: the working tree already contained many uncommitted redesign changes
> when this rollout started. To roll back the mascot work without disturbing
> the prior redesign, use the snapshots (Option B) — see rollback section.

## Files CREATED

- `components/gamification/SmartAvatar.tsx`
  Wrapper that returns `<MoodMascot>` for employees (with or without
  performance data — falls back to 'new' mood when missing) and a
  token-styled initials disc for managers / admins / superusers.

- `components/gamification/ROLLOUT_LOG.md`
  This file.

## Files MODIFIED

### `app/analytics/page.tsx` (Ytelse tab — Ansattranking)

- **Top of file**: added `import { SmartAvatar } from "@/components/gamification/SmartAvatar"`
  + two constants `DEFAULT_MIN_JA_PROSENT = 3.0` and `DEFAULT_MIN_DORER_PER_DAG = 70`
  with a TODO to source from `analyticsService.getThresholds()` later.

- **Ansattranking table row** (`EmployeeLeaderboard`, ~line 3910):
  Wrapped the existing name cell with a flex row that prepends a
  `<SmartAvatar size="sm">`. Computes `rankPercentile` as
  `Math.round((rank / sorted.length) * 100)` and passes it along with
  `yes_rate` and `doors_per_day` from the existing `EmployeeAnalytics`
  payload. Medal icons via `<RankBadge>` are untouched and still
  render in the leading column.

- **4 highlight cards** (Topp Ja % / Topp dører / Lavest Ja % / Lavest dører,
  ~line 3843): added a centered `<SmartAvatar size="md">` above each
  performer name. For top performers, passes `rankPercentile: 5` so the
  mood resolves to **on-fire** when ja-rate ≥ 1.5× threshold; for bottom
  performers the synthetic complementary value lands them in
  **tough-day** / **off-pace**. No new API calls.

### `sales-screen.tsx` (Statistikk — sales table rows)

- **Top of file**: added `import { SmartAvatar } from "@/components/gamification/SmartAvatar"`.

- **`SalesTable` row, ANSATT column** (~line 390): replaced the inline
  `<div className="h-7 w-7 rounded-full ...">` initials disc with
  `<SmartAvatar size="sm" user={{ name: sale.seller, user_type: "employee" }} showMoodIndicator />`.
  The `Sale` shape only carries the seller's name as a string; no
  per-sale performance data is attached, so SmartAvatar resolves to
  **'new' mood fallback** and renders the cartoon face without a busy
  indicator confusion. The unused local `initials` variable
  (`getInitials(sale.seller)`) is now dead code but harmless and left
  in place to keep this diff scoped.

### `components/area/AreasWorkloadDock.tsx` (Områder — workload dock)

- **Top of file**: added `import { SmartAvatar } from "@/components/gamification/SmartAvatar"`.

- **`Ring` component**: simplified the prop signature from
  `{initials, bg, initialsColor}` to a single `employee: DockEmployee`.
  The inner `<div className="absolute inset-1 rounded-full">` now hosts
  a `<SmartAvatar size="md" showMoodIndicator={false}>` so the cartoon
  face fills the ring's interior. The corner mood badge is intentionally
  suppressed (`showMoodIndicator={false}`) — the colored capacity ring
  already signals state, adding a corner indicator inside the ring
  would crowd the 48px circle. The SVG capacity progress ring + the
  600ms `stroke-dashoffset` animation are untouched.

- **Render-site call** (`sorted.map` body): replaced the old prop
  triple with `employee={emp}`. The hover-scale, click-to-highlight,
  and active-state ring on the parent button are untouched.

## What's NOT touched (per non-negotiables)

- Mascot preview page (`/mood-mascots-preview`) — left exactly as it was.
- Existing `MoodMascot.tsx` / `MoodMascotCard.tsx` / `lib/mood.ts` — unmodified.
- Non-employee role rendering — falls through to the initials disc inside
  `SmartAvatar` so managers / admins / superusers keep the current look.
- No backend API change. No new endpoint calls. No data shape change.
- Sidebar nav items, route registrations, auth flow — untouched.

## Rollback strategy

### Preferred — surgical, preserves the rest of the session's redesign work

```sh
# From the dashboard repo root
cp /tmp/abmaps-before-mascot-rollout-20260517T123126Z/analytics-page.tsx \
   "app/analytics/page.tsx"
cp /tmp/abmaps-before-mascot-rollout-20260517T123126Z/sales-screen.tsx \
   "sales-screen.tsx"
cp /tmp/abmaps-before-mascot-rollout-20260517T123126Z/AreasWorkloadDock.tsx \
   "components/area/AreasWorkloadDock.tsx"

# Then remove the new component files
rm components/gamification/SmartAvatar.tsx
rm components/gamification/ROLLOUT_LOG.md
```

### Nuclear — wipes EVERYTHING in the working tree, including prior redesigns
```sh
git reset --hard f96b1102691701b62a82f957fabff942013cb764
git clean -fd
```

### Single-file surgical
```sh
cp /tmp/abmaps-before-mascot-rollout-20260517T123126Z/<filename> <original-path>
```

## Phase 1.5 — Optimization Pass (2026-05-17)

Starting SHA: f96b1102691701b62a82f957fabff942013cb764
Snapshot dir: /tmp/abmaps-before-mood-optimization-20260517T124329Z/

### Changes

- **Reduced 7 moods → 4 actionable states** (+ 'new' fallback).
  Old: on-fire / crushing-it / grinding / determined / tough-day / off-pace / new
  New: on-fire / on-track / working-hard / needs-attention / new
  Rationale: managers need one mood ↔ one action. "Står på" (working-hard)
  replaces grinding + determined + tough-day. "Sjekk inn" (needs-attention)
  replaces tough-day + off-pace.

- **Tightened on-fire threshold for scarcity.**
  Was: rankPercentile ≤ 10 AND jaProsent ≥ minJaProsent.
  Now: rankPercentile ≤ 10 AND jaProsent ≥ minJaProsent × 1.3.
  Produces 2–4 on-fire mascots in a 50-person team instead of 5–7.

- **Mood signal dominance shifted from corner badge to face tint + ring.**
  At sm/md sizes (ranking tables, sales rows, workload dock), the avatar
  itself IS the mood pill: gradient bg jumps from /20 → /59 outer, ring
  color now mood-tinted not neutral. Corner badge + on-fire pulsing glow
  only render at lg/xl sizes. Default `showMoodIndicator` is now
  size-aware (ON at lg/xl, OFF at sm/md).

- **Varsler tab confirmed mascot-free** + permanent guard comment added
  to `AlertsOverview` warning future passes not to introduce mascots
  in alert triage views.

### Files modified

- `components/gamification/lib/mood.ts`
  Mood union reduced to 5 entries (4 user-facing + 'new' fallback).
  New `FALLBACK_MOOD` export. Decision tree rewritten. On-fire requires
  1.3× threshold. All colorClass/bgClass/borderClass opacities bumped
  to /15 + /40 for stronger small-size readability.

- `components/gamification/MoodMascot.tsx`
  Icon map pruned to 5 lucide icons (Flame / TrendingUp / Target /
  AlertCircle / Sparkles). Removed Zap, CloudRain, Moon, Users.
  Avatar background gradient strengthened (35% → 59% outer). Static
  ring switched from neutral white/black to mood-colored via
  `boxShadow: 0 0 0 2px ${tintHex}66`. Corner indicator + pulsing halo
  now gated on `size === 'lg' || 'xl'`. Default `showMoodIndicator`
  defaults to `undefined → size-aware boolean`.

- `app/mood-mascots-preview/page.tsx`
  Imported new `FALLBACK_MOOD` export. `MOOD_SEEDS` map rebuilt for
  the 4 new mood ids. Section heading "Alle 7 humør" → "Alle 4 humør".
  Grid changed from `lg:grid-cols-7` to `md:grid-cols-4`. Tile padding
  bumped p-4 → p-5; mascot size bumped md → lg (with badge visible).
  Added a separate "RESERVE-TILSTAND" tile below the 4-grid showing
  the 'new' fallback in context.

- `app/analytics/page.tsx`
  Added a permanent code-comment guard before `AlertsOverview` warning
  future maintainers that Varsler tab is intentionally mascot-free.
  No avatar wiring changed.

### Rollback (Phase 1.5 only — preserves Phase 1 and prior redesign work)

```sh
cp /tmp/abmaps-before-mood-optimization-20260517T124329Z/mood.ts \
   "components/gamification/lib/mood.ts"
cp /tmp/abmaps-before-mood-optimization-20260517T124329Z/MoodMascot.tsx \
   "components/gamification/MoodMascot.tsx"
cp /tmp/abmaps-before-mood-optimization-20260517T124329Z/preview-page.tsx \
   "app/mood-mascots-preview/page.tsx"
cp /tmp/abmaps-before-mood-optimization-20260517T124329Z/analytics-page.tsx \
   "app/analytics/page.tsx"
```

## Mascot placement fix — 2026-05-17T18:55Z

Starting SHA: f96b1102691701b62a82f957fabff942013cb764
Snapshot dir: /tmp/abmaps-emp-mascot-placement-20260517T185500Z/

### Changes
- **Mascot moved** from the hero "I dag" tile → next to the "Hei {firstName}" greeting at the top of the employee dashboard. Size lg (64px), `showMoodIndicator` on, no label pill, `disablePulseGlow` to suppress the lg-size halo in this high-traffic position.
- **Mount animation**: opacity 0 → 1 + scale 0.85 → 1 over 280ms ease-out-expo with 80ms delay (framer-motion). Guarded by `useReducedMotion()`.
- **Hover wobble**: scale 1.03, 200ms. Also reduced-motion aware.
- **On-fire treatment** at this size: static `ring-2 ring-amber-400/50` + `drop-shadow(0 0 8px hsl(38 92% 50% / 0.4))`. No pulsing glow.
- **Tooltip on mascot** (shadcn Tooltip, 200ms delay) shows mood label + description in one line.
- **Click mascot** → navigates to `/employee/stats` (wrapped in `<Link>`).
- **Hero tile rebuilt** as a pure stat card: overline (left) + streak pill (right) at top → giant centered number 64px font-bold tabular-nums + label + mood pill + 7-day sparkline in the middle → "Se min statistikk →" bottom-right.
- **7-day sparkline** derived client-side from `salesPageData` (no new API calls). Hidden when the series is all zeros or under 7 entries.
- **Layered mood-tinted background** on hero tile only: two radial gradient pools (top-right + bottom-left) + diagonal wash + base `--ab-bg-elevated`. Opacities bump ~50% in dark theme via `useTheme()` detection.
- **Brighter palette** for hero zone: amber-400 / emerald-400 / **sky-400 (working-hard)** / rose-400 / pink-400. Working-hard explicitly swapped from cool blue → sky/cyan for the "active, in motion" read.
- **Inner ring shadow** on hero tile: `inset 0 0 0 1px ${mood}26, 0 0 0 1px ${mood}14` — gives a polished-surface feel.
- **On-fire shimmer**: framer-motion animates a soft 224px blurred pool's position between (5%, 55%) and (55%, 10%) over 4s `easeInOut` infinite. Disabled by `prefers-reduced-motion`.
- **Other bento tiles untouched** — the mood-tinted treatment is now exclusive to the hero "I dag" tile, making the hierarchy clearer.

### Files modified
- `app/employee/page.tsx` — greeting strip rebuilt; hero tile rebuilt; `quickStats` extended with `last7Days`; `useTheme` + `useReducedMotion` hooks added.
- `components/gamification/MoodMascot.tsx` — added `bare?: boolean` (returns just the avatar, no wrapping tooltip/button) and `disablePulseGlow?: boolean` (suppresses the on-fire halo at lg/xl). No existing call sites affected (both default to previous behavior).

### Rollback (surgical — preserves other session work)
```sh
cp /tmp/abmaps-emp-mascot-placement-20260517T185500Z/employee-page.tsx \
   "app/employee/page.tsx"
cp /tmp/abmaps-emp-mascot-placement-20260517T185500Z/MoodMascot.tsx \
   "components/gamification/MoodMascot.tsx"
```

### QA verified
- `tsc --noEmit`: no new errors (3 pre-existing line errors at 228, 1895, 2138 — `getEmployeeById` arg count + Badge name collision — unchanged source, line numbers shifted).
- `/employee` returns 200.
- All Norwegian copy preserved: "Hei {firstName}.", mood lines, "I DAG", "aktiviteter i dag", "Se min statistikk", "X dager på rad".
- No backend API calls added.
- No git commits, pushes, tags, branches, stashes, resets, or adds.

## Employee Stats — STRUCTURAL REBUILD — 2026-05-17T19:15Z

Starting SHA: f96b1102691701b62a82f957fabff942013cb764
Snapshot dir: /tmp/abmaps-emp-stats-rebuild-20260517T191500Z/

### Files modified

- `components/employee/EmployeeStatsDashboard.tsx` — full structural rebuild from ~295 lines to ~720 lines. The previous file was a thin host around `<KPICards>` / `<DashboardLineChart>` / `<DonutChart>` / `<FollowUpsList>` / `<RecentActivitiesList>`; the new file renders all sections natively, sourced from the same `useNewDashboardData()` hook (no new endpoints). `<DashboardFilters>` is the only sub-component still rendered as-is — the brief keeps the filter bar intact.

### Step-by-step landing report (matches the brief's checkpoints)

1. **Hero strip (180px)** — single `<section>` with three flex columns: breadcrumb + 96px mascot (`size="xl"` from MoodMascot's SIZE_PX map), mood-keyed title + concrete-numbers subtitle + 2-3 milestone pills, refresh chip on the right. Layered mood-tinted gradients + dotted-grid atmosphere overlay. **The previous mini header (mascot 64px + breadcrumb + small title + 1-line subtitle) is GONE.**
2. **Bento grid (6-col, mismatched spans)** — `gridTemplateColumns: 'repeat(6, minmax(0, 1fr))'`, `gridAutoRows: 120px`. Tile A "Totale pitcher" = 3×2 hero with 72px number + 14-day Recharts AreaChart sparkline + period label, mood-tinted bg + inner ring shadow. B "Ja" = 2×1 with `CheckCircle` icon + threshold-colored treffrate. C "Closing" = 1×1 with SVG circular progress ring. D "Snitt/dag" = 2×1. E "Beste dag" = 1×1. **`<KPICards>` is no longer rendered.**
3. **Stacked area chart + restyled donut** — col-span-4 + col-span-2 split. Recharts `<AreaChart>` with 4 stacked `<Area stackId="1">` for ja/folg_opp/ikke_hjemme/nei using CSS-token-aware status colors + gradient fills. Friendly empty state ("Lite data å vise. Registrer salg så bygger denne grafen seg opp.") with `BarChart3` lucide. Donut now has center label (TOTALT / N / pitcher overline) + 2-col legend below. **`<DashboardLineChart>` is no longer rendered.**
4. **Uken på et blikk** — new section. 7-col grid of day cards spanning Mon-Sun of the current week. Per-day: NB weekday (MAN/TIR/…) + date, giant 28px count, threshold-colored fill bar (green ≥ target, amber 60-100%, danger below). Today's card has accent ring + mood-tinted background. Best day in the week shows a `Trophy` icon top-right. Zero-activity days render "—" + no bar. Hover tooltip via `title` attr.
5. **Personlig innsikt card** — new section. Priority-picked from existing data: best weekday pattern > total milestone > best-day record > fallback. Sparkles icon + headline + body, accent radial overlay top-right. No clipboard "Del" button (skipped per the "skip if >30min" allowance).
6. **Følg opp / Nylige registreringer** (restyle pass) — rebuilt inline with colored left borders (2px), status pills, MapPin icon for address, monospace coordinates, "Marker som fulgt opp →" affordance. Nylige rows are color-banded by status (emerald/rose/amber/blue). **`<FollowUpsList>` and `<RecentActivitiesList>` are no longer rendered** (replaced by inline UI sharing the same data shapes).

### Data — all derived from existing hook, no new endpoints

- `stats.summary.{total_responses, days_in_range, avg_per_day}`
- `stats.status_counts.{ja, nei, ikke_hjemme, folg_opp}`
- `stats.calculated_metrics.hit_rate`
- `trends.trends.{ja, nei, ikke_hjemme, folg_opp}[{date, count}]`
- `trends.date_range.{start, end, periods}`
- `followUps.results[]`, `activities.results[]`

A `derived` `useMemo` indexes the trends arrays into per-day maps, then builds the full daily series, the 14-day sparkline window, best-day + best-weekday-pattern stats, and the Mon-Sun "Uken" array — all from one pass.

### Rollback (surgical)

```sh
cp /tmp/abmaps-emp-stats-rebuild-20260517T191500Z/EmployeeStatsDashboard.tsx \
   dashboard/components/employee/EmployeeStatsDashboard.tsx
```

### QA verified

- `tsc --noEmit` clean for the rebuilt file (pre-existing errors in `app/employee/page.tsx` unchanged).
- `/employee/stats` returns 200.
- Both themes covered via `useTheme()` + `--ab-bg-elevated`, `--ab-line`, `--ab-fg-*` tokens.
- `prefers-reduced-motion` disables Recharts animation + closing-ring stroke transition + Uken bar-fill transition.
- All Norwegian copy preserved + extended ("Uken på et blikk", "Hver dag — på et øyeblikk", "Marker som fulgt opp", "Lite data å vise. Registrer salg så bygger denne grafen seg opp.", weekday names MAN/TIR/ONS/TOR/FRE/LØR/SØN).
- No backend API contract changes, no new endpoints, no new fields.
- No git commits, pushes, tags, branches, stashes, resets, or adds.

