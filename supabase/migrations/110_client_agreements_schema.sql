create table public.agreement_versions (
  version text primary key,
  title text not null,
  body text not null,
  body_sha256 text not null,
  clauses jsonb not null,
  required_from timestamptz not null default 'infinity',
  is_draft boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.client_agreement_offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  version text not null references public.agreement_versions(version),
  presented_at timestamptz not null default now(),
  ip text,
  user_agent text,
  unique (user_id, version)
);

create table public.client_agreements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text not null,
  full_name text not null,
  national_id text not null,
  birth_date date not null,
  address text not null,
  phone text not null,
  version text not null references public.agreement_versions(version),
  body text not null,
  body_sha256 text not null,
  confirmed_clauses jsonb not null,
  signature_png text not null,
  presented_at timestamptz not null,
  presented_ip text,
  presented_user_agent text,
  signed_at timestamptz not null default now(),
  signed_ip text,
  signed_user_agent text,
  record_sha256 text not null,
  unique (user_id, version)
);

create index client_agreement_offers_version_idx on public.client_agreement_offers (version);
create index client_agreements_version_idx on public.client_agreements (version);

create or replace function public.is_valid_israeli_id(p text) returns boolean
language plpgsql immutable set search_path to '' as $$
declare
  d text;
  total int := 0;
  v int;
  i int;
begin
  if p is null then return false; end if;
  d := regexp_replace(p, '\s', '', 'g');
  if d !~ '^[0-9]{1,9}$' then return false; end if;
  d := lpad(d, 9, '0');
  if d = '000000000' then return false; end if;
  for i in 1..9 loop
    v := substr(d, i, 1)::int * case when i % 2 = 0 then 2 else 1 end;
    if v > 9 then v := v - 9; end if;
    total := total + v;
  end loop;
  return total % 10 = 0;
end; $$;

create or replace function public.client_agreements_block_change() returns trigger
language plpgsql set search_path to '' as $$
begin
  raise exception 'client agreements are immutable' using errcode = '42501';
end; $$;

create trigger client_agreements_immutable before update or delete on public.client_agreements
  for each row execute function public.client_agreements_block_change();
create trigger client_agreements_no_truncate before truncate on public.client_agreements
  for each statement execute function public.client_agreements_block_change();
create trigger client_agreement_offers_immutable before update or delete on public.client_agreement_offers
  for each row execute function public.client_agreements_block_change();
create trigger client_agreement_offers_no_truncate before truncate on public.client_agreement_offers
  for each statement execute function public.client_agreements_block_change();

create or replace function public.agreement_versions_guard() returns trigger
language plpgsql set search_path to '' as $$
begin
  if tg_op = 'DELETE' or tg_op = 'TRUNCATE' then
    raise exception 'agreement versions cannot be deleted' using errcode = '42501';
  end if;
  if new.version is distinct from old.version
    or new.title is distinct from old.title
    or new.body is distinct from old.body
    or new.body_sha256 is distinct from old.body_sha256
    or new.clauses is distinct from old.clauses then
    raise exception 'agreement version text is immutable' using errcode = '42501';
  end if;
  return new;
end; $$;

create trigger agreement_versions_no_change before update or delete on public.agreement_versions
  for each row execute function public.agreement_versions_guard();
create trigger agreement_versions_no_truncate before truncate on public.agreement_versions
  for each statement execute function public.agreement_versions_guard();

alter table public.agreement_versions enable row level security;
alter table public.client_agreement_offers enable row level security;
alter table public.client_agreements enable row level security;

create policy "authenticated read agreement versions" on public.agreement_versions
  for select to authenticated using (true);
create policy "user reads own agreement offers" on public.client_agreement_offers
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "user reads own agreements" on public.client_agreements
  for select to authenticated using ((select auth.uid()) = user_id);

revoke insert, update, delete, truncate on public.agreement_versions from anon, authenticated;
revoke insert, update, delete, truncate on public.client_agreement_offers from anon, authenticated;
revoke insert, update, delete, truncate on public.client_agreements from anon, authenticated;
