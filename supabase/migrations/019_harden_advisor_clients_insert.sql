-- applied to Supabase as migration 20260726135110 harden_advisor_clients_insert

-- The legitimate client flow inserts an unclaimed invite (advisor_id null,
-- status 'pending') and the advisor redeems it through claim_advisor_invite,
-- which is SECURITY DEFINER and therefore unaffected by this policy.
-- Without the extra conditions a client could insert a row that is already
-- active and attached to an advisor, attaching itself without an invite code.
drop policy if exists "client can create advisor invite" on public.advisor_clients;
create policy "client can create advisor invite" on public.advisor_clients
  for insert
  with check (
    auth.uid() = client_id
    and advisor_id is null
    and status = 'pending'
  );
