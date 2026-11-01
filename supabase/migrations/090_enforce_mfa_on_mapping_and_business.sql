alter policy "advisor owns their mappings" on public.economic_mappings
using (
  public.is_advisor() and public.advisor_mfa_ok() and auth.uid() = advisor_id
  and exists (select 1 from public.advisor_clients ac where ac.advisor_id = auth.uid() and ac.client_id = economic_mappings.client_id and ac.status = 'active')
)
with check (
  public.is_advisor() and public.advisor_mfa_ok() and auth.uid() = advisor_id
  and exists (select 1 from public.advisor_clients ac where ac.advisor_id = auth.uid() and ac.client_id = economic_mappings.client_id and ac.status = 'active')
);

alter policy "advisor manages own biz records" on public.advisor_biz_records
using (auth.uid() = advisor_id and public.advisor_mfa_ok())
with check (auth.uid() = advisor_id and public.advisor_mfa_ok());
