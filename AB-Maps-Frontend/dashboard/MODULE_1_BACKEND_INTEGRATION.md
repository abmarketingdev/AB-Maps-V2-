# Module 1 — Backend Integration Guide (Auth + Briefings)

> **For the frontend Claude.** This document describes the **backend endpoints
> that are now LIVE and tested** for Module 1 of `API_SPECIFICATION.md`, the
> exact response shapes they return, the few places they differ from the spec,
> and step-by-step instructions to swap the mock generators for real calls.
>
> Scope of Module 1: **Authentication** (§3), **Manager/Admin Briefing** (§5.1),
> **Employee Briefing** (§7.1), the **effective-threshold** helper (§4.3), plus
> a new **`doors`** field on Areas. Everything else in the spec is NOT built yet
> — keep those pages on mock data for now.

---

## 0. Conventions

- **Base URL:** `{NEXT_PUBLIC_API_URL}/api/...` (unchanged).
- **Auth header:** `Authorization: Bearer {access}` on every authed call.
- **Access token lifetime:** `expires_in = 28800` seconds (8 h). Refresh proactively.
- **Dates:** date-only query params are `YYYY-MM-DD`. Timestamps are ISO-8601.
- **Percentages:** plain numbers, 1 decimal (e.g. `40.0` means 40 %), matching the spec.
- All these endpoints return the **object directly** (no pagination envelope).

---

## 1. Authentication — LIVE ✅

Canonical base path is **`/api/users/auth/`** (use this). The older
`/api/auth/...` stack still works and now returns an identical shape, but treat
`/api/users/auth/` as the source of truth.

### 1.1 Login
```
POST /api/users/auth/login/
Body: { "username": string, "password": string }
```
**200 response (exact):**
```jsonc
{
  "access": "eyJ...",
  "refresh": "eyJ...",
  "expires_in": 28800,
  "user_id": "uuid (auth user id)",
  "username": "erik",
  "email": "erik@ex.no",
  "user_type": "employee",            // see note below
  "is_sales_chief": false,
  "user_info": {
    "id": "uuid (DOMAIN id: Employee.id or Manager.id)",
    "name": "Erik Befjelde",
    "email": "erik@ex.no",
    "manager_id": "uuid | null",      // for employees: the owner of their team
    "ab_person_id": "string | null",
    "employee_type": "maps_emp",      // employees only
    "admin_type": "maps_admin"        // superusers only
  }
}
```

> **⚠️ `user_type` divergence from the spec.** The spec types `user_type` as
> `"manager" | "employee"` (with admin = manager + is_superuser). The backend
> actually returns **one of four** values:
> - `"employee"` — has an Employee record
> - `"manager"` — has a Manager record, not an admin
> - `"superuser"` — admin (is_superuser **and** is_staff); also has a Manager record
> - `"admin"` — rare fallback (a bare user with no domain record)
>
> **Frontend action:** treat `"superuser"` (and `"admin"`) as **admin**, and
> `"manager"`/`"superuser"`/`"admin"` all as having manager-level dashboard
> access. Suggested helper:
> ```ts
> const isAdmin = ut => ut === "superuser" || ut === "admin";
> const isManagerLevel = ut => ut !== "employee";
> ```

> **`user_info.id` is the DOMAIN id** (Employee.id / Manager.id), **not**
> `user_id`. Use `user_info.id` when calling domain endpoints; use `user_id`
> only for auth. (This matches the spec's intent of never leaking the auth id
> into domain payloads.)

### 1.2 Refresh
```
POST /api/users/auth/refresh/
Body: { "refresh": string }
→ 200 { "access": "eyJ...", "expires_in": 28800 }
→ 401 { "error": "Invalid or blacklisted token", "detail": "..." }
```
A refresh token that was logged out is now **rejected with 401** — on a 401 here,
force re-login.

### 1.3 Logout
```
POST /api/users/auth/logout/
Body: { "refresh": string }
→ 200 { "message": "Successfully logged out", "timestamp": "ISO-8601" }
```
This blacklists the refresh token server-side. Clear localStorage after.

### 1.4 Verify
```
GET /api/users/auth/verify/      (Authorization: Bearer {access})
→ 200 {
  "valid": true,
  "user_id": "...", "username": "...", "email": "...",
  "user_type": "...", "user_info": { ...same as login... },
  "is_sales_chief": false,
  "timestamp": "ISO-8601"
}
```
Use this to re-hydrate the user on app load. (`GET /api/users/auth/verify-public/`
exists too and does the same without DRF auth — prefer `verify/`.)

