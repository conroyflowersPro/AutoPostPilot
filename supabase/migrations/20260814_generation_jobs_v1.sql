-- Weekly generate jobs: one short Edge tick at a time. Not video.
create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  status text not null default 'running',
  step text not null default 'quota',
  saved_count integer not null default 0,
  required_slots integer not null default 0,
  label_ko text not null default '작업 대기',
  summary text not null default '',
  error text,
  state jsonb not null default '{}'::jsonb,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists generation_jobs_user_updated_idx
  on public.generation_jobs (user_id, updated_at desc);

alter table public.generation_jobs enable row level security;

drop policy if exists generation_jobs_own on public.generation_jobs;
create policy generation_jobs_own on public.generation_jobs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on table public.generation_jobs to authenticated;
grant all on table public.generation_jobs to service_role;
