-- Track when each monitor was last executed so cron can enforce cadence
ALTER TABLE monitors
  ADD COLUMN last_run_at TIMESTAMPTZ NULL;
