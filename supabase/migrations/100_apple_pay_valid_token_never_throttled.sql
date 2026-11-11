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
  if p_token is not null and p_token ~ '^ab1_[0-9a-f]{64}$' then
    select user_id into uid from public.expense_hooks where token_hash = encode(sha256(convert_to(p_token, 'utf8')), 'hex');
  end if;
  if uid is null then
    if (select count(*) from public.expense_hook_failures where at > now() - interval '1 minute') < 600
       and (select count(*) from public.expense_hook_failures where ip_hash = ip_key and at > now() - interval '1 hour') < 20 then
      insert into public.expense_hook_failures(ip_hash) values (ip_key);
      delete from public.expense_hook_failures where at < now() - interval '1 day';
    end if;
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
