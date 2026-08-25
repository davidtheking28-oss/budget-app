alter table public.advisor_meetings
  add column if not exists status text not null default 'pending'
  check (status in ('pending','confirmed','declined'));

drop policy if exists "client confirms their meetings" on public.advisor_meetings;
create policy "client confirms their meetings" on public.advisor_meetings
  for update
  using (
    auth.uid() = client_id and for_client
    and exists (
      select 1 from advisor_clients ac
      where ac.client_id = auth.uid() and ac.advisor_id = advisor_meetings.advisor_id and ac.status = 'active'
    )
  )
  with check (
    auth.uid() = client_id and for_client
    and exists (
      select 1 from advisor_clients ac
      where ac.client_id = auth.uid() and ac.advisor_id = advisor_meetings.advisor_id and ac.status = 'active'
    )
  );
