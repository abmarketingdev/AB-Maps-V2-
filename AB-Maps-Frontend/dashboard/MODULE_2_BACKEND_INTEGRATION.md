# Module 2 — Backend Integration Guide (Employee Dashboard)

> **For the frontend Claude.** Module 2 makes the **Employee Dashboard** pages
> live. Read `MODULE_1_BACKEND_INTEGRATION.md` first for auth/conventions — the
> same base URL, `Authorization: Bearer {access}` header, and the
> historical-data testing caveat all apply here.
>
> Scope: **§7.2 gamified dashboard** (`/employee/me/today/`), **§7.2 register a
> door-knock** (`/employee/me/registrations/`), and **§7.3 employee stats**
> (`/employee/me/stats/`). All three are **self-scoped to the authenticated
> employee** — any client-supplied `employee_id` is ignored, and non-employees
> get **403**.

---

## 1. Gamified Dashboard — LIVE ✅  (spec §7.2)

```
GET /api/employee/me/today/?campaign_id=&date=YYYY-MM-DD
Authorization: Bearer {access}     (employee token)
Cache-Control: private, max-age=30
```
- `campaign_id` (optional) scopes all numbers to one campaign.
- `date` (optional) defaults to today (Europe/Oslo). Useful for testing against
  historical data.

**Response = `EmployeeDayResponse` (spec §7.2), exact:**
```jsonc
{
  "first_name": "Erik",
  "weekday": "lørdag",
  "date_str": "2026-05-23",
  "time_of_day": "morgen|dag|kveld",
  "within_shift": false,
  "doors_today": 5,
  "door_goal": 2,                    // effective threshold min_doors_per_day
  "ja_today": 2, "nei_today": 2, "ikke_hjemme_today": 0, "folg_opp_today": 1,
  "sales_today": 2,                  // == ja_today
  "ja_prosent": 40.0,
  "ja_prosent_delta": 5.0,           // pp vs own 7-day avg
  "streak_days": 3,
  "streak_at_risk": false,           // true when streak>0 AND doors_today<door_goal
  "streak_min_doors": 2,             // == door_goal
  "personal_best_doors": 5,
  "is_new_best": true,
  "avg_doors_7": 3.0,
  "week_activity": [4,4,4,0,0,0,5],  // 7 ints, oldest→today
  "week_labels": ["man","tir","ons","tor","fre","lør","søn"],
  "journey": [ { "time": "10:00", "outcome": "ja|nei|ikke-hjemme|folg-opp" } ],
  "follow_ups": [ { "name": "", "address": "Storgata 1", "note": "", "time": "10:00" } ]
}
```

**Notes:**
- `outcome` uses **kebab-case** (`ikke-hjemme`, `folg-opp`) exactly as the spec's
  `EmployeeDayResponse.journey` expects.
- `follow_ups[].name` is always `""` — there is no contact-name field in the data
  model; use `address` for display.
- Milestone/mood selection stays **client-side** from these fields (per spec).
- Maps 1:1 to `employeeLogic.ts → EmployeeDayData`. Swap that mock generator for
  this call. For live updates, **poll this endpoint** (SSE is a later module).

---

## 2. Register a door-knock — LIVE ✅  (spec §7.2 "Registrer salg")

```
POST /api/employee/me/registrations/
Authorization: Bearer {access}     (employee token)
Body (JSON):
{
  "status": "ja|nei|ikke_hjemme|folg_opp",   // required
  "address": "Storgata 1",                    // optional (defaults to "")
  "campaign_id": "uuid",                       // optional
  "position": { "lat": 59.91, "lng": 10.75 }, // optional (GeoJSON Point also accepted)
  "nei_subcategory": "ikke_interessert|darlig_erfaring|bindingstid|bedrift|pris|eksisterende_kunde",
                                               // only when status == "nei"
  "notes": "optional string"
}
→ 201 { ...full Address object (id, status, recorded_at, campaign, employee, ...) }
```
- The employee is taken from the token; a client-supplied `employee_id` /
  `manager_id` in the body is **ignored**.
