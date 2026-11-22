create or replace function public.client_agreements_check_signature() returns trigger
language plpgsql set search_path to '' as $$
begin
  if new.signature_png !~ '^data:image/png;base64,[A-Za-z0-9+/]+={0,2}$' then
    raise exception 'Valid signature required' using errcode = '22023';
  end if;
  return new;
end; $$;

create trigger client_agreements_signature_format before insert on public.client_agreements
  for each row execute function public.client_agreements_check_signature();
