-- Every-minute publishing trigger. Vercel Hobby crons run once a day, so Supabase
-- pg_cron + pg_net call the app's publish endpoint instead.
--
-- BEFORE running this, store two secrets in Supabase Vault (Dashboard > Project
-- Settings > Vault, or SQL below). Never commit the real values:
--   select vault.create_secret('https://<your-app-domain>', 'publish_url_base');
--   select vault.create_secret('<same value as the CRON_SECRET env var on Vercel>', 'cron_secret');

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- remove an older copy of the job if this file is re-run
select cron.unschedule(jobid) from cron.job where jobname = 'agencyflow-publish';

select cron.schedule(
  'agencyflow-publish',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'publish_url_base') || '/api/cron/publish',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);