- `ts` is ignored (the server timestamps with `recorded_at`).
- After a successful POST, re-fetch `/me/today/` to refresh the ring/journey.
- `Idempotency-Key` header is accepted but not yet de-duplicated server-side —
  still send it; just don't rely on dedup for now.

---

## 3. Employee Stats — LIVE ✅  (spec §7.3)

```
GET /api/employee/me/stats/?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
Authorization: Bearer {access}     (employee token)
Cache-Control: private, max-age=120
```
Both dates optional; default is **last 30 days**.

**Response = `EmployeeStatsResponse` (spec §7.3), exact:**
```jsonc
{
  "first_name": "Erik",
  "period_label": "2026-04-23 – 2026-05-23",
  "total_doors": 17, "dorer_per_dag": 0.6, "ja_prosent": 29.4, "contact_pct": 100.0,
  "ja": 5, "nei": 12, "ikke_hjemme": 0, "folg_opp": 0,
  "consistency": 78.0,
  "total_min": 412, "avg_daily_min": 103, "active_days": 4,
  "applied_threshold": { ...Threshold object (see §4.3 of the spec)... },
  "campaigns": [
    {
      "id": "uuid", "name": "Kampanje A", "color": "#10b981",
      "threshold": { ...Threshold... },
      "threshold_scope": "global|kampanje",
      "doors": 17, "days_worked": 4, "dorer_per_dag": 0.6, "week_doors": 17,
      "ja": 5, "nei": 12, "ikke_hjemme": 0, "folg_opp": 0,
      "ja_prosent": 29.4, "nei_prosent": 70.6, "contact_pct": 100.0,
      "consistency": 78.0,
      "total_min": 0, "avg_daily_min": 0,    // see limitation below
      "daily": [ { "date": "2026-05-10", "doors": 4, "ja": 1 } ]   // ≤14 points
    }
  ],
  "week_activity": [ { "label": "man", "doors": 4, "ja": 1 } ]      // 7 points
}
```

**Important limitation — per-campaign work-time:**
- `campaigns[].total_min` and `campaigns[].avg_daily_min` are **always `0`**.
  Work-time is tracked per *session*, not per campaign (the data model can't
  attribute minutes to a campaign), so real work-time lives only in the
  **aggregate** fields (`total_min`, `avg_daily_min`, `active_days`).
- **Frontend action:** in the per-campaign Arbeidstid view, show work-time only
  at the aggregate level, or label per-campaign minutes as "n/a". Everything else
  per-campaign (doors, rates, consistency, daily sparkline) is real.

**Terskler tab:** `applied_threshold` (aggregate) and each `campaigns[].threshold`
are full `Threshold` objects; compute pass/fail client-side (`evalThreshold`) as
the spec describes. `threshold_scope` tells you whether a campaign override is in
effect (`"kampanje"`) or it fell back to global (`"global"`).

**Integration:** swap the `EmployeeStatsView` mock for this call. `daily` and
`week_activity` already carry `{date/label, doors, ja}` for the sparklines.

---

## 4. Still NOT built (stay on mock)

- `SSE /api/stream/employee/me/` — real-time push for the live ring. Poll
  `/me/today/` (every ~15–30 s) until the realtime module ships.
- Everything outside §7.2/§7.3 that wasn't in Module 1.

---

## 5. Integration checklist

- [ ] Gamified dashboard: swap `employeeLogic.ts → EmployeeDayData` mock →
      `GET /api/employee/me/today/`. Poll for live updates.
- [ ] "Registrer salg" button → `POST /api/employee/me/registrations/`, then
      refetch `/me/today/`.
- [ ] Employee Stats page → `GET /api/employee/me/stats/`. Render aggregate
      work-time; treat per-campaign `total_min`/`avg_daily_min` as n/a.
- [ ] Use `user_info.id` (the domain Employee id) for display; the endpoints
      don't need it (identity comes from the token).
- [ ] Test with `?date=` / `?start_date=` inside the historical data range to see
      non-zero values.
