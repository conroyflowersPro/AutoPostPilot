-- Weekly Learning Engine v3
-- Additive only. Does not modify SeungContent.

create table if not exists public.learning_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null default 'csv',
  status text not null default 'imported',
  notes text,
  raw_meta jsonb
);

create table if not exists public.post_metrics (
  id uuid primary key default gen_random_uuid(),
  learning_run_id uuid references public.learning_runs(id) on delete cascade,
  content_snippet text,
  published_at timestamptz,
  followers_gained numeric not null default 0,
  profile_visits numeric not null default 0,
  bookmarks numeric not null default 0,
  replies numeric not null default 0,
  reposts numeric not null default 0,
  likes numeric not null default 0,
  impressions numeric not null default 0,
  quotes numeric not null default 0,
  engagement_rate numeric,
  weighted_score numeric,
  is_success boolean not null default false,
  origin text not null default 'unknown',
  raw jsonb,
  created_at timestamptz not null default now()
);

create index if not exists post_metrics_run_idx on public.post_metrics(learning_run_id);
create index if not exists post_metrics_success_idx on public.post_metrics(is_success);

create table if not exists public.planner_memory (
  id uuid primary key default gen_random_uuid(),
  version int not null default 1,
  patterns jsonb not null default '[]'::jsonb,
  summary_ko text,
  learning_run_id uuid references public.learning_runs(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.creator_dna (
  id uuid primary key default gen_random_uuid(),
  version int not null default 1,
  data jsonb not null default '{}'::jsonb,
  summary_ko text,
  learning_run_id uuid references public.learning_runs(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.audience_dna (
  id uuid primary key default gen_random_uuid(),
  version int not null default 1,
  data jsonb not null default '{}'::jsonb,
  summary_ko text,
  learning_run_id uuid references public.learning_runs(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.learning_runs enable row level security;
alter table public.post_metrics enable row level security;
alter table public.planner_memory enable row level security;
alter table public.creator_dna enable row level security;
alter table public.audience_dna enable row level security;

do $$ begin
  create policy learning_runs_auth on public.learning_runs for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy post_metrics_auth on public.post_metrics for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy planner_memory_auth on public.planner_memory for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy creator_dna_auth on public.creator_dna for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy audience_dna_auth on public.audience_dna for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
