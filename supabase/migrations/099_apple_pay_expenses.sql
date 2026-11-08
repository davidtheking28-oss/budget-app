create table if not exists public.expense_hooks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create table if not exists public.incoming_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant text not null check (char_length(merchant) between 1 and 80),
  amount numeric(12,2) not null check (amount > 0 and amount <= 100000),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists incoming_expenses_user_created_idx on public.incoming_expenses (user_id, created_at desc);
create table if not exists public.expense_hook_failures (
  id bigserial primary key,
  ip_hash text not null,
  at timestamptz not null default now()
);
create index if not exists expense_hook_failures_ip_at_idx on public.expense_hook_failures (ip_hash, at desc);
create index if not exists expense_hook_failures_at_idx on public.expense_hook_failures (at desc);

alter table public.expense_hooks enable row level security;
alter table public.incoming_expenses enable row level security;
alter table public.expense_hook_failures enable row level security;
revoke all on public.expense_hooks, public.incoming_expenses, public.expense_hook_failures from public, anon, authenticated;
grant select, delete on public.incoming_expenses to authenticated;
create policy "own incoming expenses read" on public.incoming_expenses for select to authenticated using (auth.uid() = user_id);
create policy "own incoming expenses delete" on public.incoming_expenses for delete to authenticated using (auth.uid() = user_id);

create or replace function public.create_expense_hook()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  token text;
begin
  if uid is null then raise exception 'sign in required' using errcode = '42501'; end if;
  token := 'ab1_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.expense_hooks(user_id, token_hash) values (uid, encode(sha256(convert_to(token, 'utf8')), 'hex'))
  on conflict (user_id) do update set token_hash = excluded.token_hash, created_at = now(), last_used_at = null;
  return token;
end;
$$;

create or replace function public.revoke_expense_hook()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  delete from public.expense_hooks where user_id = auth.uid();
end;
$$;

create or replace function public.expense_hook_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare hook public.expense_hooks;
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  select * into hook from public.expense_hooks where user_id = auth.uid();
  if not found then return jsonb_build_object('active', false); end if;
  return jsonb_build_object('active', true, 'created_at', hook.created_at, 'last_used_at', hook.last_used_at);
end;
$$;

create or replace function public.ingest_expense(p_token text, p_merchant text, p_amount text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  headers jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  ip text := coalesce(nullif(btrim(headers->>'cf-connecting-ip'), ''), nullif(btrim(split_part(coalesce(headers->>'x-forwarded-for', ''), ',', -1)), ''), 'unknown');
  ip_key text := encode(sha256(convert_to(ip, 'utf8')), 'hex');
  uid uuid;
  cleaned text;
  amount_value numeric;
  merchant_value text;
begin
  if (select count(*) from public.expense_hook_failures where at > now() - interval '1 minute') >= 600
     or (select count(*) from public.expense_hook_failures where ip_hash = ip_key and at > now() - interval '1 hour') >= 20 then
    return jsonb_build_object('ok', false);
  end if;
  if p_token is null or p_token !~ '^ab1_[0-9a-f]{64}$' then
    insert into public.expense_hook_failures(ip_hash) values (ip_key);
    return jsonb_build_object('ok', false);
  end if;
  select user_id into uid from public.expense_hooks where token_hash = encode(sha256(convert_to(p_token, 'utf8')), 'hex');
  if uid is null then
    insert into public.expense_hook_failures(ip_hash) values (ip_key);
    delete from public.expense_hook_failures where at < now() - interval '1 day';
    return jsonb_build_object('ok', false);
  end if;
  if (select count(*) from public.incoming_expenses where user_id = uid and created_at > now() - interval '1 hour') >= 60
     or (select count(*) from public.incoming_expenses where user_id = uid) >= 200 then
    return jsonb_build_object('ok', false);
  end if;
  if coalesce(p_amount, '') ~ '[-−–(]' then return jsonb_build_object('ok', false); end if;
  cleaned := regexp_replace(left(coalesce(p_amount, ''), 40), '[^0-9.,]', '', 'g');
  if cleaned ~ '\.' then cleaned := replace(cleaned, ',', '');
  elsif cleaned ~ ',[0-9]{1,2}$' then cleaned := replace(cleaned, ',', '.');
  else cleaned := replace(cleaned, ',', '');
  end if;
  if cleaned !~ '^[0-9]{1,6}(\.[0-9]{1,4})?$' then return jsonb_build_object('ok', false); end if;
  amount_value := round(cleaned::numeric, 2);
  if amount_value <= 0 or amount_value > 100000 then return jsonb_build_object('ok', false); end if;
  merchant_value := left(btrim(regexp_replace(left(coalesce(p_merchant, ''), 200), '[[:cntrl:]]', ' ', 'g')), 80);
  if merchant_value = '' then merchant_value := 'Apple Pay'; end if;
  if exists (select 1 from public.incoming_expenses where user_id = uid and merchant = merchant_value and amount = amount_value and created_at > now() - interval '60 seconds') then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;
  insert into public.incoming_expenses(user_id, merchant, amount) values (uid, merchant_value, amount_value);
  update public.expense_hooks set last_used_at = now() where user_id = uid;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.create_expense_hook() from public, anon, authenticated;
revoke all on function public.revoke_expense_hook() from public, anon, authenticated;
revoke all on function public.expense_hook_status() from public, anon, authenticated;
revoke all on function public.ingest_expense(text, text, text) from public, anon, authenticated;
grant execute on function public.create_expense_hook() to authenticated;
grant execute on function public.revoke_expense_hook() to authenticated;
grant execute on function public.expense_hook_status() to authenticated;
grant execute on function public.ingest_expense(text, text, text) to anon, authenticated;