**Integration:** the auth service / `apiConfig.ts` login flow should already match
this; the only changes needed are (a) handle the 4 `user_type` values, and (b)
read `user_info.manager_id` (now present).

---

## 2. Teams & manager_id — context you need

There was no real "team" concept before; there is now. A **manager owns a team**;
its members are employees and/or other managers. This drives two things you'll
see in responses:

- **`user_info.manager_id`** on an employee login = the Manager who owns the team
  the employee belongs to (`null` if unassigned).
- **Manager/admin briefing scoping**: a manager's briefing aggregates only their
  team's employees; an admin sees everyone. You don't pass anything for this —
  it's derived from the token.

There are **no team-management UI endpoints in Module 1** (add/remove members
come later). Nothing to build here yet.

---

## 3. Manager / Admin Briefing — LIVE ✅  (spec §5.1)

```
GET /api/dashboard/briefing/?date=YYYY-MM-DD     (date optional → defaults to today, Europe/Oslo)
Authorization: Bearer {access}      (manager or admin token; employees get 403)
Cache-Control: private, max-age=120
```

**Response matches `BriefingResponse` from the spec exactly.** Confirmed shape:
```jsonc
{
  "manager_first_name": "Mona",
  "date": "2026-05-23",
  "weekday": "lørdag",                 // Norwegian, lowercase
  "time_of_day": "morgen|dag|kveld",
  "totals": { "total_doors": 5, "contact_pct": 100.0, "active_count": 1, "total_count": 1 },
  "signals": {
    "ja_rate_today": 40.0,
    "ja_rate_delta_7": 12.5,
    "ja_spark": [0.0, 0.0, 0.0, 0.0, 0.0, 25.0, 40.0],   // 7 points, oldest→today
    "under_threshold_names": ["..."],
    "under_threshold_delta": 0,        // not yet historical — always 0 for now
    "top_concentration_pct": 100.0,
    "top_names": ["Erik Emp"],
    "concentration_delta": 0,          // always 0 for now
    "sales_today": 2,
    "sales_avg": 0.4,
    "sales_std": 0.7,
    "sales_yesterday_delta_pct": 100.0,
    "mood_green_pct": 100.0,
    "mood_red_pct": 0.0,
    "all_campaigns_on_track": true,
    "within_shift": false,
    "minutes_since_activity": 12,
    "last_sale_minutes_ago": 30
  },
  "campaign_at_risk": null,            // or { name, ja_rate, pct_complete, days_left }
  "employees": [
    { "id":"uuid", "name":"Erik Emp", "ja_prosent":17.6, "dorer_per_dag":2.4,
      "doors":17, "consistency":83.0, "hours_on_shift":0.0, "under_threshold":false }
  ],
  "campaigns": [
    { "name":"Kampanje A", "ja_rate":17.6, "pct_complete":17.0, "days_left":0 }
  ]
}
```

**Notes / intentional deviations:**
- **Employee rows aggregate the last 7 days** (so `ja_prosent`/`consistency` are
  meaningful); `doors` is the 7-day total, `dorer_per_dag` the daily average.
  `totals.total_doors` and `signals.ja_rate_today`/`sales_today` are **today**.
- **`days_left` is always `0`** — this system has no campaign timeline (by design).
  Don't render a countdown; treat `pct_complete` as the progress signal.
- **`pct_complete` = doors knocked ÷ total doors available** in the campaign's
  areas (computed from real address counts). Genuine 0..100.
- `under_threshold_delta` / `concentration_delta` are placeholders (`0`) until a
  historical baseline exists — render without the delta arrow, or hide it.

**Integration:** replace the mock generator behind `briefingLogic.ts →
BriefingData` with this call. The fields are named to map 1:1; mascot/focus-card
logic stays client-side as the spec says.

---

## 4. Employee Briefing — LIVE ✅  (spec §7.1)

```
GET /api/employee/me/briefing/?date=YYYY-MM-DD    (date optional → today)
Authorization: Bearer {access}      (employee token; non-employees get 403)
Cache-Control: private, max-age=300
```
**Identity is the token. Any `?employee_id=` is ignored** (security rule §7).

