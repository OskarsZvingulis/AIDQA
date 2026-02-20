# AIDQA — Project Brain

> This file is the authoritative reference for AI assistants working on this codebase.
> Update it whenever a milestone is completed or architecture changes.
> Last reconstructed: 2026-02-20

---

## Project Overview

**AIDQA** is a SaaS visual regression testing platform. It continuously monitors web pages by
capturing screenshots, comparing them pixel-by-pixel against an approved baseline, and using
GPT-4o Vision to explain what changed and why.

**Target user:** Developers and QA teams who want to catch unintended visual regressions in
production without maintaining a local browser test suite.

**Business model:** SaaS (multi-tenant, subscription). Each user's data is isolated by `project_id = auth.uid()`.

---

## Current Architecture

### Frontend
- React 18 + Vite + TypeScript
- React Router v6 (`/login`, `/signup`, `/`, `/create-monitor`, `/monitors/:id/history`, `/visual/baselines/:id/runs/:id`, `/runs/:id`)
- `ProtectedRoute` component wraps all app routes — redirects to `/login` if no session
- TanStack React Query is installed but not used — data fetching is done with raw `fetch()` and `useState`
- shadcn/ui + Tailwind CSS for all UI components
- Deployed to Vercel (SPA rewrites configured in `vercel.json`)

### Backend
- Supabase Edge Function (`supabase/functions/visual-api/`) — Deno serverless runtime
- All API routes handled in `index.ts` via regex path matching → `visual/handlers.ts`
- Screenshot capture via Browserless REST API (`/screenshot` and `/function` endpoints)
- Image diffing via `pixelmatch` + `imagescript` (pure Deno, no native deps)
- AI analysis via OpenAI GPT-4o-mini Vision — runs **asynchronously** after run is inserted

### Database (Supabase Postgres)
```
design_baselines
  id, project_id, name, source_type, snapshot_path, viewport (JSONB),
  approved, approved_at, created_at,
  diff_threshold_pct (NUMERIC, default 0.2),
  ignore_regions (JSONB, default [])

monitors
  id, project_id, baseline_id (FK → design_baselines), target_url,
  cadence ('hourly'|'daily'), enabled, created_at

visual_runs
  id, monitor_id (FK → monitors), baseline_id (FK → design_baselines),
  project_id, status ('completed'|'failed'), mismatch_percentage, diff_pixels,
  current_path, diff_path, result_path, severity ('minor'|'warning'|'critical'),
  current_source_url, ai_json (JSONB), ai_status, ai_error, created_at,
  baseline_dom_path (TEXT, nullable),    -- added, not yet populated
  current_dom_path (TEXT, nullable),     -- added, not yet populated
  css_diff_json (JSONB, nullable)        -- added, not yet populated
```

### Storage (Supabase Storage, bucket: "visual")
```
{projectId}/baselines/{baselineId}/baseline.png
{projectId}/monitors/{monitorId}/runs/{runId}/current.png
{projectId}/monitors/{monitorId}/runs/{runId}/diff.png
{projectId}/monitors/{monitorId}/runs/{runId}/result.json
```

### Scheduling
- Vercel Cron: `0 * * * *` (every hour) → `GET /api/cron/tick` → `api/cron-tick.ts`
- `api/cron-tick.ts` proxies a POST to the Edge Function `/cron/tick`
- `handleCronTick()` fetches all `enabled = true` monitors (up to 50) and runs each

---

## Completed Milestones

### Milestone 1 — Core Infrastructure
Completed in early commits. The foundation everything else builds on.

- Supabase Edge Function deployed with full request router (`index.ts`)
- Database schema for `design_baselines`, `monitors`, `visual_runs`
- Supabase Storage bucket with signed URL generation (6-hour expiry)
- SSRF protection (`ssrfGuard.ts`) — blocks localhost, private IP ranges (10.x, 172.16-31.x, 192.168.x, ::1)
- CORS headers on all responses
- Screenshot capture via Browserless REST API with:
  - 3 retries with exponential backoff (300ms → 900ms → 2000ms)
  - Blank/white image detection (rejects images >98% white)
  - Configurable viewport (width, height)

### Milestone 2 — Visual Diff Pipeline
The core technical capability. Fully working end-to-end.

