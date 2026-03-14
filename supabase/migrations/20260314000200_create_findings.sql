CREATE TABLE findings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id           UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  user_id           TEXT NOT NULL,
  category          TEXT NOT NULL
                    CHECK (category IN ('layout', 'hierarchy', 'consistency', 'accessibility', 'design_system', 'ux_readiness')),
  severity          TEXT NOT NULL
                    CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  title             TEXT NOT NULL,
  evidence_type     TEXT NOT NULL
                    CHECK (evidence_type IN ('bbox', 'multi_bbox', 'region', 'metric', 'explanation')),
  evidence          JSONB NOT NULL,
  why_it_matters    TEXT NOT NULL,
  repair_guidance   TEXT NOT NULL,
  ai_fix_instruction TEXT NOT NULL,
  metric_value      TEXT,
  score_impact      INTEGER,
  source            TEXT NOT NULL
                    CHECK (source IN ('deterministic', 'ai')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
