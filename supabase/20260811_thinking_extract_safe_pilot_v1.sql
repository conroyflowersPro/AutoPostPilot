-- Creator Thinking Feature Extract — SAFE PILOT (additive only)
-- Does NOT mutate Creator DNA / Audience / Performance / Revenue / Success Memory
-- Features + rail CANDIDATES only. Promote to DNA requires separate human approval.

create table if not exists public.thinking_extract_jobs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid,
  mode text not null default 'PILOT'
    check (mode in ('PILOT', 'FULL')),
  status text not null default 'READY'
    check (status in (
      'READY', 'RUNNING', 'PAUSED', 'COMPLETE',
      'FAILED_RETRYABLE', 'FAILED_FATAL', 'CANCELLED'
    )),
  pilot_max_posts int not null default 40,
  batch_size int not null default 8,
  budget_ms int not null default 14000,
  cursor_published_at timestamptz,
  cursor_x_post_id text,
  processed_count int not null default 0,
  skipped_count int not null default 0,
  failed_batches int not null default 0,
  xai_calls int not null default 0,
  include_original boolean not null default true,
  include_quote boolean not null default true,
  include_reply boolean not null default false,
  include_repost boolean not null default false,
  recent_14d_weight numeric not null default 2.0,
  last_error text,
  checkpoint_meta jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists thinking_extract_jobs_status_idx
  on public.thinking_extract_jobs (status, updated_at desc);

create table if not exists public.thinking_post_features (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.thinking_extract_jobs(id) on delete cascade,
  account_id uuid,
  x_post_id text not null,
  activity_id uuid,
  post_type text not null,
  published_at timestamptz,
  is_recent_14d boolean not null default false,
  topic text,
  editorial_mode_guess text,
  trigger text,
  first_interpretation text,
  reasoning_steps jsonb not null default '[]'::jsonb,
  scale_shift text,
  time_horizon text,
  judgment_habit text,
  ending_pattern text,
  source_pointer text,
  extractor_version text not null default 'thinking_feature_v1_pilot',
  xai_used boolean not null default false,
  confidence numeric,
  raw_model_notes text,
  created_at timestamptz not null default now(),
  unique (job_id, x_post_id)
);

create index if not exists thinking_post_features_job_idx
  on public.thinking_post_features (job_id, published_at desc);
create index if not exists thinking_post_features_topic_idx
  on public.thinking_post_features (topic, editorial_mode_guess);

create table if not exists public.thinking_rail_candidates (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.thinking_extract_jobs(id) on delete set null,
  rail_key text not null,
  topic text,
  editorial_modes text[] not null default '{}',
  trigger_summary text,
  expansion_steps jsonb not null default '[]'::jsonb,
  support_count int not null default 0,
  recent_14d_support int not null default 0,
  recent_usage text,
  historical_strength text,
  confidence numeric,
  status text not null default 'CANDIDATE'
    check (status in ('CANDIDATE', 'REJECTED', 'APPROVED_PENDING_DNA', 'PROMOTED')),
  evidence_post_ids text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists thinking_rail_candidates_status_idx
  on public.thinking_rail_candidates (status, confidence desc);

comment on table public.thinking_extract_jobs is
  'SAFE PILOT: resumable thinking feature extract. Does not write Creator DNA.';
comment on table public.thinking_post_features is
  'Per-post thinking structure. Full post text is NOT stored as learning pattern.';
comment on table public.thinking_rail_candidates is
  'Rail candidates only. PROMOTED requires separate Master Creator approval into Creator Thinking DNA.';
