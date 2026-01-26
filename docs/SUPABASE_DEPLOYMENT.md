# Supabase Edge Function Deployment Guide

## Overview

The Visual Regression API has been migrated from a local Express server to Supabase Edge Functions. This enables full hosted deployment on Vercel with a serverless backend.

## Architecture

```
┌─────────────────────┐
│  Vercel Frontend    │
│  aidqa.vercel.app   │
└──────────┬──────────┘
           │ HTTPS
           ↓
┌─────────────────────────────────────────┐
│  Supabase Edge Function (Deno)          │
│  /functions/v1/visual-api                │
│                                          │
│  Routes:                                 │
│  - GET  /health                          │
│  - POST /api/v1/visual/baselines         │
│  - POST /api/v1/visual/baselines/:id/runs│
│  - GET  /api/v1/visual/baselines         │
│  - GET  /api/v1/visual/baselines/:id     │
└──────────┬──────────────────────────────┘
           │
           ├─→ Supabase Postgres (metadata)
           ├─→ Supabase Storage (images)
           └─→ Browserless WS (screenshots)
```

## Prerequisites

1. **Supabase Account**: Sign up at [supabase.com](https://supabase.com)
2. **Supabase CLI**: Install globally
   ```bash
   npm install -g supabase
   ```
3. **Browserless Account** (or alternative):
   - Option 1: [Browserless.io](https://browserless.io) (recommended, $10/mo)
   - Option 2: [Bright Data](https://brightdata.com) Browser API
   - Option 3: Self-hosted Chrome with WebSocket

## Step 1: Initialize Supabase Project

```bash
# Link to your Supabase project
supabase link --project-ref your-project-ref

# Or create a new project
supabase init
```

## Step 2: Run Database Migrations

```bash
# Apply the visual regression schema
supabase db push

# Or manually run the migration
supabase migration up
```

This creates three tables:
- `baselines` - Reference screenshots
- `runs` - Test run results
- `artifacts` - Image storage paths

## Step 3: Create Storage Bucket

1. Go to Supabase Dashboard → Storage
2. Create a new bucket named `visual`
3. Make it **public** (or configure signed URLs in production)

## Step 4: Configure Environment Variables

1. Copy the example file:
   ```bash
   cp supabase/.env.local.example supabase/.env.local
   ```

2. Fill in your values:
   ```bash
   # Get from Supabase Dashboard → Settings → API
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

   # Get from Browserless.io dashboard
   BROWSERLESS_WS_ENDPOINT=wss://chrome.browserless.io?token=YOUR_API_KEY

   # Optional
   STORAGE_BUCKET=visual
   ENVIRONMENT=production
   ```

## Step 5: Test Locally

```bash
# Start the Edge Function locally
supabase functions serve visual-api --env-file ./supabase/.env.local

# In another terminal, test it
curl http://localhost:54321/functions/v1/visual-api/health
# Expected: {"ok":true,"service":"visual-api",...}

# Test baseline creation
curl -X POST http://localhost:54321/functions/v1/visual-api/api/v1/visual/baselines \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "test",
    "name": "Homepage",
    "url": "https://example.com",
    "viewport": {"width": 1440, "height": 900}
  }'
```

## Step 6: Deploy to Supabase

```bash
# Deploy the function
supabase functions deploy visual-api

# Set environment secrets (required for production)
supabase secrets set \
  SUPABASE_URL=https://your-project.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=your-key \
  BROWSERLESS_WS_ENDPOINT=wss://chrome.browserless.io?token=your-token \
  STORAGE_BUCKET=visual \
  ENVIRONMENT=production
```

## Step 7: Configure Vercel Frontend

1. **Get your Edge Function URL**:
   ```
   https://your-project.supabase.co/functions/v1/visual-api
   ```

2. **Set in Vercel Environment Variables**:
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add:
     ```
     VITE_API_BASE_URL=https://your-project.supabase.co/functions/v1/visual-api
     ```

3. **Redeploy** your Vercel app to pick up the new variable

## Step 8: Verify Deployment

### Test Health Endpoint
```bash
curl https://your-project.supabase.co/functions/v1/visual-api/health
```

Expected response:
```json
{
  "ok": true,
  "service": "visual-api",
  "timestamp": "2026-01-21T..."
}
```

### Test Baseline Creation
```bash
curl -X POST https://your-project.supabase.co/functions/v1/visual-api/api/v1/visual/baselines \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-anon-key" \
  -d '{
    "project_id": "production-test",
    "name": "Homepage Test",
    "url": "https://example.com",
    "viewport": {"width": 1440, "height": 900}
  }'
```

Expected response (201):
```json
{
  "baselineId": "uuid-here",
  "projectId": "production-test",
  "name": "Homepage Test",
  "url": "https://example.com",
  "viewport": {"width": 1440, "height": 900},
  "baselineImagePath": "https://...supabase.co/storage/v1/object/public/visual/...",
  "createdAt": "2026-01-21T..."
}
```

### Test from Vercel Frontend

1. Go to https://aidqa.vercel.app
2. Navigate to Visual Regression section
3. Fill in:
   - Project ID: `my-project`
   - Baseline Name: `Homepage`
   - URL: `https://example.com`
4. Click "Create Baseline"
5. Should succeed without errors!

## Troubleshooting

### "BROWSERLESS_WS_ENDPOINT is required"
- Ensure you set the secret: `supabase secrets set BROWSERLESS_WS_ENDPOINT=...`
- Check it's set: `supabase secrets list`

### "Screenshot capture failed"
- Verify your Browserless token is valid
- Check Browserless.io dashboard for API usage/errors
- Try the WebSocket URL manually in a browser tool

### "Storage upload failed"
- Ensure the `visual` bucket exists in Supabase Storage
- Check bucket is public or RLS policies allow writes
- Verify SUPABASE_SERVICE_ROLE_KEY is correct

### CORS errors from Vercel
- Edge Function CORS is currently set to `*` (allow all)
- For production, update `index.ts` to restrict origins:
  ```typescript
  const corsHeaders = {
    "Access-Control-Allow-Origin": "https://aidqa.vercel.app",
    // ...
  };
  ```

### "Baseline not found" errors
- Check Supabase Dashboard → Table Editor → `baselines`
- Ensure migration ran successfully: `supabase db pull`

## Cost Estimation

- **Supabase**: Free tier → 500MB DB, 1GB storage, 2M Edge Function invocations/month
- **Browserless**: $10/mo for 2000 minutes (≈2000 screenshots)
- **Total**: ~$10/mo for moderate usage

## Local Development

For local development, you can still use the Express API:

```bash
# Terminal 1: Local Express API
npm run dev:api

# Terminal 2: Vite frontend
npm run dev:ui
```

The Vite proxy will forward `/api` to `localhost:8787`.

For hosted Supabase testing locally:
```bash
# Start Supabase function locally
supabase functions serve visual-api --env-file ./supabase/.env.local

# Update your local .env
VITE_API_BASE_URL=http://localhost:54321/functions/v1/visual-api

# Start Vite
npm run dev:ui
```

## Rollback Plan

If you need to rollback to the Express API:

1. Remove `VITE_API_BASE_URL` from Vercel env vars
2. Deploy Express API to a separate service (Render, Railway, etc.)
3. Set `VITE_API_BASE_URL=https://your-express-api.com`

The frontend is compatible with both backends!
