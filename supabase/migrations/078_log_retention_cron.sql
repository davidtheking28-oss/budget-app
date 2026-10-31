select cron.schedule('client-errors-cleanup', '25 3 * * *', $$delete from public.client_errors where created_at < now() - interval '60 days'$$);
select cron.schedule('support-messages-cleanup', '35 3 * * *', $$delete from public.support_messages where handled is true and created_at < now() - interval '365 days'$$);