- Pixel comparison using `pixelmatch` + `imagescript` — no native browser needed
- Two-tone diff overlay: green = pixels in baseline but not current, red = pixels in current but not baseline
- Per-baseline drift tolerance: `diff_threshold_pct` stored in DB, passed to `comparePngExact()`
- Ignore regions: user draws rectangles on baseline preview canvas; regions masked (set to transparent) before comparison
- `handleCreateMonitor()` executes first comparison inline (no cron dependency for initial result)
- `runMonitor()` used by both initial creation and cron ticks

### Milestone 3 — Async AI Analysis
Fully working. AI does not block the run result.

- GPT-4o-mini Vision receives baseline URL, current URL, diff URL + mismatch stats
- Returns structured JSON: `{ summary, severity, issues[], quickWins[] }`
- `filterAIIssues()` post-processes results to suppress false "duplication" reports caused by diff ghosting artifacts
- Severity per AI: `pass | minor | major | critical`
- Severity per pixel diff: `minor | warning | critical` (stored as `visual_runs.severity`)
- AI result stored in `ai_json` column; `ai_status` tracks `skipped | completed | failed`
- If `OPENAI_API_KEY` is not set, AI is skipped gracefully

### Milestone 4 — Monitor Lifecycle
Full create-approve-monitor-run loop working in production.

- **Step 1:** User submits baseline name + source URL + viewport + tolerance → backend captures screenshot, stores PNG, returns signed preview URL
- **Step 2:** User previews screenshot, draws ignore regions on canvas, clicks Approve → backend marks `approved = true`
- **Step 3:** User submits target URL + cadence → backend creates monitor row + runs first comparison immediately → returns mismatch %
- Frontend displays baseline / current / diff images after monitor creation
- Cron: `handleCronTick()` processes all enabled monitors hourly

### Milestone 5 — Frontend MVP
All core screens implemented and wired to the backend.

- **Dashboard** (`/`): monitor table with baseline name, run status badge, drift %, trend sparkline, last check time, View / History actions
- **Create Monitor** (`/create-monitor`): two-step wizard with canvas-based ignore region drawing
- **MonitorHistory** (`/monitors/:id/history`): drift trend chart (Recharts LineChart) + paginated run table with severity badges and AI analysis display
- **VisualRun** (`/visual/baselines/:id/runs/:id`): three-panel image viewer + full AI insights panel (issues, severity, quick wins)

### Milestone 7 — Stage 1 Correctness Fixes *(2026-02-20)*
Both bugs found in Stage 1 audit — fixed.

- **First-run severity:** `handleCreateMonitor()` now delegates to `runMonitor()` instead of duplicating the comparison pipeline inline. Every run now has `severity` set correctly, including the first one.
- **Cron cadence:** `monitors.last_run_at` column added (migration `20260220000000`). `runMonitor()` writes `last_run_at` after every run. `handleCronTick()` filters monitors by cadence: hourly monitors skip if run within the last hour, daily monitors skip if run within the last 24 hours. Cron response now includes a `skipped` count.
- **Return type bug:** `runMonitor()` was typed as returning `aiStatus` but actually returned `severity`. Fixed the type signature and the `handleCronTick()` reference that was silently reading `undefined`.

### Milestone 6 — Codebase Consolidation
Cleanup of the old dual-baseline system. Completed as a dedicated session.

Removed:
- Old `visual_baselines` / `baseline_sources` / `visual_jobs` handler functions
- Dead files: `rateLimit.ts`, `router.ts`, `index-full-failed.ts`, `index-simple.ts`, empty `services/` stubs
- Unused `src/core/` directory (analyzer, types, utils, defaultDesignSystem)
- Stale docs (FIX_SUMMARY.md, IMPLEMENTATION_SUMMARY.md, etc.)
- Legacy npm deps: `express`, `cors`, `playwright`, `pngjs`, `@types/express`, `@types/cors`

All handlers now query only `design_baselines` and `monitors`.

---

## Partially Implemented Systems

### CSS Diff Pipeline — ✅ FULLY WIRED (Stage 2 complete)

~~Schema and Engine Done, Not Wired~~

### ~~CSS Diff Pipeline — Schema and Engine Done, Not Wired~~

**What exists:**
- `supabase/functions/visual-api/visual/cssDiff.ts` — complete engine:
  - `compareDomSnapshots(baseline, current)` — matches DOM elements by selector + bounding box + text, compares 20+ CSS properties, returns `CssDiffItem[]`
  - `summarizeCssDiff(diffs)` — human-readable summary string
  - Property category classification: typography / color / spacing / layout / border
