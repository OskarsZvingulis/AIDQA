INSERT INTO storage.buckets (id, name, public)
VALUES ('aidqa', 'aidqa', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "user_storage_access" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'aidqa' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'aidqa' AND (storage.foldername(name))[1] = auth.uid()::text);
