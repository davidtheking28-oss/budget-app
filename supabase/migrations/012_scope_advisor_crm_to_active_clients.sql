-- applied to Supabase as migration 20260720160205 scope_advisor_crm_to_active_clients

drop policy if exists "advisor owns their notes" on public.advisor_notes;
create policy "advisor owns their notes" on public.advisor_notes
  for all
  using (auth.uid() = advisor_id and exists (
    select 1 from public.advisor_clients ac
    where ac.advisor_id = auth.uid() and ac.client_id = advisor_notes.client_id and ac.status = 'active'
  ))
  with check (auth.uid() = advisor_id and exists (
    select 1 from public.advisor_clients ac
    where ac.advisor_id = auth.uid() and ac.client_id = advisor_notes.client_id and ac.status = 'active'
  ));

drop policy if exists "advisor owns their tasks" on public.advisor_tasks;
create policy "advisor owns their tasks" on public.advisor_tasks
  for all
  using (auth.uid() = advisor_id and exists (
    select 1 from public.advisor_clients ac
    where ac.advisor_id = auth.uid() and ac.client_id = advisor_tasks.client_id and ac.status = 'active'
  ))
  with check (auth.uid() = advisor_id and exists (
    select 1 from public.advisor_clients ac
    where ac.advisor_id = auth.uid() and ac.client_id = advisor_tasks.client_id and ac.status = 'active'
  ));

drop policy if exists "advisor owns their meetings" on public.advisor_meetings;
create policy "advisor owns their meetings" on public.advisor_meetings
  for all
  using (auth.uid() = advisor_id and exists (
    select 1 from public.advisor_clients ac
    where ac.advisor_id = auth.uid() and ac.client_id = advisor_meetings.client_id and ac.status = 'active'
  ))
  with check (auth.uid() = advisor_id and exists (
    select 1 from public.advisor_clients ac
    where ac.advisor_id = auth.uid() and ac.client_id = advisor_meetings.client_id and ac.status = 'active'
  ));
