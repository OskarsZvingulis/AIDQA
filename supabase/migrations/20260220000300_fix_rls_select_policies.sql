-- ============================================================
-- Fix: ensure SELECT policies exist on all three tables.
-- The initial migration enabled RLS on visual_runs but created
-- no SELECT policy, causing all direct frontend queries to
-- return [] even for authenticated users.
--
-- Safe to re-run: DROP IF EXISTS before every CREATE.
-- Service role key (used by Edge Function) bypasses RLS entirely.
-- ============================================================

-- -------------------------------------------------------
-- visual_runs
-- -------------------------------------------------------
ALTER TABLE public.visual_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_runs"           ON public.visual_runs;
DROP POLICY IF EXISTS "own_runs_select"    ON public.visual_runs;
DROP POLICY IF EXISTS "own_runs_insert"    ON public.visual_runs;
DROP POLICY IF EXISTS "own_runs_update"    ON public.visual_runs;

CREATE POLICY "own_runs_select"
  ON public.visual_runs
  FOR SELECT
  TO authenticated
  USING (project_id = auth.uid()::text);

CREATE POLICY "own_runs_insert"
  ON public.visual_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (project_id = auth.uid()::text);

CREATE POLICY "own_runs_update"
  ON public.visual_runs
  FOR UPDATE
  TO authenticated
  USING     (project_id = auth.uid()::text)
  WITH CHECK (project_id = auth.uid()::text);

-- -------------------------------------------------------
-- design_baselines
-- -------------------------------------------------------
ALTER TABLE public.design_baselines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_baselines"          ON public.design_baselines;
DROP POLICY IF EXISTS "own_baselines_select"   ON public.design_baselines;
DROP POLICY IF EXISTS "own_baselines_insert"   ON public.design_baselines;
DROP POLICY IF EXISTS "own_baselines_update"   ON public.design_baselines;

CREATE POLICY "own_baselines_select"
  ON public.design_baselines
  FOR SELECT
  TO authenticated
  USING (project_id = auth.uid()::text);

CREATE POLICY "own_baselines_insert"
  ON public.design_baselines
  FOR INSERT
  TO authenticated
  WITH CHECK (project_id = auth.uid()::text);

CREATE POLICY "own_baselines_update"
  ON public.design_baselines
  FOR UPDATE
  TO authenticated
  USING     (project_id = auth.uid()::text)
  WITH CHECK (project_id = auth.uid()::text);

-- -------------------------------------------------------
-- monitors
-- -------------------------------------------------------
ALTER TABLE public.monitors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_monitors"          ON public.monitors;
DROP POLICY IF EXISTS "own_monitors_select"   ON public.monitors;
DROP POLICY IF EXISTS "own_monitors_insert"   ON public.monitors;
DROP POLICY IF EXISTS "own_monitors_update"   ON public.monitors;

CREATE POLICY "own_monitors_select"
  ON public.monitors
  FOR SELECT
  TO authenticated
  USING (project_id = auth.uid()::text);

CREATE POLICY "own_monitors_insert"
  ON public.monitors
  FOR INSERT
  TO authenticated
  WITH CHECK (project_id = auth.uid()::text);

CREATE POLICY "own_monitors_update"
  ON public.monitors
  FOR UPDATE
  TO authenticated
  USING     (project_id = auth.uid()::text)
  WITH CHECK (project_id = auth.uid()::text);

-- -------------------------------------------------------
-- Storage: authenticated users can sign/read objects in
-- their own folder  ({userId}/baselines/... etc.)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "own_storage_objects" ON storage.objects;

CREATE POLICY "own_storage_objects"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING     (bucket_id = 'visual' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'visual' AND (storage.foldername(name))[1] = auth.uid()::text);
