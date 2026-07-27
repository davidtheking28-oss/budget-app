-- applied to Supabase as migration 20260720160146 secure_households_join

create or replace function public.join_household(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  update public.households
  set member_id = auth.uid(),
      member_email = (select email from auth.users where id = auth.uid())
  where invite_code = p_code
    and member_id is null
    and owner_id <> auth.uid();
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

grant execute on function public.join_household(text) to authenticated;

drop policy if exists "auth users can read households" on public.households;
create policy "owner or member can read household" on public.households
  for select using (auth.uid() = owner_id or auth.uid() = member_id);

drop policy if exists "household can be updated" on public.households;
create policy "owner or member can update household" on public.households
  for update
  using (auth.uid() = owner_id or auth.uid() = member_id)
  with check (auth.uid() = owner_id or member_id is null or auth.uid() = member_id);
