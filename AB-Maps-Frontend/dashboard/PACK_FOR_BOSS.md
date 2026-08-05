# How to package this folder for the boss

Two options. Pick the one that fits your delivery channel.

---

## Option 1 — zip and share (recommended for email / cloud drive)

From this folder (`AB-Maps-Frontend/dashboard/`):

```bash
cd ~/Projects/ab-marketing/AB-Maps-V2-/AB-Maps-Frontend

# Fresh working copy so we don't accidentally include node_modules / .next
rsync -a --exclude='node_modules' --exclude='.next' --exclude='.git' --exclude='.DS_Store' \
      dashboard/ /tmp/ab-maps-preview/

# Verify .env.local made it in (it's needed — sets NEXT_PUBLIC_DEMO_MODE=true)
ls /tmp/ab-maps-preview/.env.local && echo "OK: .env.local included"

# Zip it up (about ~5-8 MB without node_modules)
cd /tmp && zip -r ab-maps-preview.zip ab-maps-preview -x '*.DS_Store'

# The archive
ls -lh /tmp/ab-maps-preview.zip
```

Send `/tmp/ab-maps-preview.zip` to the boss. He unzips, `cd`'s in, follows `BOSS_README.md`.

---

## Option 2 — private GitHub repo (recommended if boss has GH access)

If the boss has a GitHub account and this is easier for you:

```bash
cd ~/Projects/ab-marketing/AB-Maps-V2-/AB-Maps-Frontend/dashboard
# NEW branch — don't touch main
git checkout -b preview/salgsleder-dashboard-for-boss

# Stage ONLY what we want (skip the sibling apps' package-lock noise)
git add app/dashbord/page.tsx
git add app/employee/dashbord/page.tsx
git add app/page.tsx
git add app/demo/
git add lib/auth/AuthContext.tsx
git add lib/auth/demoAuth.ts
git add components/dashboard/leader/
git add .env.local
git add BOSS_README.md
git add PACK_FOR_BOSS.md

# Commit + push
git commit -m "preview: salgsleder + promotør dashboard for boss local review"
git push -u origin preview/salgsleder-dashboard-for-boss
```

Send the boss a link to the branch. He clones + follows `BOSS_README.md`.

**⚠ Note:** `.env.local` is normally gitignored. Check `.gitignore` — you may need to force-add: `git add -f .env.local`. Since it contains only the demo flag (no secrets), that's fine for this branch.

---

## Option 3 — hand him the folder directly (USB / AirDrop / shared drive)

```bash
cd ~/Projects/ab-marketing/AB-Maps-V2-/AB-Maps-Frontend

rsync -a --exclude='node_modules' --exclude='.next' --exclude='.git' --exclude='.DS_Store' \
      dashboard/ ~/Desktop/ab-maps-preview/
```

Then AirDrop `~/Desktop/ab-maps-preview/` to his Mac. He does the same 3 commands from `BOSS_README.md`.

---

## What the boss needs to know (verbatim message you can send)

> Hei — vedlagt/lenke er en lokal preview av det nye Salgsleder- og Promotør-dashboardet. Åpne mappen, les `BOSS_README.md`. Kort versjon:
>
> ```bash
> npm install
> npm run dev
> ```
>
> Åpne `http://localhost:3000` i nettleseren. Du får en «velg rolle»-side — klikk enten «Salgsleder / Teamleder» (Image #3) eller «Promotør» (Image #4). Ingen innlogging, ingen backend nødvendig — alt er dummy data for demoen.
>
> Ingenting er lastet opp til produksjon.

---

## What the boss should verify (checklist for him)

- Layout matches Image #3 for Salgsleder
- Layout matches Image #4 for Promotør
- Clicking a team card expands it (per-promoter breakdown)
- Clicking SUM VERVINGER or LEDERPROVISJON expands it (per-team breakdown)
- Roy mascots + mood badges visible on the TOPPLISTER
- The SANNTID / DIN DAG section at the bottom looks integrated (not tacked on)
- Admin + Plain manager views are UNCHANGED from what he sees today on prod

---

## What NOT to do

- **Do not push this folder to production** (the deploy plan is separate — comes after boss approval)
- **Do not commit `.env.local` to `main`** — it's a demo flag that should only live on preview branches / this folder
- **Do not modify** the existing prod files (`DashboardV2.tsx`, `EmployeeDashboardView.tsx`, or anything under `lib/api/`) — they're preserved as-is for the eventual prod deploy
