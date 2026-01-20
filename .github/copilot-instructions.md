# AIDQA Copilot Instructions

## Code Generation Rules
- **No narration**: Never claim files were created/edited/tests ran unless terminal output confirms it
- **Minimal diffs**: Make smallest safe change; no refactors unless explicitly requested
- **Respect boundaries**: Core module (`src/core/`) must have zero dependencies (React/DOM/Figma)

## Architecture (Three-Layer Separation)

**Core** (`src/core/`)
- Pure TypeScript: `types.ts`, `analyzer.ts`, `utils.ts`
- Import: `import { analyzeDesign } from '../src/core/analyzer'`

**Server** (`server/`)
- Express app via `createApp()` → `server/index.ts`
- Services: `captureScreenshot`, `comparePngExact`, `fetchFigmaContent`, `storage`
- File-based storage in `storage/` (no DB yet)

**Frontend** (`src/`)
- React + Vite + shadcn/ui + TanStack Query
- Pages: `Index.tsx`, `VisualRun.tsx`

## Key User Workflow
**Visual Regression**: Baseline → Run → Pixel Diff
1. POST `/api/v1/visual/baselines` with `url` XOR `figmaSource`
2. Playwright captures screenshot → saves to `storage/{projectId}/{baselineId}/baseline.png`
3. POST `/api/v1/visual/baselines/{id}/runs` creates comparison
4. `comparePngExact()` pixel-diffs → returns `mismatchPixelCount`, diff PNG

## Validation & Security
- **API inputs**: Zod schemas with `.strict()` + `.refine()` for XOR validation
- **File paths**: Use `path.resolve(process.cwd(), 'storage')`, normalize to forward slashes
- **Secrets**: NEVER log `FIGMA_ACCESS_TOKEN` or env vars

## Critical Patterns
- **Figma node IDs**: Must use `"1:23"` format (NOT `"1-23"`)
- **shadcn/ui**: `import { Button } from "@/components/ui/button"`
- **Zod XOR**:
  ```typescript
  .refine((data) => data.url || data.figmaSource, { message: 'Either url or figmaSource required' })
  ```

## Dev Commands
```bash
npm run dev:api  # API on :8787
npm start        # UI on :8080 (proxies /api and /storage to API)
npm test         # Vitest (**/__tests__/*.test.ts)
```

## References
- Roadmap: `PROJECT_ROADMAP.md`
- Figma setup: `docs/FIGMA_SETUP.md`
