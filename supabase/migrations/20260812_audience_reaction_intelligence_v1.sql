-- ORDER 4 — Audience Reaction Intelligence (additive)
-- Structured post-level evidence + aggregate memory. No raw comment storage required.

CREATE TABLE IF NOT EXISTS public.audience_reaction_records (
  id bigserial PRIMARY KEY,
  published_post_id text NOT NULL,
  source_role text,
  published_origin text NOT NULL,
  audience_evidence_status text NOT NULL,
  reply_count_analyzed int NOT NULL DEFAULT 0,
  meaningful_reply_count int NOT NULL DEFAULT 0,
  reader_behavior_distribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  dominant_reader_behaviors jsonb NOT NULL DEFAULT '[]'::jsonb,
  self_projection_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  story_invitation_evidence text,
  participation_barrier_evidence text,
  comprehension_barrier_evidence text,
  predicted_reaction_mechanism text,
  mechanism_validation text,
  evidence_confidence numeric,
  creator_origin_weight numeric,
  performance_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  analyzed_at timestamptz NOT NULL DEFAULT now(),
  order4_version text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audience_reaction_records_post_id_idx
  ON public.audience_reaction_records (published_post_id);
CREATE INDEX IF NOT EXISTS audience_reaction_records_analyzed_at_idx
  ON public.audience_reaction_records (analyzed_at);
CREATE INDEX IF NOT EXISTS audience_reaction_records_origin_idx
  ON public.audience_reaction_records (published_origin);

CREATE TABLE IF NOT EXISTS public.audience_reaction_aggregates (
  id bigserial PRIMARY KEY,
  aggregate_id text UNIQUE NOT NULL,
  period_start date,
  period_end date,
  posts_analyzed int NOT NULL DEFAULT 0,
  manual_posts_analyzed int NOT NULL DEFAULT 0,
  ai_assisted_posts_analyzed int NOT NULL DEFAULT 0,
  reader_behavior_totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  strong_self_projection_rate numeric,
  story_invitation_distribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  mechanism_validation_rates jsonb NOT NULL DEFAULT '{}'::jsonb,
  participation_barrier_tendencies jsonb NOT NULL DEFAULT '{}'::jsonb,
  contextual_patterns jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence numeric,
  order4_version text,
  contains_raw_comment_examples boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audience_reaction_aggregates_updated_at_idx
  ON public.audience_reaction_aggregates (updated_at);

COMMENT ON TABLE public.audience_reaction_records IS
  'ORDER4 post-level audience reaction evidence — structured only; not generation few-shot';
COMMENT ON TABLE public.audience_reaction_aggregates IS
  'ORDER4 aggregate audience behavior patterns — no raw comment examples; not topic→mechanism maps';
