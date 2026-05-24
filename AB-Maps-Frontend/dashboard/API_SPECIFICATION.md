# AB Maps V2 — Complete API Specification & Data Contract

> Source of truth for the backend API that powers the Admin, Manager, and Employee
> dashboards. Every page is documented with the data it consumes, the endpoints
> that should serve it, the exact response structure, and the
> pagination/filtering/optimization strategy that keeps it fast.
>
> The frontend currently runs the v2 redesign on **mock data**. This document
> describes the contract the real backend must satisfy so the mock generators can
> be swapped for live calls with no UI change.

---

## Table of Contents

1. [Global Conventions](#1-global-conventions)
2. [Cross-Cutting Design Rules (Pagination, Filtering, Caching, Real-time)](#2-cross-cutting-design-rules)
3. [Authentication & Authorization](#3-authentication--authorization)
4. [Shared Domain Models](#4-shared-domain-models)
5. [MANAGER Dashboard — Page by Page](#5-manager-dashboard--page-by-page)
6. [ADMIN Dashboard — Page by Page](#6-admin-dashboard--page-by-page)
7. [EMPLOYEE Dashboard — Page by Page](#7-employee-dashboard--page-by-page)
8. [Learning Platform (Academy) — Admin + Employee](#8-learning-platform-academy)
9. [Performance & Optimization Playbook](#9-performance--optimization-playbook)
10. [Endpoint Index (Quick Reference)](#10-endpoint-index)

---

## 1. Global Conventions

### Base URL
```
{NEXT_PUBLIC_API_URL}/api/...
```
All paths in this doc are relative to `/api`. The frontend builds URLs via
`lib/config/apiConfig.ts → buildApiUrl(endpoint, params)`.

### Transport & format
- **JSON** request/response, `Content-Type: application/json`.
- **Dates**: ISO-8601 strings (`2026-05-23T13:45:00Z`). Date-only filters use `YYYY-MM-DD`.
- **Percentages**: numeric decimals (`3.4` means 3.4 %), never strings, never `0.034`.
- **Money**: integer minor units OR decimal NOK with explicit `currency` field. Prefer `{ "amount": 1290, "currency": "NOK" }` to avoid float drift.
- **Colors**: hex strings (`"#10b981"`).
- **IDs**: opaque strings (UUIDs recommended). Never leak DB auto-increment ints to the client where it can aid enumeration.
- **Enums**: lowercase snake or kebab as already used by the UI — `ja | nei | ikke_hjemme | folg_opp`, `todo | in_progress | done`, `active | paused | ended`.

### Standard success envelope
List endpoints return a **paginated envelope** (see §2). Single-resource endpoints return the object directly. Aggregation/analytics endpoints return a **purpose-built composite** (documented per page) — do NOT force analytics into a generic list shape.

### Standard error envelope
```json
{
  "error": {
    "code": "validation_error",
    "message": "Human-readable summary (Norwegian for user-facing).",
    "fields": { "min_yes_rate_percent": ["Must be between 0 and 100."] },
    "request_id": "req_01H...."
  }
}
```
- HTTP status mirrors the class: `400` validation, `401` unauth, `403` role, `404` missing, `409` conflict, `422` semantic, `429` rate-limit, `5xx` server.
- Always include `request_id` for support/log correlation.

### Versioning
Prefix breaking versions: `/api/v2/...`. Keep current routes alive during migration. Send `Deprecation` + `Sunset` headers on old versions.

---

## 2. Cross-Cutting Design Rules

These rules apply to **every** endpoint and are the heart of "how the API should be designed for fast responses."

### 2.1 Pagination

Two strategies, chosen by access pattern:

**A. Cursor pagination (default for feeds, large/append-only lists)** — activity feeds, sales registrations, audit logs, learning activity. Stable under inserts, O(1) regardless of depth.
```
GET /api/dashboard/activities/filtered/?cursor=eyJ0cyI6...&limit=50
```
```json
{
  "results": [ /* ... */ ],
  "page_info": {
    "next_cursor": "eyJ0cyI6MTcw...",
    "prev_cursor": null,
    "has_next": true,
    "limit": 50
  }
}
```

**B. Offset/page pagination (for bounded admin tables you can jump around)** — user lists, sections, lessons, todos. Easy "page 3 of 12" UX.
```
GET /api/users/employees/?page=2&page_size=20&ordering=-created_at
```
```json
{
  "results": [ /* ... */ ],
  "total_count": 237,
  "page": 2,
  "page_size": 20,
  "total_pages": 12
}
```
> The existing `FilteredActivitiesResponse` / `FilteredSalesResponse` already use shape B. Keep it for those; **migrate high-volume feeds to cursor (A)** as data grows.

**Rules**
- Default `page_size = 25`, **max `100`**. Reject larger with `400`.
- Pagination metadata is mandatory on every list. Never return a bare array for a collection that can grow.
- For "load more" UIs use cursor; for numbered tables use offset.

### 2.2 Filtering

- Filters are **query params**, validated and whitelisted server-side.
- Date ranges: `start_date` + `end_date` (inclusive, `YYYY-MM-DD`). Provide presets server-side too: `date_range=today|this_week|this_month|last_7d|last_30d|custom`.
- Multi-value filters: repeat or CSV — `campaign_ids=c1,c2` and `employee_ids=e1,e2`.
- Status filters: `status=active`, `severity=critical`.
- Always combine with `AND`. Document any `OR` semantics explicitly.

### 2.3 Sorting

- `ordering=field` ascending, `ordering=-field` descending (Django-style, already implied by services).
- Whitelist sortable fields per endpoint; reject others.
- Multi-sort: `ordering=-ja_rate,name`.

### 2.4 Search

- `search=` does server-side full-text/`ILIKE` across a documented set of fields (name, email, title, address).
- Debounce on the client (300 ms); the server should still cap `search` length and rate-limit.

### 2.5 Sparse fieldsets & expansion

To keep payloads lean and round-trips low:
- `fields=id,name,ja_rate` → return only those keys.
- `expand=campaign,manager` → inline related objects (avoids N+1 client calls). Without `expand`, return only the FK id (`campaign_id`).
- Default responses should be **lean**; opt into heavy nested data with `expand`.

### 2.6 Aggregation endpoints (the performance multiplier)

The dashboards are **analytics-heavy**. Never make the client fetch raw rows and aggregate. Provide pre-computed, server-side aggregates:
- `/dashboard/analytics/preview/` returns summary + per-campaign + per-employee + daily breakdown + alerts in **one** response (already designed this way — keep it).
- These should read from **materialized views / rollup tables** refreshed on a schedule (see §9), not computed live from millions of door-knock rows.

### 2.7 Caching & conditional requests

- Send `ETag` + `Last-Modified`; honor `If-None-Match` / `If-Modified-Since` → `304`.
- `Cache-Control`:
  - Reference data (campaigns, areas, thresholds): `private, max-age=60, stale-while-revalidate=300`.
  - Analytics rollups: `private, max-age=120` (data is inherently a few minutes stale).
  - Live feeds: `no-store`.
- Support **server-side response caching** keyed by (user, role, filter-hash) for analytics, 60–300 s TTL.

### 2.8 Real-time

For live elements (sales activity feed, online presence, live counters) prefer in order:
1. **Server-Sent Events** (`GET /api/stream/activities/`) — simplest, one-way, auto-reconnect. Ideal for the activity feed and live KPIs.
2. **WebSocket** (`/ws/dashboard/`) — only if bidirectional needed.
3. **Polling fallback** — `GET .../filtered/?since={iso}` every 5–15 s with `ETag` so unchanged data is `304` (cheap).

Presence/online status: 30 s heartbeat, mark offline after 90 s missed.

### 2.9 Rate limiting & abuse

- Per-user token bucket: e.g. 120 req/min general, 20 req/min for export/report-trigger.
- Return `429` + `Retry-After`. Surface `X-RateLimit-Remaining`.

### 2.10 Idempotency & concurrency

- Mutations that can be retried (create sale, assign task) accept `Idempotency-Key` header.
- Optimistic concurrency on edits: send `version`/`updated_at`; reject stale writes with `409`.

---

## 3. Authentication & Authorization

### Token model
- `POST /api/users/auth/login/` → `LoginResponse` (below). Store `auth_tokens={access,refresh}` + `user_data` in localStorage (current behavior).
- Header: `Authorization: Bearer {access}`.
- Refresh proactively at ~75 % of `expires_in` via `POST /api/users/auth/refresh/`.
- `POST /api/users/auth/logout/` invalidates the refresh token (server-side blocklist).
- `GET /api/users/auth/verify/` validates a token and re-hydrates the user.

```ts
LoginRequest  = { username: string; password: string; user_type?: "manager" | "employee" }

LoginResponse = {
  access: string; refresh: string; expires_in: number;
  user_id: string; username: string; email: string;
  user_type: "manager" | "employee";          // admin = manager + is_superuser
  is_sales_chief?: boolean;
  user_info: { id: string; name: string; email: string; manager_id?: string };
}
```

### Roles & scoping (enforce server-side, every request)
| Role | Scope of data |
|------|---------------|
| **employee** | ONLY their own activities/stats/areas/campaigns. Server filters by `request.user`. Never trust a client-supplied `employee_id` for an employee. |
| **manager** | Their team (employees where `manager_id == me`) + their campaigns/areas. |
| **admin / superuser** | Global. May pass `manager_id`/`employee_id` filters to scope down. |

> **Security rule:** the employee Statistikk & Briefing endpoints must derive identity from the auth token, not from query params. A query `?employee_id=` is honored only for manager/admin.

---

## 4. Shared Domain Models

These appear across many pages. Define once; reuse.

### 4.1 Campaign
```ts
Campaign = {
  id: string;
  name: string;
  description: string;
  color: string;                 // hex, drives the per-campaign accent in UI
  status: "active" | "paused" | "ended";
  start_date: string;            // YYYY-MM-DD
  end_date: string | null;
  pct_complete: number;          // 0..100
  area_ids: string[];            // or use expand=areas
  employee_count: number;
  days_left: number;
  created_at: string; updated_at: string; created_by_id?: string;
}
```
Endpoints:
- `GET /api/campaigns/campaigns/` (paginated, filter `status`, `search`, `ordering`)
- `GET /api/campaigns/campaigns/all_campaigns/` (lean `{id,name,color}` list for pickers — cacheable 60 s)
- `GET /api/campaigns/campaigns/my_campaigns/` (manager) · `assigned_to_me/` (employee)
- `GET /api/campaigns/campaigns/{id}/?expand=areas,employees`
- `POST/PATCH/DELETE /api/campaigns/campaigns/{id}/`
- `PUT /api/campaigns/campaigns/{id}/areas/` `{ area_ids: string[] }`

### 4.2 Area / Territory
```ts
Area = {
  id: string;
  name: string;
  color: string;
  status: "active" | "locked" | "available";
  fylke?: string;                // county
  house_count: number;
  polygon_geometry: GeoJSONPolygon | null;   // { type:"Polygon", coordinates:number[][][] }
  campaign: { id: string; name: string; description: string } | null;
  manager?: { id: string; name: string } | null;
  assignees?: { id: string; name: string }[];   // only with expand=assignees
  load: number;                  // 0..1 workload ratio (assigned_areas / capacity)
  created_at: string; updated_at: string;
}
```
Endpoints: `my_areas/`, `assigned_areas/` (employee), `assigned_to_me/` (X-Campaign-ID header), `with_campaigns/`, CRUD, `{id}/add_employee/`, `{id}/remove_employee/`, `{id}/set-employees/`, `{id}/employees/`, `{id}/unassigned_employees/`.
> **Optimization:** Polygon geometry is heavy. Default list returns geometry omitted or simplified (Douglas-Peucker at low zoom). Add `?geometry=full|simplified|none`. Serve geometry as a separate `GET /areas/{id}/geometry/` for the map detail view; cache aggressively (geometry rarely changes).

### 4.3 Threshold (admin-set performance targets) — central to Analytics + Employee
```ts
ThresholdScope = "global" | "manager" | "campaign" | "employee";
Threshold = {
  id: string;
  scope: ThresholdScope;
  scope_display: string;         // "Global standard", "Norsk Folkehjelp", "Tobias D."
  manager: string | null; campaign: string | null; employee: string | null;
  target_name: string;
  min_doors_per_day: number;     // default 70
  min_doors_per_week: number;    // default 350
  min_yes_rate_percent: number;  // default 3
  max_no_rate_percent: number;   // default 100
  min_contact_rate_percent: number; // default 0
  consecutive_days_threshold: number; // default 3
  performance_drop_alert_percent: number; // default 20
  max_inactive_hours: number;    // default 4
  is_active: boolean;
  created_at: string; updated_at: string;
}
```
Endpoints: `GET/POST /api/dashboard/analytics/thresholds/`, `PATCH/DELETE /api/dashboard/analytics/thresholds/{id}/`.
> **Resolution rule (server-side helper the API should expose):** the *effective* threshold for an (employee, campaign) is the most specific active one: `employee` > `campaign` > `manager` > `global`. Provide `GET /api/dashboard/analytics/thresholds/effective/?employee_id=&campaign_id=` returning the single resolved `Threshold`. The employee pages depend on this.

### 4.4 Status taxonomy (door-knock outcomes)
`ja` (yes/sale) · `nei` (no) · `ikke_hjemme` (not home) · `folg_opp` (follow-up).
Derived rates everywhere:
- `yes_rate = ja / total * 100`
- `contact_rate = (ja + nei + folg_opp) / total * 100` (i.e. someone answered)
- `consistency_score`: % of working days the rep met the door threshold (0..100).

### 4.5 User
```ts
User = {
  id: string; username: string; name: string; email: string; phone?: string;
  user_type: "employee" | "manager"; is_superuser: boolean; is_sales_chief?: boolean;
  manager_id?: string | null; ab_person_id?: string;
  is_active: boolean; date_joined: string; last_login?: string; online?: boolean;
}
```

---

## 5. MANAGER Dashboard — Page by Page

### 5.1 Briefing / "Hjem"  (`/` → `BriefingView`)
Calm post-login welcome. Surfaces only signals worth acting on.

**Data entities:** today's team headline, focus cards (under-threshold count, team ja-rate trend, top-performer concentration), one analytical insight, footer totals, mascot mood.

**Endpoint (one composite call — the page is read-once):**
```
GET /api/dashboard/briefing/?date=YYYY-MM-DD
```
```ts
BriefingResponse = {
  manager_first_name: string;
  date: string; weekday: string; time_of_day: "morgen"|"dag"|"kveld";
  totals: { total_doors: number; contact_pct: number; active_count: number; total_count: number };
  signals: {
    ja_rate_today: number; ja_rate_delta_7: number; ja_spark: number[];        // 7 pts
    under_threshold_names: string[]; under_threshold_delta: number;
    top_concentration_pct: number; top_names: string[]; concentration_delta: number;
    sales_today: number; sales_avg: number; sales_std: number; sales_yesterday_delta_pct: number;
    mood_green_pct: number; mood_red_pct: number; all_campaigns_on_track: boolean;
    within_shift: boolean; minutes_since_activity: number; last_sale_minutes_ago: number;
  };
  campaign_at_risk: { name: string; ja_rate: number; pct_complete: number; days_left: number } | null;
  employees: { id:string; name:string; ja_prosent:number; dorer_per_dag:number; doors:number;
               consistency:number; hours_on_shift:number; under_threshold:boolean }[];
  campaigns:  { name:string; ja_rate:number; pct_complete:number; days_left:number }[];
}
```
> Maps 1:1 to `briefingLogic.ts → BriefingData`. The mascot state and focus cards are **derived client-side** from these fields; the API only ships facts.
> **Optimization:** single request, served from the analytics rollup (≤120 s stale ok). `Cache-Control: private, max-age=120`.

### 5.2 Main Dashboard (`/dashbord` → `DashboardV2`)
Dense command center: KPI strip, trend chart, mood ring, campaign health, leaderboard, live activity feed.

**Endpoints:**

1) **KPI strip** — `GET /api/dashboard/stats/?date_range=today&campaign_id=`
```ts
DashboardStats = {
  online_employees: { value:number; total:number };
  total_doors: { value:number; delta_pct:number };
  yes_rate: { value:number; delta_pct:number };       // %
  active_campaigns: { value:number };
  revenue: { amount:number; currency:"NOK"; spark:number[] };
  sales_today: { value:number; delta_pct:number };
}
```

2) **Trend chart** — `GET /api/dashboard/trends/?range=7d|30d|90d&campaign_id=`
```ts
DashboardTrends = { points: { date:string; doors:number; yes_rate:number }[] }
```

3) **Mood ring** — `GET /api/dashboard/mood-distribution/?campaign_id=`
```ts
{ segments: { mood:"on-fire"|"on-track"|"working-hard"|"needs-attention"|"new"; count:number }[] }
```
Mood is computed server-side per employee via the same rule the UI uses (`computeMood`): `new` if <7 days; `on-fire` if rankPercentile≤10 & ja≥1.3×min; `on-track` if both ≥ thresholds; `working-hard` if doors ok but ja low; `needs-attention` otherwise.

4) **Campaign health** — `GET /api/dashboard/campaign-health/`
```ts
{ campaigns: { id:string; name:string; target:number; current:number; employees:number; color:string; days_left:number }[] }
```

5) **Leaderboard** — `GET /api/dashboard/leaderboard/?metric=ja_rate|doors|consistency&limit=5`
```ts
{ entries: { rank:number; name:string; region:string; dorer_per_dag:number; ja_prosent:number;
             min_ja_prosent:number; min_dorer_per_dag:number; rank_percentile:number;
             days_on_platform:number; score:number; online:boolean }[] }
```

6) **Activity feed (live)** — `GET /api/dashboard/activities/filtered/` (cursor) **+** SSE `GET /api/stream/activities/`
```ts
ActivityRow = { id:string; time:string; agent:string; action:string; location:string; campaign?:string;
                tone:"info"|"success"|"warn"|"danger"|"neutral" }
```
> **Optimization:** the six widgets can also be fetched in ONE call `GET /api/dashboard/overview/` returning `{ stats, trends, mood, campaign_health, leaderboard, recent_activities }` to cut six round-trips to one on first paint; then the feed upgrades to SSE. Recommended.

### 5.3 Statistikk / Sales Activity (`/sales` → `SalesActivityView`)
Status-focused door-knock registrations, swim-lane timeline + grouped list, Dag/Periode toggle.

**Endpoints:**
- `GET /api/dashboard/sales/filtered/` — cursor or page; filters `campaign_id, employee_id, status, start_date, end_date, search`; `ordering=-ts`.
```ts
Reg = { id:string; ts:string; employee_id:string; employee:string; campaign_id:string;
        status:"ja"|"nei"|"ikke_hjemme"; city:string; postal_code:string }
FilteredSalesResponse = { results: Reg[]; ...page_info }
```
- `GET /api/dashboard/sales/summary/?...` → counts by status, hit-rate, by-hour + by-day buckets for the swim lanes (pre-bucketed server-side so the client never bins raw rows).
```ts
SalesActivitySummary = {
  by_status: { ja:number; nei:number; ikke_hjemme:number };
  by_hour:  { hour:number; ja:number; nei:number; ikke_hjemme:number }[];   // Dag view
  by_day:   { date:string; ja:number; nei:number; ikke_hjemme:number }[];   // Periode view
  by_employee_lane: { employee_id:string; employee:string; beads:{ ts:string; status:string }[] }[];
}
```
> **Optimization:** the swim lane needs many points; cap `beads` per lane (e.g. last 200) and expose `?detail=lane&employee_id=` for drill-down. Bucketing (`by_hour`/`by_day`) is a GROUP BY in SQL, not client work.

### 5.4 Rapport (`/rapport` → `RapportView`)
Hierarchical: Campaign → user list → user detail (cities → postal codes → addresses).

**Endpoints (drill-down, lazy):**
1. `GET /api/reports/table/?campaign_id=&start_date=&end_date=` → user summary rows + aggregate.
```ts
TableDataResponse = {
  users: { user_id:string; name:string; role:"employee"|"manager"; total_responses:number;
           total_cities:number; ja_percentage:number; nei_percentage:number; ikke_hjemme_percentage:number }[];
  summary: { total_users:number; total_responses:number; total_cities:number;
             date_range:{start_date:string|null;end_date:string|null};
             campaigns:{campaign_id:string;campaign_name:string}[] };
}
```
2. `GET /api/reports/user-addresses/?user_id=&campaign_id=&start_date=&end_date=` (loaded only when a user is expanded):
```ts
UserAddressResponse = {
  user_id:string; user_name:string; user_role:string; total_responses:number;
  cities: { city_name:string; total:number; ja_count:number; nei_count:number; ikke_hjemme_count:number;
            ja_percentage:number; nei_percentage:number; ikke_hjemme_percentage:number;
            addresses: { address_id:string|null; address_text:string; base_address:string;
                         apartment_number:string|null; status:string;
                         position:{lat:number;lng:number}|null; tags:Record<string,string>;
                         recorded_at:string|null; campaign_id:string|null; campaign_name:string|null }[] }[];
}
```
> **Optimization:** never ship all addresses with the user list — that's the classic N×M blowup. Step 1 is summary only; step 2 lazy-loads one user's addresses on expand. Paginate `cities`/`addresses` if a user exceeds ~500 addresses.

### 5.5 Analytics (`/analytics` → `AnalyticsView`)
The richest page. Tabs: Oversikt, Ansatte, Kampanjer, Varsler, Arbeidstid, Terskler.

**One composite preview call** powers Oversikt/Ansatte/Kampanjer/Varsler:
```
GET /api/dashboard/analytics/preview/?start_date=&end_date=&campaign_ids=&employee_ids=&manager_id=
```
```ts
AnalyticsPreviewResponse = {
  period: { start_date:string; end_date:string; days:number };
  summary: AnalyticsSummary;                  // total_doors, doors_per_day, status_counts, *_rate, contact_rate, unique_employees, avg_doors_per_employee
  previous_period_summary?: AnalyticsSummary; // for delta arrows
  comparisons?: Comparisons;
  campaigns: CampaignAnalytics[];             // per-campaign doors/rates/employees (Kampanjer tab)
  employees: EmployeeAnalytics[];             // per-employee full profile (Ansatte tab + ranking)
  daily_breakdown: { date:string; doors:number; ja:number; nei:number; ikke_hjemme:number }[];
  hourly_breakdown: { hour:number; doors:number }[];
  top_performers: { by_ja:..., by_doors:... };
  alerts: Alert[];                            // Varsler tab
  work_time_summary?: WorkTimeSummary;
}
EmployeeAnalytics = { employee_id:string; employee_name:string; total_doors:number; doors_per_day:number;
  ja:number; nei:number; ikke_hjemme:number; folg_opp:number; yes_rate:number; no_rate:number;
  not_home_rate:number; follow_up_rate:number; contact_rate:number;
  daily_door_counts: Record<string,number>; consistency_score:number }
Alert = { severity:"critical"|"warning"|"info"; type:string; employee_id:string; employee_name:string;
  message:string; metric:string; value:number; threshold:number; consecutive_days?:number;
  daily_details?: { date:string; doors:number; ja:number; yes_rate:number;
                    below_doors_threshold:boolean; below_yes_rate_threshold:boolean }[] }
```
**Arbeidstid tab** — `GET /api/dashboard/analytics/work-time-stats/?start_date=&end_date=&campaign_ids=`
```ts
WorkTimeStatsResponse = {
  period:{start_date:string;end_date:string;days:number};
  active_threshold_seconds:number;                 // 900 (15 min) — a user is "active" above this
  aggregate:{ employees:WorkTimeSummaryGroup; managers:WorkTimeSummaryGroup; combined:WorkTimeSummaryGroup };
  employees: WorkTimePersonEntry[]; managers: WorkTimePersonEntry[];
}
WorkTimePersonEntry = { id:string; name:string; total_seconds:number; total_minutes:number;
  avg_daily_seconds:number; avg_daily_minutes:number; is_active:boolean }
```
**Terskler tab** — Threshold CRUD (see §4.3).
**Report export** — `GET /api/dashboard/analytics/download/?...` → `application/pdf` blob; `POST /api/dashboard/analytics/trigger/ { recipient_emails }` → email async (return `202` + job id).
> **Optimization (critical):** `preview` aggregates potentially millions of rows. Back it with **rollup tables** keyed by `(date, employee_id, campaign_id)` storing daily door/ja/nei/contact counts + work seconds. The preview then sums small daily rows over the range — milliseconds, not a full-table scan. Refresh rollups incrementally on write (or every 5 min). Cache the composite response per `(role, filter-hash)` for 120 s. `daily_door_counts` should come straight from the rollup, never recomputed.

### 5.6 Oppgaver / Tasks (`/todo` → `OppgaverView`)
Mine / Tildelt av meg / Team; Board (Kanban) + Liste; role-aware assignment.

**Endpoints:**
- `GET /api/todos/todos/?perspective=mine|assigned_by_me|team&status=&assignee_id=&campaign=&ordering=due&page=`
```ts
Task = { id:string; title:string; description?:string; assigner_id:string; assignee_ids:string[];
         status:"todo"|"in_progress"|"done"; priority:"high"|"medium"|"low"; due:string; campaign?:string }
TodoListResponse = { results: Task[]; ...page_info }
```
- `POST /api/todos/todos/`, `PATCH /api/todos/todos/{id}/`, `DELETE`, `POST .../{id}/complete/`, `.../{id}/start/`
- Bulk: `POST .../bulk_complete/`, `.../bulk_delete/` `{ todo_ids:string[] }`
- Buckets: `.../today/`, `.../overdue/`, `.../upcoming/`, `.../stats/`
- Multi-assignee admin tasks: `/api/todos/admin/assigned-tasks/...` (`assign_users/`, `remove_users/`).
- Assignable users (role-aware): `GET /api/users/assignable/` (manager → employees+managers; admin → all).
> **Optimization:** Board view fetches all three columns — return them grouped (`?group_by=status`) so the client doesn't make 3 calls. Drag-drop status change is a single `PATCH` with `Idempotency-Key`.

### 5.7 Områder / Areas (`/areas` → `OmraderView`)
Map of polygons + workload dock + assignment modals. See §4.2.
- `GET /api/areas/areas/with_campaigns/?geometry=simplified` for the map.
- `GET /api/areas/areas/{id}/geometry/` for full polygon on focus.
- Assignment endpoints per §4.2.
> **Optimization:** never load all full polygons at once. Simplified geometry in list, full on demand, and consider vector tiles if area count grows into the thousands.

### 5.8 Kampanjer (`/campaigns` → `KampanjeView`)
List/grid + detail sheet. See §4.1. Adds per-campaign sales:
```ts
CampaignListItem = Campaign & { areas:number; employee_ids:string[]; sales_week:number; sales_lifetime:number; created:string }
```
`GET /api/campaigns/campaigns/?expand=stats&ordering=-sales_week&status=&search=`.

### 5.9 Salgssjef-team (`/salgssjef-team`)
Sales-chief team management.
- `GET /api/users/sales-chief/team/` → members + per-member perf + online status.
- `GET /api/users/sales-chief/available-people/` (to add)
- `POST .../team/add/`, `.../team/bulk-add/`, `DELETE .../team/{user_id}/remove/`, `POST .../team/bulk-remove/`.

### 5.10 Legg til adresse (`/uploaded-addresses` → `AddAddressView`)
Bulk address upload + management.
- `POST /api/dashboard/addresses/upload/` (multipart CSV) → `202` + `{ job_id }`; poll `GET .../upload/{job_id}/` for `{ status, processed, errors[] }`.
- `GET /api/dashboard/addresses/?campaign_id=&area_id=&status=&page=` paginated list.
> **Optimization:** parse uploads **async** (job queue), stream progress; never block the request on a 50k-row CSV.

---

## 6. ADMIN Dashboard — Page by Page

Admin = manager privileges + global scope + user management + learning admin. All §5 endpoints apply globally (no `manager_id` auto-scope).

### 6.1 Admin Main Dashboard / User Management (`/admin-dashboard/admin-main-dashboard`)
CRUD over managers/employees/superusers + promotions.
- `GET /api/users/managers/?page=&search=&ordering=` · `/employees/` · `/users/superusers/`
- `GET /api/users/stats/` → `{ total, managers, employees, superusers }` (one call for the header counters)
- `POST /api/users/auth/register/` (create) · `PATCH /api/users/{id}/` · `DELETE /api/users/{id}/`
- Promotions: `POST /api/users/promote-employee-to-manager/`, `.../promote-manager-to-superuser/`, `.../demote-superuser-to-manager/` `{ user_id }`.
- Superuser-specific: `POST /api/users/users/create_superuser/`, `GET /api/users/users/superusers/`, `DELETE /api/users/users/{id}/delete_superuser/`.
```ts
// List item is the shared User (§4.5). Filter by role server-side: ?role=manager|employee|superuser
```
> **Optimization:** one `users/stats/` call for counters; paginate the grids (page_size 20); `search` server-side across name/email/ab_person_id.

### 6.2 Admin Tasks (`/admin/tasks`)
See §5.6 admin-assigned-tasks endpoints. Multi-assignee, filterable, paginated.

### 6.3 Demographics Map (`/map`)
Areas + demographic overlays + per-area sales heatmap.
- `GET /api/areas/areas/with_campaigns/?geometry=simplified`
- `GET /api/dashboard/heatmap/?metric=ja_rate|doors&campaign_id=` → `{ area_id, value }[]` (join client-side to polygons).

### 6.4 Lock/Unlock Areas (`/las-opp-las-omrader/*`)
- `GET /api/areas/areas/?status=available|locked&page=`
- `POST /api/areas/areas/bulk-lock/` `{ area_ids, lock_until? }` · `POST .../bulk-unlock/` `{ area_ids }`.

---

## 7. EMPLOYEE Dashboard — Page by Page

> **Identity is always the authenticated user.** These endpoints ignore client-supplied employee ids. All return ONLY that employee's data.

### 7.1 Briefing (`/employee` → `EmployeeBriefingView`)
Yesterday recap (achieved? happy/sad mascot) + today's goal (= admin daily-door threshold; falls back to global).

**Endpoint:**
```
GET /api/employee/me/briefing/?date=YYYY-MM-DD
```
```ts
EmployeeBriefingResponse = {
  first_name: string; weekday: string; date_str: string;
  time_of_day: "morgen"|"dag"|"kveld"; within_shift: boolean;
  goal_status: {
    yesterday_doors: number;
    yesterday_goal: number;        // the effective admin threshold for yesterday
    yesterday_achieved: boolean;   // yesterday_doors >= yesterday_goal
    yesterday_pct: number;         // doors / goal (0..1+)
    today_goal: number | null;     // null → frontend falls back to global_default
    has_today_goal: boolean;
    global_default: number;        // GLOBAL_THRESHOLD.doorsDay (70)
  };
  streak_days: number;
  doors_today: number;             // for the live ring preview
}
```
- **Mascot logic (client-side from `goal_status`):** `win-big` if yesterday_pct ≥ 1.2; `win-small` if achieved; `ready` if ≥0.75; `concerned` otherwise. Maps to `selectBriefingMascot`.
- **Goal source:** `today_goal` / `yesterday_goal` come from the **effective Threshold** (§4.3) `min_doors_per_day` for this employee on the active campaign. If the admin hasn't set a goal for the date, return `today_goal: null` and the UI uses `global_default`.
> **Optimization:** trivially small payload; served from the daily rollup for "yesterday" and the threshold table. `Cache-Control: private, max-age=300` (yesterday is immutable; today's doors update via the dashboard, not here).

### 7.2 Gamified Dashboard (`/employee/dashbord` → `EmployeeDashboardView`)
Goal ring, streak (loss-aversion), today's journey, response donut, pace, milestone celebration.

**Endpoint (one call, live-ish):**
```
GET /api/employee/me/today/?campaign_id=
```
```ts
EmployeeDayResponse = {
  first_name: string; weekday: string; date_str: string;
  time_of_day: "morgen"|"dag"|"kveld"; within_shift: boolean;
  doors_today: number; door_goal: number;          // door_goal = effective threshold doorsDay
  ja_today:number; nei_today:number; ikke_hjemme_today:number; folg_opp_today:number;
  sales_today:number; ja_prosent:number; ja_prosent_delta:number;  // pp vs own 7-day avg
  streak_days:number; streak_at_risk:boolean; streak_min_doors:number;
  personal_best_doors:number; is_new_best:boolean;
  avg_doors_7:number; week_activity:number[]; week_labels:string[];
  journey: { time:string; outcome:"ja"|"nei"|"ikke-hjemme"|"folg-opp" }[];
  follow_ups: { name:string; address:string; note:string; time:string }[];
}
```
Maps 1:1 to `employeeLogic.ts → EmployeeDayData`. Milestone (goal/best/streak) and mood are derived client-side.
> **Optimization:** `journey` is today-only (bounded). Refresh via SSE `GET /api/stream/employee/me/` pushing `{doors_today, ja_today, ...}` deltas so the ring/streak update live without polling. Otherwise poll `?since=` every 15 s with ETag.

**Register sale** (the "Registrer salg" action, currently a no-op):
```
POST /api/employee/me/registrations/  { status, address?, campaign_id, position?, ts? }   [Idempotency-Key]
→ 201 { id, ... }  and the today rollup increments.
```

### 7.3 Statistikk (`/employee/stats` → `EmployeeStatsView`)
Per-employee mirror of admin analytics: Oversikt / Per kampanje / Arbeidstid / Terskler.

**Endpoint (composite, per period):**
```
GET /api/employee/me/stats/?start_date=&end_date=     (default last 30 days)
```
```ts
EmployeeStatsResponse = {
  first_name:string; period_label:string;
  // aggregate across campaigns
  total_doors:number; dorer_per_dag:number; ja_prosent:number; contact_pct:number;
  ja:number; nei:number; ikke_hjemme:number; folg_opp:number;
  consistency:number; total_min:number; avg_daily_min:number; active_days:number;
  applied_threshold: Threshold;                 // the effective GLOBAL threshold for this employee
  campaigns: CampaignPerf[];
  week_activity: { label:string; doors:number; ja:number }[];
}
CampaignPerf = {
  id:string; name:string; color:string;
  threshold: Threshold;                          // effective per-campaign threshold (override or global)
  threshold_scope: "global"|"kampanje";
  doors:number; days_worked:number; dorer_per_dag:number; week_doors:number;
  ja:number; nei:number; ikke_hjemme:number; folg_opp:number;
  ja_prosent:number; nei_prosent:number; contact_pct:number;
  consistency:number; total_min:number; avg_daily_min:number;
  daily: { date:string; doors:number; ja:number }[];   // ~14 pts for the per-campaign sparkline
}
```
- **Terskler tab** compares the employee's measured values to each threshold field (`doorsDay→dorer_per_dag`, `minJa→ja_prosent`, `minContact→contact_pct`, `doorsWeek→week_doors`). The API already ships both the measured aggregates and `applied_threshold`, so the pass/fail is computed client-side (`evalThreshold`). The per-campaign override comparison uses `CampaignPerf.threshold`.
- **Arbeidstid tab** uses `total_min`, `avg_daily_min`, `active_days`, and per-campaign `avg_daily_min`.
> **Optimization:** identical rollup story as Analytics, scoped to one employee — sums small daily rows. `daily` capped to the requested window (default 14–30 pts). Cache 120 s per `(employee, period)`.

### 7.4 Employee campaign picker / completion gating
- `GET /api/campaigns/campaigns/assigned_to_me/` (employee's campaigns; lean).
- `GET /api/learning/campaign-completion-check/?campaign_id=` → gates AB Maps/Academy (see §8). **Untouched** by redesign.

---

## 8. Learning Platform (Academy)

### 8.1 Employee (student)
- `GET /api/learning/me/` → `UserOverview` (name, overall_progress_percent, learning_streak_days, total_learning_time_minutes, quiz_avg_score, lessons_completed/total).
- `GET /api/learning/me/progress/` · `.../detailed/` · `.../current-path/`.
- `GET /api/learning/sections/grouped_by_campaign/` → campaigns → sections (status, progress, lesson counts).
- `GET /api/learning/sections/{id}/` → section + lessons; `.../prerequisites/`.
- `GET /api/learning/lessons/{id}/` (TEXT/VIDEO/QUIZ + questions).
- `POST .../lessons/{id}/start/`, `.../complete/ {seconds}`, `.../pause/`, `.../resume/`, `.../quiz-submit/ {score_percent,duration_seconds}`.
- `GET /api/learning/campaign-completion-check/?campaign_id=` →
```ts
CampaignCompletionResponse = { all_completed:boolean; campaign_id:string|null; campaign_name:string;
  total_sections:number; completed_sections:number; is_assigned_to_campaign:boolean;
  incomplete_sections:{ section_id:string; section_title:string; section_order:number;
    progress_percent:number; status:"NOT_STARTED"|"IN_PROGRESS"|"COMPLETED"; completed_at:string|null }[] }
```

### 8.2 Admin (learning)
- Overview: `GET /api/learning/admin/stats/overview/?include_content_status&include_recent_activity&activity_limit=20`.
- Sections CRUD + `reorder/`, `{id}/duplicate/`, `bulk-operations/`. Lessons CRUD + `reorder/`, `duplicate/`, `deletion_preview/`, `create_with_quiz/`, `update_with_quiz/`.
- Quiz questions CRUD.
- Analytics: `stats/staff/`, `stats/section-completion/`, `stats/activity-7d/`.
- User progress admin: `user-progress/all_users_progress/`, `.../user_progress/?user_id=`, `reset_progress/`, `override_completion/`, `override_quiz_score/`.
> All admin learning lists paginate (page_size 20) and accept `?campaign=&section=&kind=&search=`.

---

## 9. Performance & Optimization Playbook

### 9.1 The rollup/materialized-view strategy (most important)
Door-knock registrations are the high-volume table. **Never** aggregate it live for dashboards.
- Maintain `daily_rollup(date, employee_id, campaign_id, doors, ja, nei, ikke_hjemme, folg_opp, work_seconds)`.
- Update incrementally on each registration write (cheap upsert) or via a 5-minute batch.
- All analytics/briefing/stats endpoints read the rollup, summing a handful of daily rows over the range. Turns a full scan into an index range scan.
- Keep `consistency_score` and `rank_percentile` as nightly-computed columns.

### 9.2 Indexing
- Registrations: composite index on `(employee_id, ts)`, `(campaign_id, ts)`, `(ts)`; partial index on recent rows for the live feed.
- Rollups: `(date, employee_id, campaign_id)` PK.
- Areas: GIST index on `polygon_geometry` for spatial queries.
- Users: index `(manager_id)`, `(user_type)`, trigram index on `name`/`email` for `search`.

### 9.3 Payload shaping
- Lean-by-default; `expand=` for nested; `fields=` for sparse.
- Strip nulls server-side where the client treats absent == null.
- Geometry: simplified in lists, full on demand, or vector tiles.
- Numbers pre-rounded to the precision the UI shows (1 decimal for rates) to shrink JSON.

### 9.4 Round-trip reduction
- Composite endpoints for read-once pages: `/dashboard/overview/`, `/dashboard/analytics/preview/`, `/employee/me/today/`, `/employee/me/stats/`, `/dashboard/briefing/`. One call per page on first paint.
- Batch reference data (`all_campaigns/`, `assignable/`) and cache 60 s.

### 9.5 Caching layers
1. **CDN/edge**: none for private data; use it only for static/learning media.
2. **App response cache**: keyed `(user_id|role, endpoint, filter-hash)`, TTL 60–300 s for analytics; bust on relevant writes.
3. **Conditional requests**: ETag/304 everywhere (esp. polling fallbacks).
4. **Client**: SWR/React-Query with `staleTime` matching server `max-age`.

### 9.6 Pagination cadence recap
| Data | Strategy | Page size | Notes |
|------|----------|-----------|-------|
| Activity / sales feed | Cursor | 50 | + SSE for live tail |
| User / section / lesson tables | Offset | 20 | numbered pages |
| Todos | Offset | 25 | grouped by status for Board |
| Rapport addresses | Offset (lazy) | 100 | only on user expand |
| Analytics preview | none (bounded composite) | — | rollup-backed |
| Areas (map) | none / bbox | — | filter by viewport bbox `?bbox=` for huge sets |

### 9.7 Real-time recap
- SSE channels: `/api/stream/activities/` (manager feed), `/api/stream/employee/me/` (employee live ring), `/api/stream/presence/` (online dots).
- Heartbeat 30 s; reconnect with `Last-Event-ID` to resume.
- Polling fallback always available with `?since=` + ETag.

### 9.8 Async & jobs
- CSV address upload, PDF report download, email report trigger → return `202 {job_id}`; poll `GET /jobs/{job_id}/` `{status, progress, result_url?}`. Never block request threads on long work.

### 9.9 Observability
- `request_id` on every response; structured logs; p50/p95/p99 per endpoint; slow-query log on the rollup reads; alert if `preview` p95 > 400 ms.

---

## 10. Endpoint Index

### Auth & Users
```
POST   /api/users/auth/login|refresh|logout/        GET /api/users/auth/verify/
GET    /api/users/{managers|employees}/             GET /api/users/users/superusers/
GET    /api/users/stats/                            POST /api/users/auth/register/
PATCH  /api/users/{id}/   DELETE /api/users/{id}/
POST   /api/users/{promote-employee-to-manager|promote-manager-to-superuser|demote-superuser-to-manager}/
GET    /api/users/assignable/                       GET /api/users/sales-chief/team/ (+add/remove/bulk)
```
### Campaigns / Areas
```
GET    /api/campaigns/campaigns/ (+all_campaigns|my_campaigns|assigned_to_me|{id}/areas)
GET    /api/areas/areas/ (+my_areas|assigned_areas|assigned_to_me|with_campaigns|{id}/geometry|{id}/employees)
POST   /api/areas/areas/{bulk-lock|bulk-unlock}/
```
### Dashboard (Manager/Admin)
```
GET /api/dashboard/briefing/                 GET /api/dashboard/overview/
GET /api/dashboard/{stats|trends|mood-distribution|campaign-health|leaderboard}/
GET /api/dashboard/activities/{filtered|summary}/   SSE /api/stream/activities/
GET /api/dashboard/sales/{filtered|summary}/
GET /api/dashboard/analytics/preview/        GET /api/dashboard/analytics/work-time-stats/
GET /api/dashboard/analytics/download/       POST /api/dashboard/analytics/trigger/
GET/POST /api/dashboard/analytics/thresholds/  PATCH/DELETE .../{id}/   GET .../effective/
GET /api/dashboard/heatmap/                  POST /api/dashboard/addresses/upload/  GET /api/dashboard/addresses/
GET /api/reports/{table|user-addresses}/
```
### Todos
```
GET/POST /api/todos/todos/   PATCH/DELETE .../{id}/   POST .../{id}/{start|complete}/
POST /api/todos/todos/{bulk_complete|bulk_delete}/   GET .../{today|overdue|upcoming|stats}/
POST /api/todos/admin/assigned-tasks/{assign_task|{id}/assign_users|{id}/remove_users}/
```
### Employee (self-scoped)
```
GET  /api/employee/me/briefing/        GET /api/employee/me/today/    SSE /api/stream/employee/me/
GET  /api/employee/me/stats/           POST /api/employee/me/registrations/
GET  /api/campaigns/campaigns/assigned_to_me/
```
### Learning
```
GET  /api/learning/me/(+progress|progress/detailed|progress/current-path)
GET  /api/learning/sections/(grouped_by_campaign|{id}|{id}/prerequisites)
GET  /api/learning/lessons/{id}/   POST .../{start|complete|pause|resume|quiz-submit}/
GET  /api/learning/campaign-completion-check/
GET  /api/learning/admin/stats/{overview|staff|section-completion|activity-7d}/
*    /api/learning/admin/{sections|lessons|quiz-questions}/ (CRUD + reorder/duplicate/bulk)
*    /api/learning/admin/user-progress/{all_users_progress|user_progress|reset_progress|override_completion|override_quiz_score}/
```

---

### How to extend ("how should we be able to do more here")
- **New metric on a card?** Add the field to the relevant rollup + composite response; the UI reads it directly. Don't add a new endpoint per metric.
- **New filter?** Add a whitelisted query param + index; document it here.
- **New role view?** Reuse the same endpoints with server-side scoping; add a `scope`/`perspective` param rather than forking endpoints.
- **New page?** Prefer one composite read endpoint mapping to the page's view-model (as done for briefing/analytics/employee), backed by rollups, cached, with cursor/offset pagination per §2.

> Keep the contract aligned with the TypeScript interfaces in `components/dashboard/v2/**` and `services/**`; those are the live shapes the UI already expects. When the backend lands, replace the mock generators (`briefingLogic.ts`, `employeeLogic.ts`, the v2 mock arrays) with these calls — field names here are chosen to match.