- `capture.ts` has `captureDomSnapshot()` — uses Browserless `/function` to capture 500 DOM elements with computed styles
- `visual_runs` table has `baseline_dom_path`, `current_dom_path`, `css_diff_json` columns (migration applied)

**What is NOT done:**
- `captureDomSnapshot()` is never called in any handler — DOM snapshots are never captured
- `compareDomSnapshots()` is never called — `css_diff_json` is always NULL in every run
- API responses never include `css_diff_json`
- No UI for displaying CSS diffs

**Integration path** (straightforward):
1. In `handleCreateDesignBaseline()`: call `captureDomSnapshot()`, upload JSON to storage, store path in `design_baselines`
2. In `runMonitor()`: call `captureDomSnapshot()` for current URL, download baseline DOM, run `compareDomSnapshots()`, store result in `css_diff_json`, upload DOM JSONs
3. Expose `css_diff_json` in `GET /monitors/:id/runs` and `GET /runs/:id`
4. Add CSS Changes tab to `MonitorHistory.tsx` and `VisualRun.tsx`

### Severity on Initial Run — Missing

**What exists:**
- `runMonitor()` correctly calculates and stores `severity` based on mismatch %

**What is NOT done:**
- `handleCreateMonitor()` runs its own inline comparison (not via `runMonitor()`) and does NOT set `severity` on the created run — first run always has `severity = NULL`

**Fix:** Refactor `handleCreateMonitor()` to call `runMonitor()` instead of duplicating the comparison logic.

### Cron Cadence Enforcement — Not Implemented

**What exists:**
- `handleCronTick()` queries `enabled = true` monitors and runs all of them on every tick

**What is NOT done:**
- No `last_run_at` column on `monitors` — cadence (hourly vs daily) is stored but never enforced
- A "daily" monitor gets run every hour along with hourly monitors

**Fix:** Add `last_run_at` to `monitors`, update it after each run, filter in `handleCronTick()` based on cadence + last run time.

---

## Remaining Gaps

These are fully missing — no code exists for them.

### 1. Notifications & Alerting (Important)
No alert mechanism of any kind exists. Drift can exceed threshold silently.

Required work:
- SQL migration: add `webhook_url TEXT`, `alert_threshold_pct NUMERIC` to `monitors`
- `runMonitor()`: if `mismatch_percentage > alert_threshold_pct`, POST JSON payload to `webhook_url`
  - Webhook payload format should be compatible with Slack incoming webhooks and generic HTTP
- UI: webhook URL + alert threshold fields in monitor creation form and a future monitor-edit page

### 2. Tests (Important for production confidence)
No tests of any kind exist.

Required work:
- Vitest unit tests for frontend utility functions (`cssDiff.ts` matching logic, `diff.ts` edge cases)
- GitHub Actions workflow: `tsc --noEmit` + `vite build` + `vitest run` on every push to main
- Optional: Deno tests for Edge Function handlers with mocked Supabase client

### 3. Minor Functional Gaps
- Dashboard loads up to 200 runs from Supabase REST without pagination — will degrade with scale
- No way to edit or delete a monitor after creation
- No way to re-capture a baseline (must create a new one)
- `DesignBaseline.snapshotUrl` is in the type interface but not returned by `handleCreateDesignBaseline()` (only `previewUrl` is returned)

---

## Production Readiness Checklist

### Infrastructure
- [x] Supabase Edge Function deployed
- [x] Supabase Storage bucket configured
- [x] Vercel deployment with SPA rewrites
- [x] Vercel Cron configured (hourly)
- [x] SSRF protection on all user-supplied URLs
- [x] RLS policies enabled on all tables (migration `20260220000200`)
- [ ] Environment variable audit (all secrets in Supabase secrets / Vercel env)

### Security
- [x] SSRF guard blocks internal network access
- [x] Signed URLs for storage (6-hour expiry)
- [x] Authentication — Supabase email/password auth, Login + Signup pages, ProtectedRoute
- [x] Authorization — JWT validated in Edge Function; all queries scoped to user.id via RLS
- [ ] Rate limiting — removed, not replaced

