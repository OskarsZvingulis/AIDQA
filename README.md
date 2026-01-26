# AIDQA - AI-Powered Design Quality Assurance

An automated design quality assurance tool for visual regression testing with AI insights. **Production-ready, fully hosted on Supabase + Vercel.**

## Project Overview

**Problem**: Visual regressions slip through manual QA, causing UI bugs in production. Design teams waste time manually comparing screenshots and debugging layout shifts.

**Solution**: AIDQA automatically:
- Captures pixel-perfect screenshots of live URLs
- Compares against baseline images with exact pixel diff
- Highlights visual differences with magenta overlays
- **NEW**: Provides AI-powered insights on what changed and why it matters
- Stores all artifacts in Supabase (Postgres + Storage)
- Deploys anywhere with serverless Edge Functions

## Features

### 1. Visual Regression Testing ✨ **Production-Ready**
- **Serverless architecture** using Supabase Edge Functions (Deno)
- **Remote browser** screenshot capture via Browserless WebSocket
- **Exact pixel-perfect** PNG comparison with diff visualization
- **Supabase Storage** for baseline/current/diff images (private bucket)
- **Postgres database** for run metadata and history with RLS enabled
- REST API + React web UI
- **SSRF protection** blocks localhost/private IPs
- **Rate limiting** prevents abuse (30 req/min per IP)

### 2. AI Insights (OpenAI) 🤖 **NEW**
- Analyzes baseline vs current screenshots with GPT-4o Vision
- Identifies layout shifts, spacing issues, typography changes
- Structured JSON output with severity levels (pass/minor/major)
- Actionable recommendations for each detected issue
- Optional: works without AI (graceful degradation)

### 3. Design System Analyzer (Legacy)
- **Pure TypeScript** core module (zero dependencies)
- Detects 5 categories: spacing, color, text, component, accessibility
- Works in any environment (web, CLI, Figma plugin)
- Configurable design system tokens

## Architecture

This project is split into two main parts:

### 1. Core Module (`src/core`)

Pure TypeScript logic with **zero dependencies** on React, DOM, or Figma APIs. This module can be imported into any environment, including Figma plugins.

- **`types.ts`**: Type definitions for design nodes, design systems, and analysis results
- **`utils.ts`**: Helper functions (color conversion, contrast calculations, string similarity)
- **`analyzer.ts`**: Main `analyzeDesign()` function that performs the analysis
- **`index.ts`**: Barrel export for clean imports

The core module detects five categories of issues:
- **Spacing**: Values not in the spacing scale
- **Color**: Colors not in the design system palette
- **Text**: Text styles not in allowed styles
- **Component**: Non-standard components used
- **Accessibility**: Insufficient contrast ratios (WCAG)

### 2. Demo Web App (`src/web`)

A React + Vite application that demonstrates the core module's capabilities:
- Configure design system settings (colors, spacing, text styles, components)
- Paste JSON representing a design tree
- Run analysis and view results in a clean, filterable UI
- See issue counts by category and detailed suggestions

## Quick Start

### Option 1: Local Development with Supabase (Recommended)

```bash
# 1. Clone and install
git clone <YOUR_GIT_URL>
cd AIDQA
npm install

# 2. Install Supabase CLI
npm install -g supabase

# 3. Initialize Supabase locally
supabase init
supabase start

# 4. Apply database schema
supabase db reset  # Applies migrations including supabase/sql/001_init.sql

# 5. Create Storage bucket
# Go to http://localhost:54323 (Supabase Studio)
# Storage → Create bucket → Name: "visual" → Private

# 6. Set Edge Function secrets (for local dev)
supabase secrets set SUPABASE_URL=http://localhost:54321
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<from_supabase_start_output>
supabase secrets set STORAGE_BUCKET=visual
supabase secrets set BROWSERLESS_WS_ENDPOINT=<your_browserless_ws_url>
# Optional: supabase secrets set OPENAI_API_KEY=sk-...

# 7. Start Edge Function locally
supabase functions serve visual-api --env-file .env

# 8. Start frontend (in new terminal)
VITE_API_BASE_URL=http://127.0.0.1:54321/functions/v1/visual-api npm run dev

# Open http://localhost:8080
```

