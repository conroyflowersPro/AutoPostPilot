-- Universal evidence jobs / frozen datasets (v1)
-- Additive only. No mutation of account_activities / snapshots.

create table if not exists public.evidence_datasets (
  id uuid primary key default gen_random_uuid(),
  dataset_id text not null unique,
  export_version text not null,
  schema_version text not null,
  status text not null default 'BUILDING',
  source_mode text not null,
  created_at timestamptz not null default now(),
  frozen_at timestamptz,
  api_cutoff timestamptz,
  archive_generation_date text,
  manifest jsonb,
  package_meta jsonb,
  account_id uuid
);

create table if not exists public.evidence_export_jobs (
  id uuid primary key default gen_random_uuid(),
  job_id text not null unique,
  dataset_id text,
  account_id uuid,
  phase text not null default 'QUEUED',
  status text not null default 'running',
  source_mode text not null default 'API_ONLY',
  checkpoint jsonb not null default '{}'::jsonb,
  progress jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists evidence_export_jobs_job_id_idx on public.evidence_export_jobs (job_id);
create index if not exists evidence_datasets_dataset_id_idx on public.evidence_datasets (dataset_id);