### Correctness
- [x] Pixel diff produces correct visual output
- [x] Ignore regions correctly masked before comparison
- [x] Per-baseline tolerance applied in comparison
- [x] AI analysis runs async without blocking run creation
- [ ] Severity stored on first run (always NULL currently)
- [ ] Cron cadence enforced (all monitors run every tick regardless of cadence)
- [ ] CSS diffs populated (always NULL currently)

### Observability
- [x] `console.log` / `console.error` throughout handlers (visible in Supabase Edge Function logs)
- [x] `ai_status` + `ai_error` columns track AI pipeline state
- [ ] No structured error reporting or alerting on backend failures
- [ ] No health dashboard or uptime monitoring

### Feature Completeness for Launch
- [x] Baseline capture and approval
- [x] Monitor creation with first run
- [x] Continuous monitoring via cron
- [x] Visual diff with image viewer
- [x] AI-powered analysis
- [x] Monitor history with trend chart
- [x] Authentication / user accounts
- [ ] Notifications / alerts
- [ ] Monitor management (edit, pause, delete)
- [ ] CSS-level diff (engine built, not wired)

---

## Execution Roadmap to Launch

Work should be done in this order. Each item is a self-contained coding session.

### Stage 1 — Fix Correctness Issues ✅ COMPLETE

**1a. Fix first-run severity** ✅
- `handleCreateMonitor()` now delegates to `runMonitor()` — 40 lines of duplicated pipeline removed
- Every run (including the first) now has `severity` set

**1b. Fix cron cadence enforcement** ✅
- Migration `20260220000000_add_last_run_at_to_monitors.sql` adds `last_run_at TIMESTAMPTZ NULL`
- `runMonitor()` writes `last_run_at` after every successful run
- `handleCronTick()` filters by cadence before executing — daily monitors no longer run hourly
- Cron response now includes `skipped` count for observability

### Stage 2 — Wire CSS Diff Pipeline ✅ COMPLETE

**2a. Backend** ✅
- Migration `20260220000100` adds `baseline_dom_path TEXT NULL` to `design_baselines`
- `handleCreateDesignBaseline()`: after screenshot upload, calls `captureDomSnapshot()`, uploads DOM JSON to `{projectId}/baselines/{id}/baseline-dom.json`, stores path in `baseline_dom_path` (non-fatal)
- `runMonitor()`: after screenshot uploads, calls `captureDomSnapshot()` for target URL, uploads to `{projectId}/monitors/{id}/runs/{runId}/current-dom.json`, downloads baseline DOM, runs `compareDomSnapshots()`, stores result in `css_diff_json`. All wrapped in try/catch — never blocks a run
- `handleListMonitorRuns()` and `handleGetRun()` both return `cssDiffJson` in response
- `cssDiffJson` added to the `Run` type in `_lib/types.ts`

**2b. Frontend** ✅
- `MonitorHistory.tsx`: `CssDiffItem`/`CssPropertyChange` types added; CSS Changes panel in run dialog with scrollable list of changed selectors + property rows (category badge, property name, red strikethrough → green); CSS change count column in run table
- `VisualRun.tsx`: same types added; dedicated CSS Changes card section between AI panel and image viewer, with per-element cards showing all property changes with category colour-coding

### Stage 3 — Authentication & Multi-tenancy ✅ COMPLETE *(2026-02-20)*

**3a. Database: RLS policies** ✅
- Migration `20260220000200_auth_rls_policies.sql`: RLS enabled on `design_baselines`, `monitors`, `visual_runs`
- Policies: `ALL WHERE project_id = auth.uid()::text` on all three tables
- Storage policy: authenticated users can sign/read objects under `{userId}/` prefix
- Service role key bypasses RLS — Edge Function writes always succeed

**3b. Backend: validate JWT** ✅
- `supabaseServer.ts`: `AuthError` class + `getUserFromRequest(req)` validates Bearer JWT via `supabase.auth.getUser(token)`
- `index.ts` rewritten with three auth tiers: `/health` (none), `/cron/tick` (service role key comparison), all user routes (JWT)
- All 4 handlers that need ownership now receive `userId` as second param: `handleListBaselines`, `handleCreateDesignBaseline`, `handleCreateMonitor`, `handleListMonitors`
- `project_id` from request body is ignored — always set to authenticated user's ID