### Option 2: Production Deployment

**Prerequisites:**
- Supabase account (free tier works)
- Browserless.io account for remote browser (or similar service)
- Vercel account for frontend hosting
- (Optional) OpenAI API key for AI insights

**Step 1: Supabase Setup**

```bash
# 1. Link to your Supabase project
supabase link --project-ref <your-project-ref>

# 2. Apply database schema
supabase db push

# 3. Create Storage bucket
# Dashboard → Storage → Create bucket → "visual" (PRIVATE)

# 4. Set production secrets
supabase secrets set SUPABASE_URL=https://<project-ref>.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
supabase secrets set STORAGE_BUCKET=visual
supabase secrets set BROWSERLESS_WS_ENDPOINT=wss://chrome.browserless.io?token=<token>
supabase secrets set ALLOWED_ORIGINS=https://your-frontend.vercel.app
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set AI_ENABLED=true

# 5. Deploy Edge Function
supabase functions deploy visual-api

# 6. Test the deployed function
curl https://<project-ref>.supabase.co/functions/v1/visual-api/health
```

**Step 2: Vercel Frontend Deployment**

```bash
# 1. Install Vercel CLI (optional)
npm install -g vercel

# 2. Set environment variable in Vercel Dashboard
# Settings → Environment Variables
# VITE_API_BASE_URL=https://<project-ref>.supabase.co/functions/v1/visual-api

# 3. Deploy
vercel --prod

# Or connect GitHub repo and auto-deploy on push
```

**Step 3: Verify Deployment**

1. Check API health: `https://<project-ref>.supabase.co/functions/v1/visual-api/health`
2. Open your Vercel URL: `https://your-app.vercel.app`
3. Create a baseline screenshot to test end-to-end
4. View data in Supabase Dashboard:
   - **Database → Table Editor** → `visual_baselines` and `visual_runs`
   - **Storage** → `visual` bucket → Browse artifacts

## Environment Variables

See [.env.example](.env.example) for all configuration options.

**Required Supabase Edge Function Secrets:**
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (never expose to client!)
- `STORAGE_BUCKET` - Storage bucket name (default: `visual`)
- `BROWSERLESS_WS_ENDPOINT` - Remote browser WebSocket URL

**Optional:**
- `OPENAI_API_KEY` - Enable AI insights (GPT-4o Vision)
- `AI_ENABLED` - Toggle AI (default: `true`)
- `ALLOWED_ORIGINS` - CORS whitelist (default: `*`)
- `RATE_LIMIT_PER_MINUTE` - Rate limit (default: `30`)

**Frontend (Vercel):**
- `VITE_API_BASE_URL` - Edge Function URL (leave empty for local dev)

## Architecture

### Technology Stack

**Frontend:**
- React 18 + Vite
- TypeScript
- TanStack Query for data fetching
- shadcn/ui components
- Deployed on Vercel

**Backend (Supabase Edge Functions):**
- Deno runtime (serverless)
- Supabase Postgres (metadata)
- Supabase Storage (artifacts)
- Remote browser via Browserless.io
- OpenAI GPT-4o Vision (AI insights)

**Security:**
- Row Level Security (RLS) on all tables
- Service role key server-side only
- SSRF protection (blocks localhost/private IPs)
- Rate limiting (per-IP)
- Private storage bucket with signed URLs (6-hour expiry)

### Folder Structure

```
AIDQA/
├── src/                    # Frontend (React + Vite)
│   ├── components/         # shadcn/ui components
│   ├── core/              # Pure TS design analyzer (zero deps)
│   ├── lib/               # API client + utils
│   └── pages/             # Route pages (Index, VisualRun)
│
├── supabase/
│   ├── functions/
│   │   └── visual-api/    # Edge Function (Deno)
│   │       ├── index.ts   # Router + CORS
│   │       ├── _lib/      # Shared utilities
│   │       │   ├── supabaseServer.ts
│   │       │   ├── storage.ts
│   │       │   ├── rateLimit.ts
│   │       │   ├── ssrfGuard.ts
│   │       │   ├── openai.ts
│   │       │   └── types.ts
│   │       └── visual/    # Route handlers
│   │           ├── handlers.ts
│   │           ├── capture.ts  (remote browser)
│   │           └── diff.ts     (PNG comparison)
│   └── sql/
│       └── 001_init.sql   # Database schema
│
├── .env.example           # Environment template
└── README.md
```

