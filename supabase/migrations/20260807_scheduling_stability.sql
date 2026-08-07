-- Scheduling stability: status values scheduling / schedule_failed + error tracking
-- Additive columns only. Existing draft|reviewed|scheduled continue to work.

alter table public."SeungContent"
  add column if not exists attempt_count int not null default 0;

alter table public."SeungContent"
  add column if not exists last_attempt_at timestamptz;

alter table public."SeungContent"
  add column if not exists last_error text;

alter table public."SeungContent"
  add column if not exists error_stage text;

alter table public."SeungContent"
  add column if not exists schedule_provider text;

comment on column public."SeungContent".attempt_count is 'Schedule attempts';
comment on column public."SeungContent".error_stage is 'validate_post|validate_media|upload_media|publish_post|update_database|claim';
comment on column public."SeungContent".schedule_provider is 'fedica|...';
