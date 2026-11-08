do $$
declare f record; def text; fixed text;
begin
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('approve_advisor_client','archive_advisor_client','restore_advisor_client','add_manual_client','invite_client_by_email','create_report_share') loop
    def := pg_get_functiondef(f.oid);
    if def ~ 'advisor_mfa_ok' then continue; end if;
    fixed := regexp_replace(def, 'not public\.is_advisor\(\)', '(not public.is_advisor() or not public.advisor_mfa_ok())');
    if fixed = def then raise exception 'guard anchor missing in %', f.oid::regproc; end if;
    execute fixed;
  end loop;
end $$;
