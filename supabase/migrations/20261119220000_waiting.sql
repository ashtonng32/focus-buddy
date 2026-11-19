-- "Moved it forward" (waiting): a new event action, counted as the end of a block.
alter table public.events drop constraint events_action_check;
alter table public.events add constraint events_action_check
  check (action in ('keep_going', 'done', 'stuck', 'break', 'switch', 'talk', 'stop', 'waiting'));

-- One row per local day, from finished blocks only.
create or replace view public.daily_summary with (security_invoker = true) as
with s as (
  select
    s.*,
    (s.started_at at time zone 'America/Denver')::date as day,
    (select max(e.at) from public.events e
      where e.session_id = s.id and e.action in ('done', 'stuck', 'stop', 'waiting')) as ended_at,
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

