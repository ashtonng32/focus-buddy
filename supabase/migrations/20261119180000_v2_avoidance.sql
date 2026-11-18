-- V2 step 6: avoidance help.
-- A "skip" is swapping a suggested task for another one before the timer starts. A "switch" is the
-- existing Different task for a bit (an events row on the block that was left). Tasks hit 3+ times
-- in 7 days show up as Avoided tasks in the Daily Log.

create table public.task_skips (
  id bigint generated always as identity primary key,
  notion_task_id text not null,
  task_title text not null,
  at timestamptz not null default now()
);
create index task_skips_task_at_idx on public.task_skips (notion_task_id, at);
alter table public.task_skips enable row level security;

create view public.task_avoidance with (security_invoker = true) as
with hits as (
  select s.notion_task_id, s.task_title, e.at, 'switch'::text as kind
  from public.events e
  join public.sessions s on s.id = e.session_id
  where e.action = 'switch' and s.notion_task_id is not null and e.at > now() - interval '7 days'
  union all
  select notion_task_id, task_title, at, 'skip'::text
  from public.task_skips
  where at > now() - interval '7 days'
)
select
  notion_task_id,
  max(task_title) as task_title,
  count(*) filter (where kind = 'skip') as skips,
  count(*) filter (where kind = 'switch') as switches,
  count(*) as total,
  max(at) as last_at
from hits
group by notion_task_id;

revoke all on public.task_avoidance from anon, authenticated;
