-- Slice 4: flow pit stop (total focused time across Keep going restarts) and the nightly Work Log.
alter table public.sessions add column focus_total_ms bigint not null default 0;

-- One row per local day that already has a Work Log entry, so the nightly job never double-writes.
create table public.worklog_days (
  day date primary key,
  notion_page_id text,
  created_at timestamptz not null default now()
);
alter table public.worklog_days enable row level security;

-- Hourly; the route itself only writes from 9 pm America/Denver onward (and retries until it succeeds).
select cron.schedule(
  'worklog-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://focus-buddy-lime.vercel.app/api/cron/worklog',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
