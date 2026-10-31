create table public.advisor_client_archive (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references auth.users(id) on delete cascade,
  client_email text not null,
  state text not null check (state in ('blocked','trashed')),
  created_at timestamptz not null default now(),
  unique (advisor_id, client_email)
);
alter table public.advisor_client_archive enable row level security;
create policy "advisor reads own archive" on public.advisor_client_archive
  for select using (auth.uid() = advisor_id and public.is_advisor());
create policy "advisor removes own archive" on public.advisor_client_archive
  for delete using (auth.uid() = advisor_id and public.is_advisor());

create or replace function public.archive_advisor_client(p_link uuid, p_state text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_row public.advisor_clients;
begin
  if auth.uid() is null or not public.is_advisor() then return 'not_advisor'; end if;
  if p_state not in ('blocked','trashed') then return 'invalid_state'; end if;
  select * into v_row from public.advisor_clients where id = p_link and advisor_id = auth.uid();
  if v_row.id is null then return 'not_found'; end if;
  insert into public.advisor_client_archive (advisor_id, client_id, client_email, state)
    values (auth.uid(), v_row.client_id, lower(coalesce(v_row.client_email, v_row.invited_email)), p_state)
    on conflict (advisor_id, client_email) do update set state = excluded.state, created_at = now();
  delete from public.advisor_clients where id = v_row.id;
  return 'ok';
end; $$;

create or replace function public.restore_advisor_client(p_archive uuid)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_row public.advisor_client_archive;
begin
  if auth.uid() is null or not public.is_advisor() then return 'not_advisor'; end if;
  select * into v_row from public.advisor_client_archive where id = p_archive and advisor_id = auth.uid();
  if v_row.id is null then return 'not_found'; end if;
  if v_row.state = 'trashed' then
    insert into public.advisor_clients (advisor_id, client_id, client_email, invited_email, status)
      values (auth.uid(), v_row.client_id, v_row.client_email, case when v_row.client_id is null then v_row.client_email else null end, 'pending');
  end if;
  delete from public.advisor_client_archive where id = v_row.id;
  return 'ok';
end; $$;

revoke all on function public.archive_advisor_client(uuid, text) from public, anon;
revoke all on function public.restore_advisor_client(uuid) from public, anon;
grant execute on function public.archive_advisor_client(uuid, text) to authenticated;
grant execute on function public.restore_advisor_client(uuid) to authenticated;
-- invite_client_by_email additionally returns 'blocked' for blocked addresses (applied via MCP as invite_client_blocked_check).
