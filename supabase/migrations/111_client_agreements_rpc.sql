create extension if not exists pgcrypto with schema extensions;

create or replace function public.agreement_request_meta() returns jsonb
language sql stable set search_path to '' as $$
  select jsonb_build_object(
    'ip', nullif(btrim(split_part(coalesce(nullif(current_setting('request.headers', true), '')::jsonb->>'x-forwarded-for', ''), ',', 1)), ''),
    'ua', nullif(left(coalesce(nullif(current_setting('request.headers', true), '')::jsonb->>'user-agent', ''), 500), '')
  );
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
    where required_from <= now() order by required_from desc limit 1;
  if v is null then
    return jsonb_build_object('required', false, 'signed', false, 'version', null);
  end if;
  select created_at into created from auth.users where id = uid;
  signed := exists (select 1 from public.client_agreements where user_id = uid and version = v);
  return jsonb_build_object('required', (created >= rf and not signed), 'signed', signed, 'version', v);
end; $$;

create or replace function public.present_client_agreement() returns jsonb
language plpgsql security definer set search_path to '' as $$
declare
  uid uuid := auth.uid();
  st jsonb;
  ver public.agreement_versions;
  meta jsonb := public.agreement_request_meta();
  pres timestamptz;
begin
  if uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  st := public.client_agreement_status();
  if not (st->>'required')::boolean then
    raise exception 'Agreement not required' using errcode = '22023';
  end if;
  select * into ver from public.agreement_versions where version = st->>'version';
  insert into public.client_agreement_offers(user_id, version, ip, user_agent)
    values (uid, ver.version, meta->>'ip', meta->>'ua')
    on conflict (user_id, version) do nothing;
  select presented_at into pres from public.client_agreement_offers where user_id = uid and version = ver.version;
  return jsonb_build_object('version', ver.version, 'title', ver.title, 'body', ver.body,
    'body_sha256', ver.body_sha256, 'clauses', ver.clauses, 'presented_at', pres);
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
  mail text;
  nid text;
  name_clean text;
  required_ids text[];
  confirmed_ids text[];
  new_id uuid := gen_random_uuid();
  existing public.client_agreements;
  canonical text;
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

  name_clean := btrim(coalesce(p_full_name, ''));
  if length(name_clean) > 200 or array_length(regexp_split_to_array(name_clean, '\s+'), 1) < 2 then
    raise exception 'Full name required' using errcode = '22023';
  end if;
  if not public.is_valid_israeli_id(p_national_id) then
    raise exception 'Invalid national id' using errcode = '22023';
  end if;
  nid := lpad(regexp_replace(p_national_id, '\s', '', 'g'), 9, '0');
  if p_birth_date is null or p_birth_date < date '1900-01-01' or p_birth_date > (current_date - interval '18 years')::date then
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

  select email into mail from auth.users where id = uid;

  canonical := concat_ws('|', new_id::text, uid::text, mail, name_clean, nid, p_birth_date::text,
    btrim(p_address), btrim(p_phone), ver.version, ver.body_sha256, array_to_string(confirmed_ids, ','),
    encode(extensions.digest(convert_to(p_signature_png, 'utf8'), 'sha256'), 'hex'),
    offer.presented_at::text);

  insert into public.client_agreements(
    id, user_id, email, full_name, national_id, birth_date, address, phone, version, body, body_sha256,
    confirmed_clauses, signature_png, presented_at, presented_ip, presented_user_agent,
    signed_ip, signed_user_agent, record_sha256)
  values (
    new_id, uid, mail, name_clean, nid, p_birth_date, btrim(p_address), btrim(p_phone), ver.version, ver.body, ver.body_sha256,
    to_jsonb(confirmed_ids), p_signature_png, offer.presented_at, offer.ip, offer.user_agent,
    meta->>'ip', meta->>'ua',
    encode(extensions.digest(convert_to(canonical, 'utf8'), 'sha256'), 'hex'))
  on conflict (user_id, version) do nothing;

  select * into existing from public.client_agreements where user_id = uid and version = p_version;
  return jsonb_build_object('id', existing.id, 'signed_at', existing.signed_at);
end; $$;

revoke all on function public.agreement_request_meta() from public, anon, authenticated;
revoke all on function public.client_agreement_status() from public, anon, authenticated;
revoke all on function public.present_client_agreement() from public, anon, authenticated;
revoke all on function public.sign_client_agreement(text, text, text, date, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.client_agreement_status() to authenticated;
grant execute on function public.present_client_agreement() to authenticated;
grant execute on function public.sign_client_agreement(text, text, text, date, text, text, text, jsonb) to authenticated;
