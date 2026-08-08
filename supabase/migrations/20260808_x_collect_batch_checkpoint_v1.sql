-- Phase 1A resumable batch collection checkpoints
alter table public.x_sync_runs
  add column if not exists phase text default 'POSTS',
  add column if not exists next_token text,
  add column if not exists run_status text default 'RUNNING',
  add column if not exists checkpoint_meta jsonb default '{}'::jsonb;

comment on column public.x_sync_runs.phase is 'POSTS | MENTIONS | COMPLETE';
comment on column public.x_sync_runs.run_status is
  'READY | RUNNING | RATE_LIMITED | PAUSED | FAILED_RETRYABLE | FAILED_FATAL | COMPLETE | CANCELLED | MAX_PAGES_SAFETY';
comment on column public.x_sync_runs.next_token is 'X API pagination_token checkpoint for resume';
