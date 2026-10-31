alter table public.budget_data drop constraint budget_data_updated_by_fkey;
alter table public.budget_data add constraint budget_data_updated_by_fkey foreign key (updated_by) references auth.users(id) on delete set null;

create or replace function public.leave_household() returns boolean language plpgsql security definer set search_path to 'public' as $$
declare n int;
begin
  if auth.uid() is null then return false; end if;
  update public.households set member_id = null, member_email = null where member_id = auth.uid();
  get diagnostics n = row_count;
  return n > 0;
end; $$;
revoke execute on function public.leave_household() from public, anon;
grant execute on function public.leave_household() to authenticated;

revoke insert, update, delete on public.report_shares from authenticated;