**3c. Frontend: auth pages** ✅
- `src/lib/auth.ts`: `getAuthHeaders()` (returns `Authorization: Bearer <session.access_token>`), `getCurrentUserId()`
- `src/pages/Login.tsx`: email/password form, redirects to `/` on success
- `src/pages/Signup.tsx`: signup form, handles email confirmation flow
- `src/components/ProtectedRoute.tsx`: listens to `onAuthStateChange`, redirects to `/login` if no session
- `src/App.tsx`: `/login` + `/signup` routes added; all app routes wrapped with `<ProtectedRoute>`
- `Dashboard.tsx`: uses `supabase` client for DB + storage queries (RLS auto-filters), auth headers for API; logout button + email in header
- `Index.tsx`: `getApiHeaders()` → `await getAuthHeaders()`; `projectId: 'demo'` removed from all bodies
- `MonitorHistory.tsx`: auth headers for API; `fetchBaselineUrl` uses supabase client (no manual REST)
- `VisualRun.tsx`, `RunDetail.tsx`: auth headers for API calls

### Stage 4 — Notifications (medium effort, high value)

**4a. Database: alert fields**
- SQL migration: add `webhook_url TEXT NULL`, `alert_threshold_pct NUMERIC NULL DEFAULT 5.0` to `monitors`

**4b. Backend: fire webhooks**
- In `runMonitor()`: after inserting run, if `mismatch_percentage > monitor.alert_threshold_pct` and `monitor.webhook_url` is set, POST JSON payload (non-blocking, same async pattern as AI)
- Payload: `{ monitorId, runId, mismatchPercentage, severity, targetUrl, diffUrl, timestamp }`
- Payload is Slack-compatible when `webhook_url` is a Slack Incoming Webhook URL

**4c. Frontend: alert config in monitor form**
- Add webhook URL + alert threshold fields to Step 2 of the create-monitor wizard
- Pass values in the `POST /monitors` body

### Stage 5 — Tests & CI/CD (final, stabilizes everything)

**5a. GitHub Actions**
- Workflow: on push to `main` → `npm ci` → `npx tsc --noEmit` → `npx vite build`
- Add Vitest: `npx vitest run` for any unit tests created in 5b

**5b. Unit tests**
- `cssDiff.test.ts`: test element matching and property comparison with fixture DOM snapshots
- `diff.test.ts` (frontend util if extracted): test mismatch % calculation edge cases
- `filterAIIssues.test.ts`: ensure duplication suppression logic works correctly

---

## Guiding Technical Principles

1. **Async AI, sync everything else.** AI analysis must never block a run result being returned to the user or the cron tick completing. Always insert the run row first, then kick off AI in a detached async IIFE.

2. **Service role on the backend, anon key on the frontend.** The Edge Function uses `SUPABASE_SERVICE_ROLE_KEY` and bypasses RLS. Frontend uses `VITE_SUPABASE_ANON_KEY` and is subject to RLS. Never expose the service role key to the frontend.

3. **SSRF check every user-supplied URL.** Before passing any URL to Browserless, call `isUrlSafe()`. This is non-negotiable — Browserless can reach internal network addresses if not guarded.

4. **Signed URLs expire in 6 hours.** Never store signed URLs in the database. Generate them on demand in API responses only. Storage paths (e.g., `demo/baselines/abc/baseline.png`) are what gets stored.

5. **No duplication of comparison logic.** `runMonitor()` is the single source of truth for the capture → diff → store → AI pipeline. `handleCreateMonitor()` must call `runMonitor()`, not re-implement it.

6. **projectId = user.id after auth is added.** Every row in every table is scoped to a `project_id`. When auth lands, `project_id` becomes the authenticated user's UUID. No separate "project" entity is needed unless multi-project-per-user support is desired.

7. **Migrations are append-only.** Never modify an existing migration file. Always create a new timestamped `.sql` file for schema changes.

8. **Keep the Edge Function as one deployed unit.** All routes live in `supabase/functions/visual-api/`. Do not split into multiple functions — cold start overhead multiplies.

9. **cssDiff is supplementary, not gating.** CSS diff failures must never prevent a run from completing. Wrap all DOM snapshot logic in try/catch; if it fails, the run still succeeds with `css_diff_json = null`.

10. **Cron must be idempotent.** If the cron fires twice in the same minute (Vercel can do this), duplicate runs will be created. This is acceptable for now. A deduplication lock (e.g., Postgres advisory lock or a `running = true` flag on monitors) can be added later.
