drop policy "user or household member can access budget data" on public.budget_data;

create policy "user or household member or advisor can access budget data"
  on public.budget_data for all
  using (
    (auth.uid() = user_id)
    or exists (
      select 1 from public.households h
      where h.owner_id = budget_data.user_id and h.member_id = auth.uid()
    )
    or exists (
      select 1 from public.advisor_clients ac
      where ac.client_id = budget_data.user_id and ac.advisor_id = auth.uid() and ac.status = 'active'
    )
  )
  with check (
    (auth.uid() = user_id)
    or exists (
      select 1 from public.households h
      where h.owner_id = budget_data.user_id and h.member_id = auth.uid()
    )
    or exists (
      select 1 from public.advisor_clients ac
      where ac.client_id = budget_data.user_id and ac.advisor_id = auth.uid() and ac.status = 'active'
    )
  );