## API Reference

Base URL: `https://<project-ref>.supabase.co/functions/v1/visual-api`

### Endpoints

**Health Check**
```
GET /health
```

**Create Baseline**
```
POST /api/v1/visual/baselines
Content-Type: application/json

{
  "projectId": "demo",
  "name": "Homepage",
  "url": "https://example.com",
  "viewport": { "width": 1440, "height": 900 }
}
```

**List Baselines**
```
GET /api/v1/visual/baselines?projectId=demo
```

**Create Run**
```
POST /api/v1/visual/baselines/{baselineId}/runs
```

**List Runs**
```
GET /api/v1/visual/baselines/{baselineId}/runs
```

**Get Run Details**
```
GET /api/v1/visual/baselines/{baselineId}/runs/{runId}

Response includes:
- mismatchPercentage, diffPixels
- Signed URLs for baseline/current/diff images
- aiJson (if AI insights enabled)
```

## Where to See Data in Supabase

**Database (Table Editor):**
1. Go to Supabase Dashboard → Database → Table Editor
2. View tables:
   - `visual_baselines` - All baseline metadata
   - `visual_runs` - All run results with AI insights

**Storage (Bucket Browser):**
1. Go to Supabase Dashboard → Storage
2. Browse `visual` bucket:
   - `<projectId>/baselines/<baselineId>/baseline.png`
   - `<projectId>/baselines/<baselineId>/runs/<runId>/current.png`
   - `<projectId>/baselines/<baselineId>/runs/<runId>/diff.png`
   - `<projectId>/baselines/<baselineId>/runs/<runId>/result.json`

## Troubleshooting

**"Rate limit exceeded"**
- Wait 1 minute or increase `RATE_LIMIT_PER_MINUTE`

**"URL not allowed" (SSRF error)**
- Using localhost/private IP? Deploy to public URL
- Set `ALLOWED_HOSTS` if you need specific whitelisting

**Images not loading in UI**
- Check Storage bucket is created and named `visual`
- Verify `STORAGE_BUCKET` secret matches bucket name
- Signed URLs expire after 6 hours (refresh the page)

**AI insights not showing**
- Set `OPENAI_API_KEY` in Edge Function secrets
- Ensure `AI_ENABLED=true` (default)
- Check Edge Function logs for OpenAI API errors

**Screenshots failing**
- Verify `BROWSERLESS_WS_ENDPOINT` is correct
- Test Browserless connection manually
- Check Browserless.io plan limits

## Legacy Notes

### Run the API locally

In one terminal:

```bash
npm run dev:api
```

In another terminal (web UI):

```bash
npm run dev
## Legacy Notes

The old Express.js server (`server/`) has been replaced with Supabase Edge Functions. 
If you need to reference the old implementation, check git history before this migration.

**Migration changes:**
- Local filesystem → Supabase Storage
- Express + Node.js → Deno Edge Functions
- Local Playwright → Remote browser (Browserless)
- No authentication → Service role key (server-side only)
- Added AI insights via OpenAI
- Added SSRF protection + rate limiting

## Contributing

PRs welcome! Please ensure:
- TypeScript strict mode passes
- All tests pass (`npm test`)
- Follow existing code style
- Update README if adding features

## License

MIT
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "demo",
    "name": "Homepage Hero from Figma",
    "figmaSource": {
      "figmaFileKey": "ABC123DEF456",
      "figmaNodeIds": ["1:23", "2:45"]
    },
    "viewport": {"width": 1440, "height": 900}
  }'
```

**Requirements:**
- Set `FIGMA_ACCESS_TOKEN` in `.env`
- Get file key from Figma URL: `figma.com/design/{fileKey}/...`
- Get node IDs: right-click frame → Copy link → extract `node-id=1-23` → convert to `1:23`

#### (2) Create run (capture current + compare)

