-- Makes client-visibility consistent across all three CRM types (advisor_tasks already
-- got for_client in 023_client_visible_advisor_tasks.sql). Defaults differ on purpose:
--  - meetings default TRUE: a meeting inherently involves the client, and every existing
--    meeting was already visible to the client before this migration (index.html had no
--    for_client filter on advisor_meetings) — defaulting true backfills that with no
--    behavior change for existing rows.
--  - notes default FALSE: advisor_notes doubles as the advisor's private scratchpad about
--    a client, so a note only reaches the client when explicitly marked shared.

alter table public.advisor_meetings
  add column if not exists for_client boolean not null default true;

alter table public.advisor_notes
  add column if not exists for_client boolean not null default false;

drop policy if exists "client reads their meetings" on public.advisor_meetings;
create policy "client reads their meetings" on public.advisor_meetings
  for select
  using (
    auth.uid() = client_id
    and for_client
    and exists (
      select 1 from public.advisor_clients ac
      where ac.client_id = auth.uid()
        and ac.advisor_id = advisor_meetings.advisor_id
        and ac.status = 'active'
    )
  );

drop policy if exists "client reads notes shared with them" on public.advisor_notes;
create policy "client reads notes shared with them" on public.advisor_notes
  for select
  using (
    auth.uid() = client_id
    and for_client
    and exists (
      select 1 from public.advisor_clients ac
      where ac.client_id = auth.uid()
        and ac.advisor_id = advisor_notes.advisor_id
        and ac.status = 'active'
    )
  );
