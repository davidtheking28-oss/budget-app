create or replace function public.advisor_mfa_ok() returns boolean language sql stable security definer set search_path to 'public','auth' as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors where user_id = auth.uid() and status = 'verified')
$$;
revoke execute on function public.advisor_mfa_ok() from public, anon;
grant execute on function public.advisor_mfa_ok() to authenticated;

alter policy "user or household member or advisor can access budget data" on public.budget_data
using (
  (auth.uid() = user_id)
  or exists (select 1 from public.households h where h.owner_id = budget_data.user_id and h.member_id = auth.uid())
  or (public.is_advisor() and public.advisor_mfa_ok() and exists (select 1 from public.advisor_clients ac where ac.client_id = budget_data.user_id and ac.advisor_id = auth.uid() and ac.status = 'active'))
)
with check (
  (auth.uid() = user_id)
  or exists (select 1 from public.households h where h.owner_id = budget_data.user_id and h.member_id = auth.uid())
  or (public.is_advisor() and public.advisor_mfa_ok() and exists (select 1 from public.advisor_clients ac where ac.client_id = budget_data.user_id and ac.advisor_id = auth.uid() and ac.status = 'active'))
);
