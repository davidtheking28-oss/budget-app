create or replace function public.fill_client_profile_trg()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  m jsonb;
  ph text;
begin
  if new.client_id is not null and (coalesce(new.name, '') = '' or coalesce(new.phone, '') = '') then
    select raw_user_meta_data, phone into m, ph from auth.users where id = new.client_id;
    if coalesce(new.name, '') = '' then
      new.name := nullif(trim(coalesce(m->>'full_name', m->>'name', '')), '');
    end if;
    if coalesce(new.phone, '') = '' then
      new.phone := nullif(trim(coalesce(ph, m->>'phone', '')), '');
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists fill_client_profile on public.advisor_clients;
create trigger fill_client_profile
  before insert or update on public.advisor_clients
  for each row execute function public.fill_client_profile_trg();

update public.advisor_clients set status = status
  where client_id is not null and (coalesce(name, '') = '' or coalesce(phone, '') = '');
