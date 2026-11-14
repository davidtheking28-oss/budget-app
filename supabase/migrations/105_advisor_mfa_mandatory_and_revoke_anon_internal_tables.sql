create or replace function public.advisor_mfa_ok() returns boolean language sql stable security definer set search_path to 'public','auth' as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
$$;

revoke all on public.ai_requests, public.push_log from anon;
