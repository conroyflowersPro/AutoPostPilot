-- Phase 1A Evidence Persistence
-- Durable X API evidence store. Additive only. Does not reset data.

alter table public.account_activities
  add column if not exists x_author_id text,
  add column if not exists first_collected_at timestamptz,
  add column if not exists last_refreshed_at timestamptz,
  add column if not exists conversation_id text,
  add column if not exists in_reply_to_user_id text,
  add column if not exists post_type text,
  add column if not exists collection_source text,
  add column if not exists system_origin_class text;

create index if not exists account_activities_author_idx
  on public.account_activities(x_author_id);
create index if not exists account_activities_conversation_idx
  on public.account_activities(conversation_id)
  where conversation_id is not null;

create table if not exists public.x_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.account_connections(id) on delete cascade,
  x_post_id text not null,
  activity_id uuid references public.account_activities(id) on delete set null,
  snapshot_at timestamptz not null default now(),
  data_source text not null default 'x_api',
  collection_run_id uuid references public.x_sync_runs(id) on delete set null,
  public_metrics jsonb,
  non_public_metrics jsonb,
  organic_metrics jsonb,
  request_meta jsonb not null default '{}'::jsonb,
  metrics_fingerprint text,
  created_at timestamptz not null default now()
);

create index if not exists x_metric_snapshots_post_idx
  on public.x_metric_snapshots(account_id, x_post_id, snapshot_at desc);
create unique index if not exists x_metric_snapshots_dedup_idx
  on public.x_metric_snapshots(account_id, x_post_id, metrics_fingerprint)
  where metrics_fingerprint is not null;

alter table public.x_metric_snapshots enable row level security;
do $$ begin
  create policy x_metric_snapshots_auth on public.x_metric_snapshots
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

alter table public.x_sync_runs
  add column if not exists pages_fetched int,
  add column if not exists posts_discovered int,
  add column if not exists posts_new int,
  add column if not exists posts_updated int,
  add column if not exists mentions_discovered int,
  add column if not exists metric_snapshots_written int,
  add column if not exists earliest_post_at timestamptz,
  add column if not exists latest_post_at timestamptz,
  add column if not exists end_reason text,
  add column if not exists rate_limited boolean default false,
  add column if not exists limitation_notes jsonb default '[]'::jsonb,
  add column if not exists metric_field_evidence jsonb;

create table if not exists public.x_collection_evidence (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.account_connections(id) on delete cascade,
  collection_run_id uuid references public.x_sync_runs(id) on delete cascade,
  x_post_id text,
  evidence_type text not null default 'tweet_payload',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists x_collection_evidence_run_idx
  on public.x_collection_evidence(collection_run_id);

alter table public.x_collection_evidence enable row level security;
do $$ begin
  create policy x_collection_evidence_auth on public.x_collection_evidence
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
