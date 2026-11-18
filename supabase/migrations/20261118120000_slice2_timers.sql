-- Slice 2: server-owned timers. All access goes through the Next.js API (secret key) and the
-- notify-due Edge Function, so RLS is on with no policies (anon/authenticated get nothing).

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table public.settings (
  id int primary key default 1 check (id = 1),
  low_min numeric not null default 10,
  steady_min numeric not null default 50,
  flow_min numeric not null default 90,
  keepgoing_min numeric not null default 30,
  break_min numeric not null default 15,
  switch_min numeric not null default 20
);
insert into public.settings (id) values (1);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'focus' check (kind in ('focus', 'break', 'switch')),
  mode text check (mode in ('low', 'steady', 'flow')),
  notion_task_id text,
  task_title text not null default 'Your next thing',
  first_step text not null default 'Just open it.',
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  notified_at timestamptz,
  status text not null default 'running' check (status in ('running', 'done', 'stuck', 'stopped'))
);
create index sessions_due_idx on public.sessions (ends_at) where status = 'running' and notified_at is null;
create unique index one_running_session on public.sessions ((true)) where status = 'running';

create table public.events (
  id bigint generated always as identity primary key,
  session_id uuid references public.sessions (id) on delete cascade,
  action text not null check (action in ('keep_going', 'done', 'stuck', 'break', 'switch', 'talk', 'stop')),
  at timestamptz not null default now()
);

create table public.push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.settings enable row level security;
alter table public.sessions enable row level security;
alter table public.events enable row level security;
alter table public.push_subscriptions enable row level security;

-- Every minute, ask the notify-due Edge Function to push for sessions whose ends_at has passed.
-- The shared secret is read from Vault (created separately, never committed).
select cron.schedule(
  'notify-due',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://cvjqsyilfdrbrhylahgp.supabase.co/functions/v1/notify-due',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);
