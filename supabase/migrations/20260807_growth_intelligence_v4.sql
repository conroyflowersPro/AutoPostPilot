-- Growth Intelligence Engine v4
-- Additive only

alter table public.post_metrics add column if not exists post_id text;
alter table public.post_metrics add column if not exists shares numeric not null default 0;
alter table public.post_metrics add column if not exists detail_expands numeric not null default 0;
alter table public.post_metrics add column if not exists url_clicks numeric not null default 0;
alter table public.post_metrics add column if not exists hashtag_clicks numeric not null default 0;
alter table public.post_metrics add column if not exists permalink_clicks numeric not null default 0;
alter table public.post_metrics add column if not exists engagements numeric not null default 0;
alter table public.post_metrics add column if not exists revenue numeric not null default 0;
alter table public.post_metrics add column if not exists features jsonb;

create table if not exists public.performance_dna (
  id uuid primary key default gen_random_uuid(),
  version int not null default 1,
  data jsonb not null default '{}'::jsonb,
  summary_ko text,
  learning_run_id uuid references public.learning_runs(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.revenue_dna (
  id uuid primary key default gen_random_uuid(),
  version int not null default 1,
  data jsonb not null default '{}'::jsonb,
  summary_ko text,
  learning_run_id uuid references public.learning_runs(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.performance_dna enable row level security;
alter table public.revenue_dna enable row level security;

do $$ begin
  create policy performance_dna_auth on public.performance_dna for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy revenue_dna_auth on public.revenue_dna for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
