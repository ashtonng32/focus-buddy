-- Slice 3: remember when a finished block's follow-up (Next task / Stuck options) has been handled,
-- and whether writing "Done" back to Notion failed.
alter table public.sessions
  add column handled_at timestamptz,
  add column notion_failed boolean not null default false;
