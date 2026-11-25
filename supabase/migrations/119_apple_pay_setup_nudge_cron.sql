select cron.schedule('apple-pay-setup-nudge', '0 16 * * *', $cmd$
  select net.http_post(
    url := 'https://fnklrqxwyeibfptaxewf.supabase.co/functions/v1/apple-pay-ingest?action=nudge',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select value from public.app_secrets where key = 'push_cron_secret')),
    body := '{}'::jsonb
  );
$cmd$);
