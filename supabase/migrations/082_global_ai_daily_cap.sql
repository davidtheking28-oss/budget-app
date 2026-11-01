create or replace function public.enforce_global_ai_cap() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if (select count(*) from public.ai_requests where created_at > now() - interval '24 hours') >= 6000 then
    raise exception 'daily AI capacity reached' using errcode = '53400';
  end if;
  return new;
end; $$;
revoke execute on function public.enforce_global_ai_cap() from public, anon, authenticated;
create trigger ai_requests_global_cap before insert on public.ai_requests for each row execute function public.enforce_global_ai_cap();
create index if not exists ai_requests_created_at_idx on public.ai_requests (created_at);
