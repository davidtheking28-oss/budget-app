create table public.advisor_access_log (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  at timestamptz not null default now()
);
create index advisor_access_log_client_idx on public.advisor_access_log (client_id, at desc);
create index advisor_access_log_actor_idx on public.advisor_access_log (actor_id, at desc);
alter table public.advisor_access_log enable row level security;
create policy "read own access log" on public.advisor_access_log for select to authenticated using (client_id = (select auth.uid()) or actor_id = (select auth.uid()));
revoke all on public.advisor_access_log from anon, authenticated;
grant select on public.advisor_access_log to authenticated;

create or replace function public.log_budget_access() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is not null and auth.uid() is distinct from new.user_id then
    insert into public.advisor_access_log(actor_id, client_id, action) values (auth.uid(), new.user_id, lower(tg_op));
  end if;
  return new;
end; $$;
revoke execute on function public.log_budget_access() from public, anon, authenticated;
create trigger budget_data_access_log after insert or update on public.budget_data for each row execute function public.log_budget_access();

select cron.schedule('advisor-access-log-cleanup', '45 3 * * *', $$delete from public.advisor_access_log where at < now() - interval '12 months'$$);
