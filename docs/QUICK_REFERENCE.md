# Supabase Edge Function - Quick Reference

## 🚀 Quick Deploy (30 minutes)

```bash
# 1. Setup
supabase link --project-ref YOUR_REF
supabase db push
cp supabase/.env.local.example supabase/.env.local
# Edit .env.local with your credentials

# 2. Test Locally
supabase functions serve visual-api --env-file ./supabase/.env.local
curl http://localhost:54321/functions/v1/visual-api/health

# 3. Deploy
supabase functions deploy visual-api
supabase secrets set SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=... BROWSERLESS_WS_ENDPOINT=wss://...

# 4. Configure Vercel
# Add env var: VITE_API_BASE_URL=https://YOUR_PROJECT.supabase.co/functions/v1/visual-api
vercel --prod
```

## 📝 Essential Commands

### Local Development
```bash
# Start Edge Function locally
supabase functions serve visual-api --env-file ./supabase/.env.local

# Test health
curl http://localhost:54321/functions/v1/visual-api/health

# Create baseline (local)
curl -X POST http://localhost:54321/functions/v1/visual-api/api/v1/visual/baselines \
  -H "Content-Type: application/json" \
  -d '{"project_id":"test","name":"Test","url":"https://example.com","viewport":{"width":1440,"height":900}}'
```

### Production
```bash
# Deploy function
supabase functions deploy visual-api

# View logs
supabase functions logs visual-api --tail

# List secrets
supabase secrets list

# Set secret
supabase secrets set KEY=value

# Test health
curl https://YOUR_PROJECT.supabase.co/functions/v1/visual-api/health
```

### Database
```bash
# Push migrations
supabase db push

# Pull remote schema
supabase db pull

# Connect to remote DB
supabase db remote connect

# Reset local DB
supabase db reset
```

## 🔑 Required Environment Variables

### Edge Function (Supabase Secrets)
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
BROWSERLESS_WS_ENDPOINT=wss://chrome.browserless.io?token=YOUR_TOKEN
STORAGE_BUCKET=visual
ENVIRONMENT=production
```

### Frontend (Vercel)
```bash
VITE_API_BASE_URL=https://your-project.supabase.co/functions/v1/visual-api
```

## 🧪 Testing Checklist

### Local
- [ ] `supabase functions serve` → no errors
- [ ] `curl .../health` → `{"ok":true}`
- [ ] Create baseline → 201 response
- [ ] Image in Storage bucket
- [ ] Row in `baselines` table

### Production
- [ ] `supabase functions deploy` → success
- [ ] `curl .../health` → `{"ok":true}`
- [ ] Create baseline from Vercel app → success
- [ ] No CORS errors
- [ ] Images accessible in Storage

## 📁 Project Structure

```
supabase/
├── functions/
│   └── visual-api/
│       ├── index.ts              # Entry point + CORS
│       ├── router.ts             # Route handling
│       └── services/
│           ├── serverlessBrowser.ts  # Screenshot via WS
│           ├── imageDiff.ts          # Pixel comparison
│           ├── storage.ts            # Supabase Storage
│           └── database.ts           # Postgres queries
├── migrations/
│   └── 20260121000000_visual_regression.sql
└── .env.local.example
```

## 🐛 Common Issues

| Issue | Fix |
|-------|-----|
| "BROWSERLESS_WS_ENDPOINT is required" | `supabase secrets set BROWSERLESS_WS_ENDPOINT=...` |
| "Screenshot capture failed" | Check Browserless token & quota |
| "Storage upload failed" | Verify `visual` bucket exists |
| CORS errors | Update CORS in `index.ts` |
| "Baseline not found" | Run `supabase db push` |

## 📊 Monitoring

```bash
# Real-time logs
supabase functions logs visual-api --tail

# Check database
supabase db remote connect
> SELECT * FROM baselines ORDER BY created_at DESC LIMIT 5;

# Check storage usage
# Go to Supabase Dashboard → Storage → visual
```

## 💰 Cost Tracking

- **Supabase**: Dashboard → Settings → Billing
- **Browserless**: Dashboard → Usage
- **Vercel**: Dashboard → Usage

## 🔗 Useful Links

- **Supabase Dashboard**: https://app.supabase.com
- **Browserless Dashboard**: https://cloud.browserless.io
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Deployed App**: https://aidqa.vercel.app
- **Docs**: [docs/SUPABASE_DEPLOYMENT.md](docs/SUPABASE_DEPLOYMENT.md)

## 🆘 Get Help

1. Check logs: `supabase functions logs visual-api --tail`
2. Read full guide: [docs/SUPABASE_DEPLOYMENT.md](docs/SUPABASE_DEPLOYMENT.md)
3. Use checklist: [docs/DEPLOYMENT_CHECKLIST.md](docs/DEPLOYMENT_CHECKLIST.md)
4. Check GitHub Issues (if open source)

---

**Last Updated**: January 21, 2026  
**Version**: 1.0.0  
**Status**: ✅ Production Ready
