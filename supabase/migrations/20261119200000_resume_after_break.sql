-- After a break (or Talk it through) that began from "I'm stuck", offer to go back to that task.
-- A break remembers the stuck block it came from; the stuck block is flagged while the
-- "Back to your task" screen is waiting.
alter table public.sessions
  add column from_session_id uuid references public.sessions (id) on delete set null,
  add column resume_pending boolean not null default false;
