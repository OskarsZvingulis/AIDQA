# Brand Fitting (AIDQA)

An automated design quality assurance tool that scans design files for inconsistencies in design systems, brand standards, and accessibility. Now with **visual regression testing** and **Figma integration**.

## Project Overview

**Problem**: Design teams waste 20-30% of their time fixing inconsistencies in spacing, colors, typography, and components. Handoffs to developers are messy, and enterprises lose thousands per week on preventable design errors.

**Solution**: AIDQA automatically:
- Analyzes design trees against design system rules
- Performs pixel-perfect visual regression testing
- Compares Figma designs against live implementations
- Returns actionable suggestions to fix inconsistencies

## Features

### 1. Design System Analyzer
- **Pure TypeScript** core module (zero dependencies)
- Detects 5 categories: spacing, color, text, component, accessibility
- Works in any environment (web, CLI, Figma plugin)
- Configurable design system tokens

### 2. Visual Regression Testing
- **Playwright-based** screenshot capture with deterministic settings
- **Exact pixel-perfect** PNG comparison (pngjs)
- Baseline/run management with diff visualization
- URL-based and **Figma-based** content capture
- REST API + web UI for creating/viewing tests

### 3. Figma Integration ✨ NEW
- **Fetch design content** from Figma REST API
- **Compare Figma designs** vs live implementations
- Helps validate design handoff accuracy
- Reduces design-vs-code inconsistencies

Note: This project ships with a default design system configuration called **NorthStar Dashboard**. You can edit the full design system JSON in the web UI to simulate different token sets.

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

## How can I run this locally?

There are several ways of editing your application.

**Working locally**

If you want to work locally using your preferred IDE, clone this repo and install dependencies. The only requirement is Node.js & npm (or pnpm/yarn).

Quick start:

```bash
# 1. Install dependencies
npm install

# 2. Install Playwright browsers (for visual regression)
npx playwright install chromium

# 3. Set up environment (optional: for Figma integration)
cp .env.example .env
# Edit .env and add your FIGMA_ACCESS_TOKEN

# 4. Start development servers
npm run dev:api  # Backend API on http://localhost:8787
npm start        # Frontend UI on http://localhost:8080

# 5. Run tests
npm test
```

Open http://localhost:8080 to access the web UI.

📖 **Figma Setup:** See [docs/FIGMA_SETUP.md](docs/FIGMA_SETUP.md) for detailed instructions on getting your Figma access token and using Figma integration.

📋 **Roadmap:** See [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md) for the full development plan.sh
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
npm install
npm run dev
```

## Visual Regression API (MVP)

This repo is primarily a frontend + core TypeScript analyzer, but it also includes a small Node/Express API for **pixel-perfect visual regression** under `/api/v1/visual`.

### Run the API locally

In one terminal:

```bash
npm run dev:api
```

In another terminal (web UI):

```bash
npm run dev
```

Notes:

- The API listens on `http://localhost:8787` by default.
- The Vite dev server proxies `/api/*` and `/storage/*` to the API automatically.
- If you deploy the UI as a static site (GitHub Pages / static Vercel), you must deploy the API separately and configure the UI to call it (see below).
- Playwright may require installing browsers once:

```bash
npx playwright install
```

### Storage layout

Artifacts are stored on local filesystem under:

```
./storage/visual/{projectId}/{baselineId}/baseline.png
./storage/visual/{projectId}/{baselineId}/runs/{runId}/current.png
./storage/visual/{projectId}/{baselineId}/runs/{runId}/diff.png
./storage/visual/{projectId}/{baselineId}/runs/{runId}/result.json
```

Artifacts are served (dev/MVP) via:

`GET /storage/visual/...`

### API endpoints

Base path: `/api/v1/visual`

**📖 Full Figma Guide:** [docs/FIGMA_SETUP.md](docs/FIGMA_SETUP.md)

#### (1) Create baseline (URL-based)

```bash
curl -X POST http://localhost:8787/api/v1/visual/baselines \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "demo",
    "name": "Example",
    "url": "https://example.com",
    "viewport": {"width": 1440, "height": 900}
  }'
```

#### (1b) Create baseline (Figma-based) ✨

```bash
curl -X POST http://localhost:8787/api/v1/visual/baselines \
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

