CREATE TABLE scans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT NOT NULL,
  input_type        TEXT NOT NULL CHECK (input_type IN ('url', 'screenshot')),
  input_url         TEXT,
  input_filename    TEXT,
  original_path     TEXT,
  normalized_path   TEXT,
  overlay_path      TEXT,
  dom_path          TEXT,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  score             INTEGER,
  category_scores   JSONB,
  finding_count     INTEGER,
  error_message     TEXT,
  det_status        TEXT NOT NULL DEFAULT 'pending'
                    CHECK (det_status IN ('pending', 'completed', 'failed', 'skipped')),
  ai_status         TEXT NOT NULL DEFAULT 'pending'
                    CHECK (ai_status IN ('pending', 'completed', 'failed', 'skipped')),
  ai_error          TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);
