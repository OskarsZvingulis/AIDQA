-- Add current_source_url column to visual_runs table
-- This stores the URL used to capture the current screenshot during run creation

ALTER TABLE public.visual_runs 
ADD COLUMN IF NOT EXISTS current_source_url text;

COMMENT ON COLUMN public.visual_runs.current_source_url IS 'URL used to capture the current screenshot (may differ from baseline URL for cross-site comparison)';
