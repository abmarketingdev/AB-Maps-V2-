# Modules 4–8 — Backend Integration Guide (remaining feature pages)

> **For the frontend Claude.** This covers the rest of the spec's feature pages.
> Read `MODULE_1_BACKEND_INTEGRATION.md` for auth/conventions. Same base URL,
> `Authorization: Bearer {access}`, historical-data testing caveat. Manager/admin
> endpoints 403 for employee tokens; team-scoped (manager→team, admin→global);
> most accept optional `?campaign_id=`. **Legacy endpoints are untouched.**

---

## Module 4 — Admin User Management (§6.1)

- **`GET /api/users/stats/`** → `{ total, managers, employees, superusers }`.
- **`GET /api/users/assignable/`** → `{ count, results:[FlatUser] }` — role-aware
  (manager → team employees+managers; admin → all). Use for task-assignee pickers.
- **`GET /api/users/directory/?role=manager|employee|superuser&search=&page=&page_size=&ordering=`**
  → paginated `{ results:[FlatUser], total_count, page, page_size, total_pages }`.
  `FlatUser` = the shared User shape (§4.5): `{id, username, name, email, phone,
  user_type, is_superuser, is_sales_chief, manager_id, ab_person_id, is_active,
  date_joined, last_login, online}`. Search hits name/email/ab_person_id.

> The legacy `/api/users/managers/`, `/employees/`, `/users/superusers/` still
> return unpaginated arrays — prefer `directory/` for the admin grid.

---

## Module 5 — Sales activity (§5.3) + Rapport (§5.4)

**Sales feed (door-knocks from `Address`):**
- **`GET /api/dashboard/v2/sales/?campaign_id=&employee_id=&status=&start_date=&end_date=&search=&page=&page_size=`**
  → `{ results:[Reg], total_count, page, page_size, total_pages }`,
  `Reg = {id, ts, employee_id, employee, campaign_id, status, city, postal_code}`.
  `city`/`postal_code` are parsed from the address text (best-effort; may be
  `null` if the text has no "0470 Oslo" segment). `status` filter accepts CSV.
- **`GET /api/dashboard/v2/sales/summary/?<same filters>`** →
  `{ by_status:{ja,nei,ikke_hjemme}, by_hour:[{hour,ja,nei,ikke_hjemme}×24],
  by_day:[{date,ja,nei,ikke_hjemme}], by_employee_lane:[{employee_id,employee,
  beads:[{ts,status}]}] }`. Beads capped at 200/lane, chronological.

**Rapport (`/api/reports/` — spec-aligned aliases over the existing views):**
- **`GET /api/reports/table/?campaign_ids=<csv>&start_date=&end_date=`** →
  `TableDataResponse` (`{users[], summary{}}`).
- **`GET /api/reports/user-addresses/?user_id=&campaign_ids=<csv>&start_date=&end_date=`**
  → `UserAddressResponse` (`{cities:[{…, addresses:[…]}]}`).
  > ⚠️ Param is **`campaign_ids`** (CSV), not `campaign_id`. Required on `table/`.

---

## Module 6 — Campaigns (§5.8) + Heatmap (§6.3)

**Campaign `status`:** the Campaign now has `status` ∈ `active|paused|ended`
(default `active`). It's on every campaign response, writable via PATCH, and
filterable: `GET /api/campaigns/campaigns/?status=active`.
> **No start/end dates exist** (by design). `days_left` is always `null`.

**Per-campaign stats (opt-in):**
`GET /api/campaigns/campaigns/?expand=stats` (or on detail) adds a `stats` object:
```jsonc
"stats": {
  "pct_complete": 11.0,        // doors knocked ÷ available doors
  "days_left": null,
  "available_doors": 100,      // Σ area (house_count + apartment_count)
  "sales_week": 3,             // ja in last 7 days
  "sales_lifetime": 42,        // ja all-time
  "employee_ids": ["uuid"],
  "areas": 2,                  // area count
  "color": "#10b981"
}
```
Without `?expand=stats` the `stats` key is omitted (lean list).

