# Supabase Edge Function Migration - Verification Checklist

## Pre-Deployment Checklist

### Supabase Setup
- [ ] Supabase project created
- [ ] Supabase CLI installed: `npm install -g supabase`
- [ ] Project linked: `supabase link --project-ref YOUR_REF`
- [ ] Database migration applied: `supabase db push`
- [ ] Storage bucket `visual` created and configured as public

### Remote Browser Service
- [ ] Browserless.io account created (or alternative)
- [ ] API key/token obtained
- [ ] WebSocket endpoint tested manually

### Environment Variables
- [ ] `supabase/.env.local` created and configured:
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `BROWSERLESS_WS_ENDPOINT`
  - [ ] `STORAGE_BUCKET=visual`

## Local Testing

```bash
# Start Edge Function locally
supabase functions serve visual-api --env-file ./supabase/.env.local
```

### Test Health Endpoint
```bash
curl http://localhost:54321/functions/v1/visual-api/health
```
**Expected:**
```json
{"ok":true,"service":"visual-api","timestamp":"2026-01-21T..."}
```
- [ ] Health endpoint returns 200 OK
- [ ] Response includes `service: "visual-api"`

### Test Baseline Creation
```bash
curl -X POST http://localhost:54321/functions/v1/visual-api/api/v1/visual/baselines \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "test-local",
    "name": "Example Homepage",
    "url": "https://example.com",
    "viewport": {"width": 1440, "height": 900}
  }'
```

**Expected:** 201 Created with:
- [ ] `baselineId` UUID returned
- [ ] `baselineImagePath` URL points to Supabase Storage
- [ ] Check Supabase Storage → `visual` bucket → file exists
- [ ] Check Postgres → `baselines` table → row inserted

### Test Run Creation
```bash
# Use baselineId from previous response
curl -X POST http://localhost:54321/functions/v1/visual-api/api/v1/visual/baselines/YOUR_BASELINE_ID/runs \
  -H "Content-Type: application/json" \
  -d '{"viewport": {"width": 1440, "height": 900}}'
```

**Expected:** 201 Created with:
- [ ] `runId` UUID returned
- [ ] `status` is "PASS", "FAIL", or "ERROR"
- [ ] `metrics.mismatchPixelCount` is a number
- [ ] `artifacts.current` URL points to current screenshot
- [ ] `artifacts.diff` URL points to diff image (if FAIL)
- [ ] Check Postgres → `runs` table → row inserted
- [ ] Check Postgres → `artifacts` table → 2-3 rows inserted

## Deployment

```bash
# Deploy function
supabase functions deploy visual-api

# Set production secrets
supabase secrets set \
  SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=YOUR_KEY \
  BROWSERLESS_WS_ENDPOINT=wss://chrome.browserless.io?token=YOUR_TOKEN \
  STORAGE_BUCKET=visual \
  ENVIRONMENT=production
```

- [ ] Function deployed without errors
- [ ] All secrets set: `supabase secrets list`

## Production Testing

### Test Health Endpoint
```bash
curl https://YOUR_PROJECT.supabase.co/functions/v1/visual-api/health
```
- [ ] Returns 200 OK
- [ ] CORS headers present

### Test Baseline Creation (Production)
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/visual-api/api/v1/visual/baselines \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "project_id": "prod-test",
    "name": "Production Test",
    "url": "https://example.com",
    "viewport": {"width": 1440, "height": 900}
  }'
```
- [ ] Returns 201 Created
- [ ] Screenshot captured successfully
- [ ] Image uploaded to Supabase Storage
- [ ] Database records created

## Frontend Integration (Vercel)

### Configure Vercel Environment
- [ ] Go to Vercel Dashboard → Project → Settings → Environment Variables
- [ ] Add `VITE_API_BASE_URL`:
  ```
  https://YOUR_PROJECT.supabase.co/functions/v1/visual-api
  ```
- [ ] Redeploy Vercel app

### Test from Vercel App
- [ ] Visit https://aidqa.vercel.app
- [ ] No "API not configured" banner
- [ ] Create baseline:
  - Project ID: `vercel-test`
  - Name: `Homepage`
  - URL: `https://example.com`
- [ ] Baseline created successfully (201 response)
- [ ] No CORS errors in console
- [ ] Screenshot visible in Supabase Storage

### End-to-End Test
1. **Create Baseline**
   - [ ] Fill form on Vercel app
   - [ ] Submit → Success message
   - [ ] Copy baselineId
   
2. **Create Run**
   - [ ] Paste baselineId
   - [ ] Submit → Run created
   - [ ] See PASS/FAIL status
   - [ ] Diff image visible (if FAIL)

3. **Verify in Supabase Dashboard**
   - [ ] Table Editor → `baselines` → row exists
   - [ ] Table Editor → `runs` → row exists
   - [ ] Table Editor → `artifacts` → 2-3 rows exist
   - [ ] Storage → `visual` → images exist

## Performance & Cost Checks

- [ ] Function cold start < 5 seconds
- [ ] Baseline creation < 30 seconds (depends on Browserless)
- [ ] Run creation < 30 seconds
- [ ] Supabase usage within free tier limits
- [ ] Browserless usage tracked (2000 min/month = ~2000 screenshots)

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| "BROWSERLESS_WS_ENDPOINT is required" | Set secret: `supabase secrets set BROWSERLESS_WS_ENDPOINT=...` |
| "Screenshot capture failed" | Check Browserless token validity, check quota |
| "Storage upload failed" | Verify bucket exists, check RLS policies |
| CORS errors | Update CORS origins in `index.ts` |
| "Baseline not found" | Check database migration ran successfully |

### Debug Commands
```bash
# Check function logs
supabase functions logs visual-api

# Check secrets
supabase secrets list

# Test database connection
supabase db remote connect

# Check storage bucket
# Go to Supabase Dashboard → Storage → visual
```

## Rollback Plan

If deployment fails:

1. **Keep Express API running locally**
   ```bash
   npm run dev:api
   ```

2. **Deploy Express API to external service**
   - Render, Railway, or Fly.io
   - Set `VITE_API_BASE_URL` to that service

3. **Remove Supabase deployment**
   ```bash
   supabase functions delete visual-api
   ```

## Success Criteria

✅ **Deployment Successful** when:
- [ ] All local tests pass
- [ ] All production tests pass
- [ ] Vercel app works end-to-end
- [ ] No errors in Supabase function logs
- [ ] Images visible in Storage
- [ ] Database records created correctly
- [ ] Cost tracking shows expected usage

---

**Date Completed:** _______________  
**Deployed By:** _______________  
**Project Ref:** _______________  
**Function URL:** https://______________.supabase.co/functions/v1/visual-api