**Response (exact):**
```jsonc
{
  "first_name": "Erik",
  "weekday": "lørdag",
  "date_str": "2026-05-23",
  "time_of_day": "morgen|dag|kveld",
  "within_shift": false,
  "goal_status": {
    "yesterday_doors": 4,
    "yesterday_goal": 2,
    "yesterday_achieved": true,
    "yesterday_pct": 2.0,            // doors / goal (0..1+)
    "today_goal": 2,                 // see note
    "has_today_goal": true,
    "global_default": 70
  },
  "streak_days": 3,
  "doors_today": 5
}
```

**Note:** the spec allowed `today_goal: null` (→ fall back to `global_default`).
The backend **always resolves an effective goal**, so `today_goal` is a number
and `has_today_goal` is `true`. The `global_default` (70) is still sent for the
fallback path, but you won't normally hit it.

**Integration:** replace the mock behind `employeeLogic.ts` briefing path. Mascot
selection stays client-side (`selectBriefingMascot` from `goal_status`).

> **NOT yet built (keep on mock):** `GET /api/employee/me/today/` (gamified
> dashboard), `GET /api/employee/me/stats/`, `POST /api/employee/me/registrations/`.

---

## 5. Effective Threshold — LIVE ✅  (spec §4.3)

```
GET /api/dashboard/analytics/thresholds/effective/?employee_id=&campaign_id=
Authorization: Bearer {access}
```
Returns the single resolved `Threshold` (most-specific wins: employee > campaign
> manager > global > defaults), serialized like the existing threshold objects.
**Employees may only resolve their own** — for an employee token, any
`employee_id` you pass is overridden to their own id.

The Threshold CRUD endpoints (`GET/POST /api/dashboard/analytics/thresholds/`,
`PATCH/DELETE .../{id}/`) already existed and are unchanged.

---

## 6. Areas — `doors` field added ✅

Area responses (list, detail, geo, nearby, `with_campaigns`) now include:
```jsonc
{ "house_count": 2, "apartment_count": 725, "doors": 727 }
```
`doors = house_count + apartment_count`, auto-computed from the national address
table when an area's polygon is created or changed. Use `doors` wherever you show
"addresses/doors in this area". (The rest of the Areas page is unchanged from the
current backend — no other Module-1 changes there.)

---

## 7. What is NOT built yet (stay on mock data)

Everything in the spec **except** the four things above. In particular do **not**
wire these yet — they 404 or don't exist:
`/dashboard/overview`, `/dashboard/stats` (v2 shape), `/dashboard/trends` (v2
shape), `/dashboard/mood-distribution`, `/dashboard/campaign-health`,
`/dashboard/sales/summary`, `/dashboard/heatmap`, `/employee/me/today`,
`/employee/me/stats`, `/employee/me/registrations`, SSE streams, async address
upload, `/users/stats`, `/users/assignable`. These come in later modules.

---

## 8. Testing tips

- **The dev database's door-knock data is historical** (~8 months old). A live
  call for *today* will return mostly zeros — that is correct, not a bug. To see
  populated briefings during integration, call with a `?date=` inside the data's
  range, e.g. `?date=2025-09-15`, or ask backend to seed recent rows.
- Quick manual check (replace TOKEN):
  ```bash
  curl -s -H "Authorization: Bearer TOKEN" \
    "$NEXT_PUBLIC_API_URL/api/dashboard/briefing/?date=2026-05-23" | jq
  ```
- Login → use `access` as the bearer for the briefing calls. Confirm an employee
  token gets `403` on `/api/dashboard/briefing/` and a manager token gets data.

---

## 9. Integration checklist

- [ ] Auth: handle 4 `user_type` values (map `superuser`/`admin` → admin); read
      `user_info.manager_id`; use `user_info.id` (domain id) for domain calls.
- [ ] On `refresh` 401 → force re-login (token was blacklisted/expired).
- [ ] Manager Briefing: swap `briefingLogic.ts` mock → `GET /api/dashboard/briefing/`.
      Hide/ignore `days_left` (always 0) and the `*_delta` placeholders.
- [ ] Employee Briefing: swap `employeeLogic.ts` briefing mock →
      `GET /api/employee/me/briefing/`. `today_goal` is always a number.
- [ ] Areas: read the new `doors` field.
- [ ] Leave all other pages on mock data until their backend module ships.
