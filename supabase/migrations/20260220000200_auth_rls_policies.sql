-- ============================================================
-- Stage 3: Auth — RLS policies
-- project_id stores the authenticated user's UUID (auth.uid()::text).
-- Service role key bypasses RLS for all Edge Function writes.
-- Direct REST calls from the frontend (with user JWT) are filtered by these policies.
-- ============================================================

-- Enable RLS on tables that were created without it
ALTER TABLE design_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitors        ENABLE ROW LEVEL SECURITY;
-- visual_runs already has RLS enabled from the initial migration

-- -------------------------------------------------------
-- design_baselines: users can only see and manage their own baselines
-- -------------------------------------------------------
CREATE POLICY "own_baselines"
  ON design_baselines
  FOR ALL
  USING     (project_id = auth.uid()::text)
  WITH CHECK (project_id = auth.uid()::text);

-- -------------------------------------------------------
-- monitors: users can only see and manage their own monitors
-- -------------------------------------------------------
CREATE POLICY "own_monitors"
  ON monitors
  FOR ALL
  USING     (project_id = auth.uid()::text)
  WITH CHECK (project_id = auth.uid()::text);

-- -------------------------------------------------------
-- visual_runs: users can only see and manage their own runs
-- -------------------------------------------------------
CREATE POLICY "own_runs"
  ON visual_runs
  FOR ALL
  USING     (project_id = auth.uid()::text)
  WITH CHECK (project_id = auth.uid()::text);

-- -------------------------------------------------------
-- Storage: users can sign/read objects inside their own folder.
-- Paths follow the pattern: {userId}/baselines/... and {userId}/monitors/...
-- (storage.foldername returns the path segments as an array)
-- -------------------------------------------------------
CREATE POLICY "own_storage_objects"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING     (bucket_id = 'visual' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'visual' AND (storage.foldername(name))[1] = auth.uid()::text);
