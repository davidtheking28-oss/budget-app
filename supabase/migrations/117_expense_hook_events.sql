create table if not exists public.expense_hook_events (
  id bigserial primary key,
  at timestamptz not null default now(),
  stage text not null,
  detail jsonb not null default '{}'::jsonb
);
alter table public.expense_hook_events enable row level security;
revoke all on public.expense_hook_events from anon, authenticated;

create or replace function public.log_expense_hook_event(p_stage text, p_detail jsonb)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if (select count(*) from public.expense_hook_events where at > now() - interval '1 hour') >= 500 then return; end if;
  insert into public.expense_hook_events(stage, detail)
    values (left(coalesce(p_stage, ''), 40), case when length(coalesce(p_detail, '{}'::jsonb)::text) > 1000 then '{}'::jsonb else coalesce(p_detail, '{}'::jsonb) end);
  delete from public.expense_hook_events where at < now() - interval '7 days';
end;
$$;
revoke all on function public.log_expense_hook_event(text, jsonb) from public, anon, authenticated;
grant execute on function public.log_expense_hook_event(text, jsonb) to service_role;
