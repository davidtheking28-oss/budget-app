do $$
declare t text;
begin
  foreach t in array array['advisor_client_archive','advisor_client_deals','advisor_clients','advisor_families','advisor_leads','advisor_meetings','advisor_merchant_rules','advisor_notes','advisor_prospects','advisor_tasks','advisor_biz_records'] loop
    execute format('drop policy if exists "advisor mfa required" on public.%I', t);
    execute format('create policy "advisor mfa required" on public.%I as restrictive for all to authenticated using (advisor_id is distinct from auth.uid() or public.advisor_mfa_ok()) with check (advisor_id is distinct from auth.uid() or public.advisor_mfa_ok())', t);
  end loop;
end $$;
