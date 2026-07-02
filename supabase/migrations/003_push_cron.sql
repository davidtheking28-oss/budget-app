-- Schedule the daily push-notification run (17:00 UTC = 19:00/20:00 Israel).
-- Replace __SUPABASE_ANON__ with the anon key before running (kept out of the repo).
select cron.schedule('push-daily', '0 17 * * *', $$
  select net.http_post(
    url:='https://fnklrqxwyeibfptaxewf.supabase.co/functions/v1/push-daily',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer __SUPABASE_ANON__',
      'x-cron-secret',(select value from public.app_secrets where key='push_cron_secret')
    ),
    body:='{}'::jsonb
  );
$$);
