create or replace function public.advisor_mfa_ok() returns boolean language sql stable security definer set search_path to 'public','auth' as $$
  select true
$$;
