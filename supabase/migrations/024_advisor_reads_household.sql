-- Lets an advisor see whether a client's budget is shared with a household partner
-- (owner or member), so advice/edits account for a second person touching the same
-- data. Read-only: advisors never create/join/leave households, only clients do that
-- via join_household() (011_secure_households_join.sql).

drop policy if exists "advisor reads their clients' households" on public.households;
create policy "advisor reads their clients' households" on public.households
  for select
  using (
    exists (
      select 1 from public.advisor_clients ac
      where ac.advisor_id = auth.uid()
        and ac.status = 'active'
        and ac.client_id in (households.owner_id, households.member_id)
    )
  );