**Heatmap (new, read-only):**
`GET /api/dashboard/heatmap/?metric=ja_rate|doors&campaign_id=` →
`[{area_id, value}]`. Join `value` to your polygons client-side. `doors` = count
of door-knocks inside the area; `ja_rate` = % ja. Team-scoped.

---

## Module 7 — Tasks: true multi-assignee (§5.6)

**New v2 task API at `/api/todos/v2/tasks/`** (the legacy `/api/todos/todos/`
personal-todo API is unchanged). One task → many assignees.

- **`GET /api/todos/v2/tasks/?perspective=mine|assigned_by_me|team&status=&assignee_id=&campaign=&ordering=due&page=`**
  → `{ results:[Task], total_count, page, page_size, total_pages }`.
  - `mine` = tasks where I'm an assignee; `assigned_by_me` = I created/assigned;
    `team` = assignees in my team (admin → all).
- **`GET /api/todos/v2/tasks/?group_by=status&perspective=…`** →
  `{ todo:[Task], in_progress:[Task], done:[Task] }` (Kanban board; no pagination).
- **`POST /api/todos/v2/tasks/`** body
  `{title, description?, priority, due?, campaign?, status?, assignee_ids:[userId,…]}`
  → `201 Task`.
- **`PATCH /api/todos/v2/tasks/{id}/`** (any field incl. `assignee_ids` to replace
  the set), **`DELETE /api/todos/v2/tasks/{id}/`**,
  **`POST .../{id}/complete/`**, **`POST .../{id}/start/`**,
  **`POST /api/todos/v2/tasks/bulk_complete/`** / **`bulk_delete/`** `{todo_ids:[…]}`.

```ts
Task = { id, title, description, assigner_id, assignee_ids:string[],
         status:"todo"|"in_progress"|"done", priority:"high"|"medium"|"low",
         due:string|null, campaign:string|null }
```
> Status is the spec's `todo|in_progress|done` (backend maps to/from its internal
> `pending|completed`). `assignee_ids` are **auth User ids**. Use
> `/api/users/assignable/` to populate the assignee picker.

---

## Modules NOT changed — use existing endpoints

These already existed and were intentionally left as-is:

- **Address CSV upload (§5.10)** → `POST /api/uploaded-addresses/upload-file/`
  (multipart; returns `202 {batch_id}`), poll
  `GET /api/uploaded-addresses/upload-progress/?batch_id=`, plus `cancel-batch/`,
  `resume-upload/`, `generate-batch-id/`. Async via background processing.
- **Lock/Unlock areas (§6.4)** → `/api/locked-areas/campaigns/{campaign_id}/`:
  `bulk-lock/`, `bulk-unlock/` (body `{area_keys:[…]}`), `locked-areas/`,
  `available-areas/`, `hierarchical-areas/`, `map-areas/`. Locking operates on
  **SSB regions** (fylke/kommune/grunnkrets), not drawn territories.
- **Map polygons** → existing MVT tiles `/tiles/campaign-areas/{z}/{x}/{y}.mvt?campaign=`
  and the `campaign_areas` bbox list. (Requires Redis running.)

## Deferred (later hardening pass)
Rollup tables, cursor pagination, ETag/304, SSE real-time streams,
Idempotency-Key, rate limiting. Live aggregation is used for now.

## Checklist
- [ ] Admin user grid → `/api/users/directory/?role=`; counters → `/users/stats/`.
- [ ] Sales page → `v2/sales/` + `v2/sales/summary/`.
- [ ] Rapport → `/api/reports/table/` + `/user-addresses/` (use `campaign_ids`).
- [ ] Campaigns → read `status`, request `?expand=stats` for the cards.
- [ ] Demographics heatmap → `/api/dashboard/heatmap/`.
- [ ] Tasks page → `/api/todos/v2/tasks/` (assignee_ids, perspective, group_by).
- [ ] Address upload + lock/unlock → existing endpoints above (unchanged).
