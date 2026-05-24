# Module 3 — Backend Integration Guide (Manager/Admin Main Dashboard)

> **For the frontend Claude.** Module 3 makes the **Main Dashboard** (`/dashbord`,
> spec §5.2) live. Read `MODULE_1_BACKEND_INTEGRATION.md` for auth/conventions
> (same base URL, `Authorization: Bearer {access}`, historical-data caveat).
>
> **All endpoints live under a NEW namespace: `/api/dashboard/v2/...`** — the
> legacy `/api/dashboard/stats|trends|leaderboard/` were left untouched (the old
> app still uses them). Use the `v2/` paths below.
>
> All are **manager/admin only** (employee token → **403**) and **team-scoped**:
> a manager sees their team; an admin (superuser) sees everyone. Optional
> `?campaign_id=<uuid>` scopes any widget to one campaign.

---

## 0. Primary call — one composite

```
GET /api/dashboard/v2/overview/?range=7d|30d|90d&campaign_id=
→ { stats, trends, mood, campaign_health, leaderboard, recent_activities }
```
Call this **once on first paint** — it bundles all six widgets (shapes below).
Then optionally **poll `v2/activities/`** every ~30 s for the live feed (SSE is a
later module).

---

## 1. KPI strip — `GET /api/dashboard/v2/stats/?campaign_id=`
```jsonc
{
  "online_employees": { "value": 1, "total": 2 },
  "total_doors":      { "value": 8, "delta_pct": 300.0 },   // today vs yesterday
  "yes_rate":         { "value": 37.5, "delta_pct": -12.0 },
  "active_campaigns": { "value": 1 },
  "sales_today":      { "value": 3, "delta_pct": 200.0 }     // ja count today
}
```
> **`revenue` is intentionally absent** — there is no revenue/money data in this
> system. Remove the revenue KPI card from the UI; do not expect a `revenue` key.
> `delta_pct` compares today to yesterday.

## 2. Trend chart — `GET /api/dashboard/v2/trends/?range=7d|30d|90d&campaign_id=`
```jsonc
{ "points": [ { "date": "2026-05-17", "doors": 12, "yes_rate": 25.0 } ] }
```
`range` controls the number of points (7 / 30 / 90). Oldest→newest.

## 3. Mood ring — `GET /api/dashboard/v2/mood-distribution/?campaign_id=`
```jsonc
{ "segments": [ { "mood": "on-track", "count": 3 }, { "mood": "needs-attention", "count": 1 } ] }
```
Moods: `new | on-fire | on-track | working-hard | needs-attention`, computed
server-side over a 30-day window with the same `computeMood` rule the UI uses
(`rank_percentile` is live). Only employees with activity in the window appear.

## 4. Campaign health — `GET /api/dashboard/v2/campaign-health/`
```jsonc
{ "campaigns": [
  { "id":"uuid", "name":"Kampanje A", "target":100, "current":10,
    "employees":2, "color":"#10b981", "days_left":0 }
] }
```
- `target` = total doors available in the campaign's areas (single homes +
  apartment units, from Module 1's area door-counts).
- `current` = doors knocked (team-scoped).
- **`days_left` is always `0`** — no campaign timeline in this system; render
  progress from `current/target`, not a countdown.
- `color` = the campaign's `brand_color_hex` (may be `null`).

## 5. Leaderboard — `GET /api/dashboard/v2/leaderboard/?metric=ja_rate|doors|consistency&limit=5&campaign_id=`
```jsonc
{ "entries": [
  { "rank":1, "name":"Erik One", "region":"",
    "dorer_per_dag":0.2, "ja_prosent":60.0,
    "min_ja_prosent":10.0, "min_dorer_per_dag":2,
    "rank_percentile":50.0, "days_on_platform":480, "score":60.0, "online":true }
] }
```
- `rank_percentile` and `rank` are **computed live** (within the scoped team,
  ranked by `metric`). `score` = the ranked metric's value.
- `min_*` come from each employee's effective threshold.
- `days_on_platform` = days since the employee's join date.
- **`region` is always `""`** — employees have no region field in the data
  model; hide the region column or leave blank.

## 6. Activity feed — `GET /api/dashboard/v2/activities/?limit=50&campaign_id=`
```jsonc
[ { "id":"uuid", "time":"10:00", "agent":"Erik One",
    "action":"Registrerte et salg", "location":"Storgata 1",
    "campaign":"Kampanje A", "tone":"success" } ]
```
Newest first. `tone` maps from door status: `ja→success`, `nei→danger`,
`ikke_hjemme→warn`, `folg_opp→info`. Poll this for live updates.

---

## 7. Integration checklist
- [ ] Dashboard first paint → `GET /api/dashboard/v2/overview/?range=7d`.
- [ ] **Remove the revenue KPI card** — no revenue data exists.
- [ ] Trend range selector → `?range=7d|30d|90d`.
- [ ] Mood ring → `mood.segments`; campaign health bars → `current/target`
      (ignore `days_left`).
- [ ] Leaderboard metric toggle → `?metric=`; hide the `region` column.
- [ ] Activity feed → poll `v2/activities/` (~30 s) until SSE ships.
- [ ] All v2 endpoints accept optional `?campaign_id=`; pass the selected campaign.
- [ ] Use a manager/admin token — employees get 403 here (they have their own
      `/employee/me/*` endpoints from Module 2).
- [ ] Test with a historical date range if today's data is empty in dev.
