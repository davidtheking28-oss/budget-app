-- Fix: advisor_access_requests insert allowed forging another user's user_id
drop policy if exists "record own access request" on public.advisor_access_requests;
create policy "record own access request" on public.advisor_access_requests
  for insert
  with check (user_id = auth.uid());

-- Fix: household member could update any column on the owner's row (invite_code,
-- owner_email, etc.), not just leave the household. Restrict a member's update
-- to setting member_id to null.
create or replace function public.households_restrict_member_update()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() = old.member_id and auth.uid() <> old.owner_id then
    if new.owner_id is distinct from old.owner_id
       or new.invite_code is distinct from old.invite_code
       or new.owner_email is distinct from old.owner_email
       or new.created_at is distinct from old.created_at
       or new.member_id is not null then
      raise exception 'member can only leave the household (set member_id to null)';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists households_restrict_member_update_trg on public.households;
create trigger households_restrict_member_update_trg
  before update on public.households
  for each row
  execute function public.households_restrict_member_update();
