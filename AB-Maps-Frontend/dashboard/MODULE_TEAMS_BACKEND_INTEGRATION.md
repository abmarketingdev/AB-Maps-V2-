# Campaign Teams — Backend Integration Guide

> **For the frontend Claude.** A new **Teams** feature: campaign-scoped teams with
> role-based CRUD, member management, and per-team analytics + a campaign
> leaderboard. Base URL + auth as in `MODULE_1_BACKEND_INTEGRATION.md`
> (`Authorization: Bearer {access}`). All endpoints under **`/api/teams/`**.

## Core model
- A **team belongs to exactly one campaign**. A manager/chief/admin can create
  **many teams per campaign**.
- Members are **employees or managers**, and **must be assigned to the team's
  campaign**. A person can be on **at most one team per campaign** (409 on
  conflict).
- Decorative: `color` (hex) + `icon` (emoji/short string).
- `owner` = the manager who **created** the team.

## Permission matrix
| Role | Teams they can see / manage |
|---|---|
| **Manager** | Only teams **they created** (`owner == me`). Create only for campaigns they're assigned to. Edit/delete/manage members on their own teams. |
| **Sales chief** | **All** teams (campaign-segregated). Create for any campaign; edit/delete/manage members on **any** team. |
| **Admin** (superuser+staff) | Same as sales chief. |
| **Employee** | **No access** → `403`. |

> Note: this is intentionally narrower than data-scope. A regular manager sees
> all *sales data* globally, but for **team management** only sees their own teams.

---

## Endpoints

### List / create
```
GET /api/teams/?campaign_id=&created_by=&search=&page=&page_size=
→ { results:[TeamListItem], total_count, page, page_size, total_pages }
```
- Manager → only own teams; chief/admin → all. `created_by` = a manager id (the
  chief's "who created what" segregation). `campaign_id` filters to one campaign.
```ts
TeamListItem = { id, name, description, color, icon,
  campaign:{id,name}|null, owner:{id,name}|null, member_count, created_at, updated_at }
```
```
POST /api/teams/   { name, campaign_id, description?, color?, icon? }  → 201 TeamDetail
```
- `403` if a manager isn't assigned to `campaign_id`; `404` unknown campaign;
  `400` missing name/campaign_id.

### Detail / edit / delete
```
GET    /api/teams/{id}/                → TeamDetail  (managers: only own → else 404)
PATCH  /api/teams/{id}/  { name?, description?, color?, icon? }   (campaign is immutable)
DELETE /api/teams/{id}/                → 204
```
```ts
TeamDetail = TeamListItem & {
  members: [{ id, name, email, person_type:"employee"|"manager", online, ab_person_id, added_at }],
  can_edit: boolean   // true if the current user may edit this team
}
```

### Members
```
POST   /api/teams/{id}/members/   { employee_id }  OR  { manager_id }   → 201 TeamDetail
DELETE /api/teams/{id}/members/?employee_id=  |  ?manager_id=           → 204
```
- Provide **exactly one** of `employee_id` / `manager_id`.
- `400` if the person isn't assigned to the team's campaign.
- **`409`** if the person is already on another team in that campaign.
```
GET /api/teams/{id}/assignable-members/
→ { count, results:[{ id, name, email, person_type, online }] }
```
- The campaign's members **not yet on any team** in that campaign — use this to
  populate the "add member" picker.

### Analytics (per team)
```
GET /api/teams/{id}/analytics/?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
```
(defaults to last 30 days). Aggregates members' door-knocks **in the team's
campaign** (employees + manager members):
```jsonc
{
  "team_id":"…", "name":"Alpha", "campaign":{"id":"…","name":"…"}, "member_count":2,
  "total_doors":10, "ja":4, "nei":6, "ikke_hjemme":0, "folg_opp":0,
  "ja_rate":40.0, "nei_rate":60.0, "ikke_hjemme_rate":0.0, "contact_rate":100.0,
  "doors_per_active_day":10.0, "consistency_score":0.0,
  "work": { "total_seconds":0, "total_minutes":0, "avg_minutes_per_member":0, "active_members":0 },
  "per_member": [ { "id":"…","name":"…","person_type":"employee","doors":5,"ja":3,"ja_rate":60.0,"work_minutes":0 } ]
}
```
> `work.*` is app-connected time (WorkSession), summed over members — it is not
> campaign-specific (the data model can't attribute work-time to a campaign).

### Leaderboard (teams within a campaign)
```
GET /api/teams/leaderboard/?campaign_id=&metric=ja_rate|doors|contact_rate|work_time|consistency&start_date=&end_date=
→ { campaign_id, metric, entries:[ { rank, team_id, name, color, icon, owner_name, member_count, metric, value } ] }
```
- `campaign_id` **required**. Ranks all teams in that campaign by `metric`, desc.
- `metric=work_time` → ranks by **total member work-minutes** ("longest work
  timings"); `doors`/`ja_rate`/`contact_rate`/`consistency` rank on those.

---

## Notes for testing
- Empty analytics/leaderboard values for recent ranges are a **data** issue (dev
  door-knocks end 2026-03-19), not a bug. Use a range that overlaps the data.
- Login `user_info.manager_id` for an employee now resolves to the owner of their
  **most-recently-joined** team (informational; managers are global for data).

## Checklist
- [ ] Teams list/grid → `GET /api/teams/` (managers see own; chiefs/admins all,
      with `campaign_id` + `created_by` filters for the segregated view).
- [ ] Create/edit team modal → `POST` / `PATCH /api/teams/{id}/` (name,
      description, `color`, `icon`).
- [ ] Add-member picker → `GET …/assignable-members/`; add via `POST …/members/`
      (handle `409` "already on a team this campaign" and `400` "not in campaign").
- [ ] Team detail → `GET /api/teams/{id}/` (`members[]`, `can_edit`).
- [ ] Team analytics panel → `GET …/analytics/`.
- [ ] Campaign leaderboard → `GET /api/teams/leaderboard/?campaign_id=&metric=`.
- [ ] Hide the whole Teams UI for employees (they get 403).