```bash
curl -X POST http://localhost:8787/api/v1/visual/baselines/<BASELINE_ID>/runs \
  -H "Content-Type: application/json" \
  -d '{}'
```

#### (3) Get run result

```bash
curl http://localhost:8787/api/v1/visual/baselines/<BASELINE_ID>/runs/<RUN_ID>
```

#### (4) List baselines

```bash
curl "http://localhost:8787/api/v1/visual/baselines?projectId=demo"
```

#### (5) List runs for a baseline

```bash
curl http://localhost:8787/api/v1/visual/baselines/<BASELINE_ID>/runs
```

### Minimal viewer (optional)

If the web UI is running, you can view a run at:

`/visual/baselines/:baselineId/runs/:runId`

### Deploying the UI (static) + API (separate)

The visual regression feature is **server-side** (Playwright + filesystem storage), so it cannot run on GitHub Pages by itself.

To make the hosted UI work:

1. Deploy the API somewhere that can run Playwright (container VM is easiest).
2. Set `VITE_API_BASE_URL` when building the UI, e.g.:

```bash
VITE_API_BASE_URL="https://your-api-host.example" npm run build
```

This makes the UI call `https://your-api-host.example/api/v1/visual/...` instead of `/api/v1/visual/...`.

## Example Usage

### Design System Configuration

```typescript
const system: DesignSystem = {
  colors: ['#000000', '#FFFFFF', '#0A84FF', '#FF3B30'],
  spacingScale: [4, 8, 12, 16, 20, 24, 32],
  textStyles: ['H1', 'H2', 'Body', 'Caption'],
  components: ['Button/Primary', 'Input/Default', 'Card/Standard']
};
```

### Design Tree Example

```typescript
const designNode: DesignNode = {
  id: "root",
  name: "Login Screen",
  type: "FRAME",
  children: [
    {
      id: "btn-1",
      name: "Submit Button",
      type: "RECTANGLE",
      fills: [{ type: "SOLID", color: { r: 0.1, g: 0.5, b: 0.9 } }],
      spacing: 18,
      componentName: "Button/Custom"
    },
    {
      id: "txt-1",
      name: "Heading",
      type: "TEXT",
      textStyle: "Heading1",
      foregroundColor: { r: 0.5, g: 0.5, b: 0.5 },
      backgroundColor: { r: 1, g: 1, b: 1 }
    }
  ]
};
```

### Running Analysis

```typescript
import { analyzeDesign } from './src/core';

const result = analyzeDesign(designNode, system);
console.log(`Found ${result.totalIssues} issues`);
console.log(`Breakdown:`, result.byType);
```

## Future: Figma Plugin Integration

This core module is designed to be integrated into a Figma plugin. A Figma plugin can:

1. **Traverse real Figma nodes** using the Figma Plugin API
2. **Map Figma nodes** to the `DesignNode` type defined in `src/core/types.ts`
3. **Import and call** `analyzeDesign()` from the core module
4. **Display issues** in the Figma plugin UI with "Select in Figma" and "Fix automatically" actions

The separation of concerns means:
- Core logic is **testable** without Figma
- Core logic is **reusable** across web, CLI, or plugin environments
- Plugin development focuses on **UI and Figma API integration** only

## Technologies

This project is built with:

- **Core**: Pure TypeScript (no dependencies)
- **Demo UI**: React + Vite
- **Styling**: Tailwind CSS + shadcn-ui
- **Type Safety**: TypeScript throughout

## How can I deploy this project?

Build the production assets and deploy them to any static hosting provider (Vercel, Netlify, GitHub Pages, etc.).

```sh
npm run build
```

Follow your hosting provider's documentation to upload the `dist/` output or connect the repository for automatic deployments.

## Figma Plugin (AIDQA – AI Design QA)

This repository includes a simple Figma plugin demo in the `plugin/` folder.

- Build plugin:

```bash
npm run build:plugin
```

- Load into Figma:

  1. In Figma, go to Plugins → Development → Import plugin from manifest…
  2. Select `plugin/manifest.json` from this repo.
  3. Run the plugin, select a frame, and click “Scan selection”.

The plugin compiles `plugin/code.ts` to `plugin/dist/code.js` and will use `plugin/ui.html` for the sidebar UI.

