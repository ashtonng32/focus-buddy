-- V2 step 5: Daily Log.
-- Effort on sessions, local hour/weekday on events, a daily_summary view, and the nightly
-- Daily Log job (8 pm America/Denver) replacing the hourly Work Log job.

alter table public.sessions add column effort text;

alter table public.events
  add column hour int,
  add column weekday int; -- 0 = Sunday, America/Denver

create or replace function public.events_local_time() returns trigger
language plpgsql as $$
begin
  new.hour := extract(hour from new.at at time zone 'America/Denver');
  new.weekday := extract(dow from new.at at time zone 'America/Denver');
  return new;
end;
$$;

create trigger events_local_time
  before insert on public.events
  for each row execute function public.events_local_time();

update public.events
set hour = extract(hour from at at time zone 'America/Denver'),
    weekday = extract(dow from at at time zone 'America/Denver');

-- One row per local day, from finished blocks only.
create view public.daily_summary with (security_invoker = true) as
with s as (
  select
    s.*,
    (s.started_at at time zone 'America/Denver')::date as day,
    (select max(e.at) from public.events e
      where e.session_id = s.id and e.action in ('done', 'stuck', 'stop')) as ended_at,
    (select count(*) from public.events e where e.session_id = s.id and e.action = 'keep_going') as keep_goings,
    (select count(*) from public.events e where e.session_id = s.id and e.action = 'stuck') as stuck_taps
  from public.sessions s
  where s.status <> 'running'
)
select
  day,
  (array_agg(mode order by started_at) filter (where mode is not null))[1] as first_mode,
  count(*) filter (where kind <> 'break') as blocks,
  count(distinct notion_task_id) filter (where kind <> 'break' and status = 'done') as tasks_done,
  sum(keep_goings) as keep_goings,
  sum(stuck_taps) as stuck_taps,
  count(*) filter (where kind = 'switch') as switches,
  count(*) filter (where kind = 'break') as breaks,
  round((coalesce(sum(
    case when kind <> 'break' then
      focus_total_ms + greatest(0, extract(epoch from (least(coalesce(ended_at, ends_at), ends_at) - started_at)) * 1000)
    end
  ), 0) / 60000)::numeric) as focus_minutes
from s
group by day;

revoke all on public.daily_summary from anon, authenticated;

-- Swap the hourly Work Log job for the hourly Daily Log job (the route only writes from 8 pm Denver).
select cron.unschedule('worklog-hourly');
select cron.schedule(
  'dailylog-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://focus-buddy-lime.vercel.app/api/cron/dailylog',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
