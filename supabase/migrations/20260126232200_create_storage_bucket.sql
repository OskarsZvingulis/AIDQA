-- Create storage bucket for visual regression artifacts
INSERT INTO storage.buckets (id, name, public)
VALUES ('visual', 'visual', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload/read from visual bucket
CREATE POLICY "Allow authenticated uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'visual');

CREATE POLICY "Allow authenticated reads"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'visual');

CREATE POLICY "Allow authenticated deletes"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'visual');
