-- Kindle (e-ink) companion: PIN sign-in state. A single row.
-- Sign the Kindle out: update public.kindle_auth set token_version = token_version + 1;
create table public.kindle_auth (
  id int primary key default 1 check (id = 1),
  token_version int not null default 1,
  failed_attempts int not null default 0,
  locked_until timestamptz
);
insert into public.kindle_auth (id) values (1);
alter table public.kindle_auth enable row level security;
