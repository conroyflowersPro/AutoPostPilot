-- X OAuth token fields on account_connections (server-side use only)
alter table public.account_connections
  add column if not exists access_token text,
  add column if not exists refresh_token text,
  add column if not exists token_expires_at timestamptz,
  add column if not exists scopes text,
  add column if not exists followers_count int,
  add column if not exists following_count int,
  add column if not exists profile_image_url text;

-- RLS: users manage only their own connection row
alter table public.account_connections enable row level security;

drop policy if exists "account_connections_select_own" on public.account_connections;
create policy "account_connections_select_own"
  on public.account_connections for select
  using (auth.uid() = user_id);

drop policy if exists "account_connections_insert_own" on public.account_connections;
create policy "account_connections_insert_own"
  on public.account_connections for insert
  with check (auth.uid() = user_id);

drop policy if exists "account_connections_update_own" on public.account_connections;
create policy "account_connections_update_own"
  on public.account_connections for update
  using (auth.uid() = user_id);

drop policy if exists "account_connections_delete_own" on public.account_connections;
create policy "account_connections_delete_own"
  on public.account_connections for delete
  using (auth.uid() = user_id);
