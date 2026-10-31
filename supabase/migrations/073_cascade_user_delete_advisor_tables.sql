do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass as tbl, c.conname, pg_get_constraintdef(c.oid) as def
    from pg_constraint c
    where c.contype = 'f' and c.confrelid = 'auth.users'::regclass and c.confdeltype = 'a'
      and c.conrelid::regclass::text in ('report_shares','advisor_leads','advisor_prospects')
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format('alter table %s add constraint %I %s', r.tbl, r.conname, replace(r.def, 'REFERENCES auth.users(id)', 'REFERENCES auth.users(id) ON DELETE CASCADE'));
  end loop;
end $$;
