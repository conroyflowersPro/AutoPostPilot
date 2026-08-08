-- Strategy features for Performance DNA learning (v5.4)
alter table public.post_metrics
  add column if not exists action_type text,
  add column if not exists strategy_json jsonb;

comment on column public.post_metrics.action_type is
  'ORIGINAL | QUOTE | REPOST | REPLY — observed or planned action type';
comment on column public.post_metrics.strategy_json is
  'Post Strategy hypothesis or observed strategy features (never AI-only success memory)';

do $$ begin
  alter table public."SeungContent" add column if not exists strategy_json jsonb;
exception when undefined_table then null;
when others then null;
end $$;
