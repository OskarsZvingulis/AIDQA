ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_scans" ON scans
  USING (user_id = auth.uid()::text);

ALTER TABLE findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_findings" ON findings
  USING (user_id = auth.uid()::text);
