do $$
declare
  r record;
  pat constant text := '(?<!SELECT )auth\.(uid|jwt|role)\(\)';
begin
  for r in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'advisor_access_requests','advisor_biz_records','advisor_client_archive',
        'advisor_client_deals','advisor_clients','advisor_families','advisor_leads',
        'advisor_meetings','advisor_merchant_rules','advisor_notes','advisor_prospects',
        'advisor_tasks','advisors','budget_data','economic_mappings','households',
        'incoming_expenses','report_shares'
      )
      and (qual ~ pat or with_check ~ pat)
  loop
    execute format(
      'alter policy %I on public.%I%s%s',
      r.policyname,
      r.tablename,
      case when r.qual is not null
        then ' using (' || regexp_replace(r.qual, pat, '(select auth.\1())', 'g') || ')'
        else '' end,
      case when r.with_check is not null
        then ' with check (' || regexp_replace(r.with_check, pat, '(select auth.\1())', 'g') || ')'
        else '' end
    );
  end loop;
end $$;

create index if not exists households_member_id_idx on public.households (member_id);
create index if not exists economic_mappings_client_id_idx on public.economic_mappings (client_id);
create index if not exists advisor_notes_client_id_idx on public.advisor_notes (client_id);
create index if not exists advisor_tasks_client_id_idx on public.advisor_tasks (client_id);
create index if not exists advisor_tasks_meeting_scope_idx on public.advisor_tasks (meeting_id, advisor_id, client_id);
create index if not exists advisor_meetings_client_id_idx on public.advisor_meetings (client_id);
create index if not exists report_shares_advisor_id_idx on public.report_shares (advisor_id);
create index if not exists report_shares_client_id_idx on public.report_shares (client_id);
create index if not exists advisor_client_archive_client_id_idx on public.advisor_client_archive (client_id);
create index if not exists advisor_families_advisor_id_idx on public.advisor_families (advisor_id);
