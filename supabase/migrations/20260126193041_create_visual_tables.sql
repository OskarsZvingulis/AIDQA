-- AIDQA Visual Regression Database Schema
-- Apply this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- Enable UUID generation
create extension if not exists pgcrypto;

-- Visual Baselines Table
-- Stores metadata for baseline screenshots
create table if not exists public.visual_baselines (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  name text not null,
  url text not null,
  viewport jsonb not null,  -- {width: number, height: number}
  created_at timestamptz not null default now(),
  baseline_path text not null  -- storage path: visual/<projectId>/baselines/<baselineId>/baseline.png
);

-- Visual Runs Table
-- Stores metadata for each regression test run
create table if not exists public.visual_runs (
  id uuid primary key default gen_random_uuid(),
  baseline_id uuid not null references public.visual_baselines(id) on delete cascade,
  project_id text not null,
  created_at timestamptz not null default now(),
  status text not null default 'completed',  -- completed|failed
  mismatch_percentage numeric not null default 0,
  diff_pixels int not null default 0,
  current_path text not null,  -- storage path to current.png
  diff_path text,  -- storage path to diff.png (nullable if identical)
  result_path text not null,  -- storage path to result.json
  ai_json jsonb  -- nullable AI insights blob
);

-- Indexes for query performance
create index if not exists idx_baselines_project on public.visual_baselines(project_id, created_at desc);
create index if not exists idx_runs_baseline on public.visual_runs(baseline_id, created_at desc);
create index if not exists idx_runs_project on public.visual_runs(project_id, created_at desc);

-- Enable Row Level Security (RLS)
alter table public.visual_baselines enable row level security;
alter table public.visual_runs enable row level security;

-- No public insert/update policies - service role bypasses RLS
-- Anon users cannot write directly to these tables
-- All writes happen server-side via Edge Function with service role key

-- Storage Bucket Setup Instructions:
-- 1. Go to Supabase Dashboard → Storage
-- 2. Create a new bucket named: "visual"
-- 3. Set bucket to PRIVATE (not public)
-- 4. Paths will follow this convention:
--    visual/<projectId>/baselines/<baselineId>/baseline.png
--    visual/<projectId>/baselines/<baselineId>/runs/<runId>/current.png
--    visual/<projectId>/baselines/<baselineId>/runs/<runId>/diff.png
--    visual/<projectId>/baselines/<baselineId>/runs/<runId>/result.json
