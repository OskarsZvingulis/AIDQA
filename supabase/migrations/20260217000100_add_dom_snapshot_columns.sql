-- Add DOM snapshot paths to visual_runs for CSS-level diff
ALTER TABLE visual_runs
  ADD COLUMN baseline_dom_path TEXT NULL,
  ADD COLUMN current_dom_path TEXT NULL,
  ADD COLUMN css_diff_json JSONB NULL;
