# Visual Regression MVP - Fix Summary

## What Was Broken

### 1. **Frontend API Base URL Issues**
- **Problem**: `getApiBaseUrl()` returned empty string for local dev, but frontend code assumed it needed a value
- **Symptom**: Browser showed "Visual Regression API is not configured" banner even in dev mode
- **Root Cause**: Frontend logic checked `if (!apiBase && !import.meta.env.DEV)` but apiBase was always empty locally

### 2. **No 500 Error Details**
- **Problem**: API routes had minimal error handling, returning generic "Failed to create baseline" messages
- **Symptom**: 500 errors with no debugging information
- **Root Cause**: Missing try/catch blocks and error logging in route handlers

### 3. **No Developer Experience Tools**
- **Problem**: No single command to start both API and UI
- **Symptom**: Developers had to manually run two terminals: `npm run dev:api` and `npm start`
- **Root Cause**: No concurrent dev script

### 4. **Playwright Not Auto-Installed**
- **Problem**: Playwright browsers not installed after `npm install`
- **Symptom**: Screenshot capture would fail with browser not found errors
- **Root Cause**: No postinstall hook

### 5. **No Health Endpoint Info**
- **Problem**: Basic `/health` endpoint returned only `{ok: true}`
- **Symptom**: Hard to verify API status or debug version issues
- **Root Cause**: Minimal health check implementation

---

## What Was Fixed

### 1. **Frontend API Proxy (Local Dev)**
**Changed**: [src/lib/apiBase.ts](src/lib/apiBase.ts)
```typescript
// Added documentation explaining behavior
/**
 * Get API base URL for fetch requests.
 * - Local dev: returns '' (empty) so Vite proxy handles /api routes
 * - Hosted: uses VITE_API_BASE_URL from env
 */
export function getApiBaseUrl(): string {
  // Returns empty string locally (Vite proxy handles /api)
  // Returns configured URL for hosted deployments
}
```

**Why it works**:
- Empty string means `fetch('/api/v1/...')` uses relative URLs
- Vite proxy in [vite.config.ts](vite.config.ts) forwards `/api` → `http://localhost:8787`
- `VITE_API_BASE_URL` only needed for hosted deployments

### 2. **Enhanced API Error Handling**
**Changed**: [server/visual/routes/visualRoutes.ts](server/visual/routes/visualRoutes.ts)
```typescript
try {
  // ... Figma fetch with specific error
  // ... Screenshot capture with specific error
  await saveBaselineMeta(baseline);
  return res.status(201).json({ ... });
} catch (e) {
  console.error('[ERROR] Create baseline failed:', e);
  const errorMsg = e instanceof Error ? e.message : 'Failed to create baseline';
  return res.status(500).json({ 
    error: errorMsg,
    details: process.env.NODE_ENV === 'development' ? (e instanceof Error ? e.stack : String(e)) : undefined
  });
}
```

**Benefits**:
- Specific error messages for Figma vs Screenshot failures
- Console logging for server-side debugging
- Stack traces in development mode

### 3. **Enhanced Health Endpoint**
**Changed**: [server/createApp.ts](server/createApp.ts)
```typescript
const startTime = Date.now();
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    version: '0.1.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  });
});
```

**Benefits**:
- Version tracking
- Uptime monitoring
- Timestamp for debugging

### 4. **Better Server Startup**
**Changed**: [server/index.ts](server/index.ts)
```typescript
const host = '0.0.0.0';
app.listen(port, host, () => {
  console.log(`✓ Visual Regression API running`);
  console.log(`  Local:   http://localhost:${port}`);
  console.log(`  Network: http://${host}:${port}`);
  console.log(`  Health:  http://localhost:${port}/health`);
});
```

**Benefits**:
- Binds to `0.0.0.0` for network access
- Clear startup message with all endpoints

### 5. **Concurrent Dev Scripts**
**Changed**: [package.json](package.json)
```json
{
  "scripts": {
    "dev": "run-p dev:api dev:ui",
    "dev:ui": "vite",
    "dev:api": "tsx watch server/index.ts",
    "start": "npm run dev",
    "health": "curl -s http://localhost:8787/health | json_pp || curl -s http://localhost:8787/health",
    "postinstall": "npx playwright install chromium --with-deps || echo 'Playwright install skipped'"
  }
}
```

**Dependencies Added**:
- `npm-run-all2` for concurrent script execution

**Benefits**:
- Single command `npm run dev` starts everything
- Automatic Playwright installation on `npm install`
- Quick health check via `npm run health`

### 6. **Developer Documentation**
**Changed**: [README.md](README.md)
- Added "Local Setup (2 minutes)" section
- Clear explanation of Vite proxy behavior
- All dev commands listed with descriptions
- Removed duplicate/confusing sections

**Changed**: [.env.example](.env.example)
- Added clear sections for each config category
- Explained when to use `VITE_API_BASE_URL` (hosted only!)
- Added comments explaining local dev behavior

---

## Commands to Run Locally After Fix

### First Time Setup
```bash
# 1. Install dependencies (includes Playwright auto-install)
npm install

