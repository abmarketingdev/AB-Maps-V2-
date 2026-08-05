# AB Maps — Salgsleder / Promotør dashboard preview

Local preview of the two new dashboards from the mockups you shared. **Not deployed to production.** This folder runs entirely on your Mac — no VPN, no backend, no database, no login.

---

## What you need installed

- **Node.js 18+** — check with `node --version`. If missing: https://nodejs.org (LTS)

That's it. No Docker, no Python, no Postgres.

---

## Setup — 3 commands (~2 min)

Open a terminal, `cd` into this folder, then:

```bash
npm install       # installs the frontend deps — takes ~90 sec first time
npm run dev       # starts the local server
```

> If `npm install` errors with `ERESOLVE could not resolve … react-day-picker`, run instead:
> ```bash
> npm install --legacy-peer-deps
> ```
> (The bundled `.npmrc` sets this flag automatically, but some npm versions ignore it.)

When you see `✓ Ready in Xs`, open your browser to:

**http://localhost:3000**

You'll land on a role-picker with 4 cards. Click any of them to preview that role's dashboard.

---

## What the 4 cards show

| Card | What it is |
|---|---|
| **Salgsleder / Teamleder** (NY VISNING) | Your Image #3 mockup — the team-rollup view with expandable TEAM cards, LØNN row (Lederprovisjon breakdown per team), TOPPLISTER with the Roy mascots, and the existing SANNTID widgets (KPIStrip / Aktivitetstrend / Stemningsring / Kampanjestatus / Live aktivitet) integrated below. |
| **Promotør** (NY VISNING) | Your Image #4 mockup — a promoter's personal dashboard: MÅL MÅNED/UKE, LØNN, TOPPLISTER + DIN DAG (existing GoalRing / streak / today's timeline / "Registrer dør" button — all preserved from what employees see today). |
| **Admin / superuser** (UENDRET) | The current production dashboard, unchanged. Included so you can see it side-by-side and confirm nothing broke for existing admins. |
| **Plain manager** (UENDRET) | Same as admin — the current production dashboard. Plain managers keep exactly what they see today. |

Switch between roles any time — go back to `/demo` or `localhost:3000`.

---

## What's real vs dummy

- **Mockup sections** (MÅL / TEAM / LØNN / TOPPLISTER / DIN DAG greeting bar) → **dummy data** because the backend endpoints for these don't exist yet. Numbers are plausible but fake. When the backend team adds the endpoints, the frontend swaps in real data with zero UI change.
- **SANNTID widgets** on the Salgsleder view (KPIStrip / Aktivitetstrend / Stemningsring / Kampanjestatus / Live aktivitet) → **dummy data** in this local run because there's no backend. On production these hit `/api/dashboard/v2/*` exactly as they do today.
- **DIN DAG widgets** on the Promotør view (GoalRing / streak / TodayJourney / ResponseDonut) → **dummy data** in this local run. On production they hit `/api/employee/me/today/` exactly as they do today.

The dummy data is centralised in `components/dashboard/leader/demoBackendData.ts` and `components/dashboard/leader/dummyData.ts` so it's clear what's real vs fake.

---

## What's NOT changed in production today

Bit-for-bit unchanged behaviour for existing admin + manager users:
- `/dashbord` → still `DashboardV2` (same KPIs, same charts, same everything)
- `/employee/dashbord` → still `EmployeeDashboardView` (same GoalRing / streak / RegisterKnockModal / all APIs)

The changes only activate when:
- A user has `is_sales_chief=true` → they see the new Salgsleder view at `/dashbord`
- A user is `user_type=employee` → they see the new Promotør view at `/employee/dashbord`

---

## Things to know about this demo

- **No login step** — demo mode auto-logs-in as the role you pick. On production the normal login flow (username/password/platform) is unchanged.
- **"Registrer dør" button in Promotør view** — the modal opens (you can see the UX). Submitting will fail because backend isn't running. On production the button POSTs to `/api/employee/me/registrations/` exactly as it does today.
- **Metric switcher tabs** on the Aktivitetstrend chart (7d / 30d / 90d) → work, swap between the 3 date ranges.
- **Expandable cards** in the TEAM and LØNN sections of the Salgsleder view → click a team card to see per-promoter breakdown; click SUM VERVINGER or LEDERPROVISJON to see per-team breakdown.

---

## If something breaks

- **`npm install` errors** → probably wrong Node version. `node --version` should print `v18.*` or higher.
- **Port 3000 already in use** → run `PORT=3001 npm run dev` and open `localhost:3001` instead.
- **Blank page / stuck on splash** → open DevTools (Cmd+Option+I), Console tab, paste:
  ```js
  localStorage.clear(); location.reload();
  ```
  Then go to `localhost:3000/demo`.
- **Anything else** → forward the terminal output to Shah.

---

## To stop

Press `Ctrl+C` in the terminal. The `npm run dev` process ends. Nothing to clean up.
