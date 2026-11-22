alter table public.agreement_versions add column issuer_user_id uuid;

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
    or new.clauses is distinct from old.clauses
    or new.is_draft is distinct from old.is_draft then
    raise exception 'agreement version text is immutable' using errcode = '42501';
  end if;
  return new;
end; $$;

create or replace function public.is_valid_israeli_id(p text) returns boolean
language plpgsql immutable set search_path to '' as $$
declare
  d text;
  total int := 0;
  v int;
  i int;
begin
  if p is null then return false; end if;
  d := regexp_replace(p, '[\s-]', '', 'g');
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

create or replace function public.agreement_request_meta() returns jsonb
language sql stable set search_path to '' as $$
  with h as (select coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb) as headers)
  select jsonb_build_object(
    'ip', coalesce(nullif(btrim(headers->>'cf-connecting-ip'), ''), nullif(btrim(split_part(coalesce(headers->>'x-forwarded-for', ''), ',', -1)), '')),
    'ua', nullif(left(coalesce(headers->>'user-agent', ''), 500), '')
  ) from h;
$$;

create or replace function public.client_agreement_record_hash(a public.client_agreements) returns text
language sql immutable set search_path to '' as $$
  select encode(extensions.digest(convert_to(concat_ws('|',
    'v1',
    a.id::text,
    a.user_id::text,
    coalesce(a.email, ''),
    coalesce(a.full_name, ''),
    coalesce(a.national_id, ''),
    to_char(a.birth_date, 'YYYY-MM-DD'),
    coalesce(a.address, ''),
    coalesce(a.phone, ''),
    coalesce(a.version, ''),
    coalesce(a.body_sha256, ''),
    encode(extensions.digest(convert_to(coalesce(a.body, ''), 'utf8'), 'sha256'), 'hex'),
    coalesce((select string_agg(x, ',' order by x) from jsonb_array_elements_text(a.confirmed_clauses) x), ''),
    encode(extensions.digest(convert_to(coalesce(a.signature_png, ''), 'utf8'), 'sha256'), 'hex'),
    to_char(a.presented_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    coalesce(a.presented_ip, ''),
    coalesce(a.presented_user_agent, ''),
    to_char(a.signed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    coalesce(a.signed_ip, ''),
    coalesce(a.signed_user_agent, '')
  ), 'utf8'), 'sha256'), 'hex');
$$;

create or replace function public.client_agreement_status() returns jsonb
language plpgsql security definer set search_path to '' as $$
declare
  uid uuid := auth.uid();
  v text;
  rf timestamptz;
  created timestamptz;
  signed boolean;
begin
  if uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select version, required_from into v, rf from public.agreement_versions
    where required_from <= now() and not is_draft order by required_from desc limit 1;
  if v is null then
    return jsonb_build_object('required', false, 'signed', false, 'version', null);
  end if;
  select created_at into created from auth.users where id = uid;
  signed := exists (select 1 from public.client_agreements where user_id = uid and version = v);
  return jsonb_build_object('required', (created >= rf and not signed), 'signed', signed, 'version', v);
end; $$;

create or replace function public.sign_client_agreement(
  p_version text, p_full_name text, p_national_id text, p_birth_date date,
  p_address text, p_phone text, p_signature_png text, p_confirmed_clauses jsonb
) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare
  uid uuid := auth.uid();
  st jsonb;
  ver public.agreement_versions;
  offer public.client_agreement_offers;
  meta jsonb := public.agreement_request_meta();
  rec public.client_agreements;
  name_clean text;
  required_ids text[];
  confirmed_ids text[];
  existing public.client_agreements;
begin
  if uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  select * into existing from public.client_agreements where user_id = uid and version = p_version;
  if found then
    return jsonb_build_object('id', existing.id, 'signed_at', existing.signed_at);
  end if;

  st := public.client_agreement_status();
  if not (st->>'required')::boolean or st->>'version' is distinct from p_version then
    raise exception 'Agreement not required' using errcode = '22023';
  end if;

  select * into ver from public.agreement_versions where version = p_version;
  select * into offer from public.client_agreement_offers where user_id = uid and version = p_version;
  if not found then raise exception 'Agreement must be presented first' using errcode = '22023'; end if;

  name_clean := regexp_replace(btrim(coalesce(p_full_name, '')), '[\s ]+', ' ', 'g');
  if length(name_clean) > 200 or array_length(regexp_split_to_array(name_clean, ' '), 1) < 2 then
    raise exception 'Full name required' using errcode = '22023';
  end if;
  if not public.is_valid_israeli_id(p_national_id) then
    raise exception 'Invalid national id' using errcode = '22023';
  end if;
  if p_birth_date is null or p_birth_date < date '1900-01-01'
    or p_birth_date > (((now() at time zone 'Asia/Jerusalem')::date) - interval '18 years')::date then
    raise exception 'Must be 18 or older' using errcode = '22023';
  end if;
  if btrim(coalesce(p_address, '')) = '' or length(p_address) > 300 then
    raise exception 'Address required' using errcode = '22023';
  end if;
  if btrim(coalesce(p_phone, '')) = '' or length(p_phone) > 30 then
    raise exception 'Phone required' using errcode = '22023';
  end if;
  if p_signature_png is null or p_signature_png not like 'data:image/png;base64,%' or length(p_signature_png) > 200000 then
    raise exception 'Valid signature required' using errcode = '22023';
  end if;
  if jsonb_typeof(p_confirmed_clauses) is distinct from 'array' then
    raise exception 'Clause confirmations required' using errcode = '22023';
  end if;

  select coalesce(array_agg(c->>'id' order by c->>'id'), '{}') into required_ids from jsonb_array_elements(ver.clauses) c;
  select coalesce(array_agg(x order by x), '{}') into confirmed_ids from jsonb_array_elements_text(p_confirmed_clauses) x;
  if required_ids is distinct from confirmed_ids then
    raise exception 'Every clause must be confirmed' using errcode = '22023';
  end if;

  rec.id := gen_random_uuid();
  rec.user_id := uid;
  select email into rec.email from auth.users where id = uid;
  rec.full_name := name_clean;
  rec.national_id := lpad(regexp_replace(p_national_id, '[\s-]', '', 'g'), 9, '0');
  rec.birth_date := p_birth_date;
  rec.address := btrim(p_address);
  rec.phone := btrim(p_phone);
  rec.version := ver.version;
  rec.body := ver.body;
  rec.body_sha256 := ver.body_sha256;
  rec.confirmed_clauses := to_jsonb(confirmed_ids);
  rec.signature_png := p_signature_png;
  rec.presented_at := offer.presented_at;
  rec.presented_ip := offer.ip;
  rec.presented_user_agent := offer.user_agent;
  rec.signed_at := now();
  rec.signed_ip := meta->>'ip';
  rec.signed_user_agent := meta->>'ua';
  rec.record_sha256 := public.client_agreement_record_hash(rec);

  insert into public.client_agreements select (rec).* on conflict (user_id, version) do nothing;

  select * into existing from public.client_agreements where user_id = uid and version = p_version;
  return jsonb_build_object('id', existing.id, 'signed_at', existing.signed_at);
end; $$;

revoke all on function public.agreement_request_meta() from public, anon, authenticated;
revoke all on function public.client_agreement_status() from public, anon, authenticated;
revoke all on function public.sign_client_agreement(text, text, text, date, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.client_agreement_record_hash(public.client_agreements) from public, anon;
grant execute on function public.client_agreement_status() to authenticated;
grant execute on function public.sign_client_agreement(text, text, text, date, text, text, text, jsonb) to authenticated;
grant execute on function public.client_agreement_record_hash(public.client_agreements) to authenticated;

drop policy "advisor reads client agreements" on public.client_agreements;
create policy "issuer advisor reads client agreements" on public.client_agreements
  for select to authenticated
  using (
    public.is_advisor() and public.advisor_mfa_ok()
    and exists (
      select 1 from public.agreement_versions v
      where v.version = client_agreements.version and v.issuer_user_id = (select auth.uid())
    )
  );