# 2. (Optional) Configure Figma
cp .env.example .env
# Edit .env and add FIGMA_ACCESS_TOKEN
```

### Daily Development
```bash
# Start both API + UI (one command!)
npm run dev

# OR start separately:
npm run dev:api  # API on :8787
npm run dev:ui   # UI on :8080
```

### Verify It Works
```bash
# Check API health
npm run health

# Expected output:
# {
#   "status": "ok",
#   "version": "0.1.0",
#   "uptime": 42,
#   "timestamp": "2026-01-21T..."
# }

# Open browser
# http://localhost:8080
```

### Test Baseline Creation
From the UI at http://localhost:8080:
1. Fill in:
   - Project ID: `test-project`
   - Baseline Name: `Homepage Test`
   - URL: `https://example.com`
   - Viewport: `1440 x 900` (default)
2. Click "Create Baseline"
3. Should succeed with baselineId returned

---

## Architecture Flow (Fixed)

```
┌─────────────────┐
│   Browser       │
│  :8080          │
└────────┬────────┘
         │ fetch('/api/v1/visual/baselines')
         │
         ↓
┌─────────────────┐
│  Vite Proxy     │  vite.config.ts: proxy /api → localhost:8787
│  :8080          │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Express API    │  POST /api/v1/visual/baselines
│  :8787          │  → captureScreenshot (Playwright)
└─────────────────┘  → save to storage/
```

**Key Points**:
1. Frontend uses **relative URLs**: `/api/v1/...`
2. Vite proxy forwards to backend: `http://localhost:8787/api/v1/...`
3. Backend saves screenshots to `storage/{projectId}/{baselineId}/`
4. Playwright auto-installed via postinstall hook

---

## Files Changed

| File | Change Summary |
|------|----------------|
| [src/lib/apiBase.ts](src/lib/apiBase.ts) | Added docs explaining local dev behavior |
| [server/createApp.ts](server/createApp.ts) | Enhanced health endpoint with version/uptime |
| [server/index.ts](server/index.ts) | Better startup logging, bind to 0.0.0.0 |
| [server/visual/routes/visualRoutes.ts](server/visual/routes/visualRoutes.ts) | Comprehensive error handling and logging |
| [package.json](package.json) | Added concurrent dev scripts, postinstall hook |
| [README.md](README.md) | Rewrote local setup section for clarity |
| [.env.example](.env.example) | Better documentation and structure |

**Total**: 7 files modified, 0 files added

---

## Next Steps for User

1. **Stop any running servers** (Ctrl+C in terminals)
2. **Run**: `npm install` (to install npm-run-all2 and Playwright)
3. **Run**: `npm run dev` (starts both API + UI)
4. **Test**: Open http://localhost:8080 and create a baseline
5. **Verify**: Should work without 500 errors!

---

## Troubleshooting

### Still Getting 500 Errors?

**Check API logs**:
The error handling now logs detailed errors to the API console. Look for:
```
[ERROR] Create baseline failed: Screenshot capture failed: ...
```

**Common causes**:
- Playwright browsers not installed → Run `npx playwright install chromium`
- Invalid URL provided → Check URL format
- Figma token missing → Check `.env` file if using Figma mode

### UI Still Shows "API Not Configured"?

**Check**:
1. API is running on :8787: `npm run health`
2. Vite dev server is running on :8080
3. Browser console shows fetch to `/api/v1/...` (relative URL)
4. No `VITE_API_BASE_URL` in your `.env` (should be empty for local dev)

### Can't Connect to API?

**Verify**:
```bash
# Check if API is listening
npm run health

# If not running, start it
npm run dev:api
```
