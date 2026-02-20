-- Add tolerance and ignore regions to design_baselines
ALTER TABLE design_baselines
  ADD COLUMN diff_threshold_pct NUMERIC NOT NULL DEFAULT 0.2,
  ADD COLUMN ignore_regions JSONB NOT NULL DEFAULT '[]'::jsonb;
