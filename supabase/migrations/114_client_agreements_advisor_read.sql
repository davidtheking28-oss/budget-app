create policy "advisor reads client agreements" on public.client_agreements
  for select to authenticated
  using (
    public.is_advisor() and public.advisor_mfa_ok()
    and exists (
      select 1 from public.advisor_clients ac
      where ac.advisor_id = (select auth.uid()) and ac.client_id = client_agreements.user_id and ac.status = 'active'
    )
  );
