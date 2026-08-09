-- Additive 14-day continuous learning tables (do not drop existing evidence)
CREATE TABLE IF NOT EXISTS public.learning_batches (
  id bigserial PRIMARY KEY,
  batch_id text UNIQUE NOT NULL,
  period_start date,
  period_end date,
  imported_at timestamptz DEFAULT now(),
  source text,
  file_hashes jsonb DEFAULT '[]'::jsonb,
  report jsonb,
  status text DEFAULT 'processed'
);

CREATE TABLE IF NOT EXISTS public.audience_snapshots (
  id bigserial PRIMARY KEY,
  snapshot_id text UNIQUE NOT NULL,
  batch_id text,
  imported_at timestamptz DEFAULT now(),
  period_start date,
  period_end date,
  data jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS audience_snapshots_imported_at_idx
  ON public.audience_snapshots (imported_at);

CREATE TABLE IF NOT EXISTS public.performance_patterns (
  id bigserial PRIMARY KEY,
  batch_id text,
  updated_at timestamptz DEFAULT now(),
  data jsonb NOT NULL,
  summary_ko text
);

CREATE INDEX IF NOT EXISTS performance_patterns_updated_at_idx
  ON public.performance_patterns (updated_at);
