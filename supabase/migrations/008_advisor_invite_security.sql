drop policy "auth users can read advisor_clients" on public.advisor_clients;

create policy "user can read own advisor_clients rows"
  on public.advisor_clients for select
  using (auth.uid() = client_id or auth.uid() = advisor_id);

drop policy "advisor can claim pending invite, client can update own" on public.advisor_clients;

create policy "client can update own advisor_clients row"
  on public.advisor_clients for update
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

create or replace function public.claim_advisor_invite(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  update public.advisor_clients
  set advisor_id = auth.uid(), status = 'active'
  where invite_code = p_code
    and status = 'pending'
    and advisor_id is null
    and client_id <> auth.uid();
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

grant execute on function public.claim_advisor_invite(text) to authenticated;
