# Focus Buddy V2 — build plan

Source: [PRD-V2.md](PRD-V2.md). Same rules as the MVP: one slice at a time, test on the Pixel, anything new goes to LATER.md.

## Status

| Step | What | State |
| --- | --- | --- |
| 0. Duet setup | Daily Log database in Notion, Duet section on AI Instructions | **Done** (Nov 18). Still Ashton's: schedule the 8:30 pm Duet check-in (Sun–Fri) in the Duet research preview |
| 5. Daily Log | Migration, nightly job, Effort on sessions | **Code written**, not yet applied or deployed |
| 6. Avoidance help | Count switches and skips per task, write Avoided tasks | Not started |
| 7. Weekly page | Duet writes "Your week" each Sunday | No code; after 5 workdays of data |

## Notion IDs

| Item | ID |
| --- | --- |
| Daily Log (data source) | 41c973bc-129e-816f-8785-000b09e2efdf |
| Daily Log (database page) | 41c973bc-129e-819a-8a01-ef4192db7386 |

Daily Log fields: Date (title, e.g. "Nov 19"), Day (the real date, used for lookups), Day type, Mode, Focus minutes, Blocks, Tasks done, Keep goings, Stuck taps, Switches, Breaks, Avoided tasks, Day feel, Sleep, Journal.
Duet may create tomorrow's row the night before (Date, Day, Day type); the nightly job finds it by Day and fills in the numbers, or creates the row if none exists.

## Step 5 — Daily Log (code)

- Migration `20261119120000_v2_daily_log.sql`
  - `sessions.effort` (copied from Notion when a block starts).
  - `events.hour` and `events.weekday` (America/Denver; weekday 0 = Sunday), filled by a trigger and backfilled.
  - View `daily_summary`: one row per local day with first mode, blocks, tasks done, keep goings, stuck taps, switches, breaks, focus minutes.
  - Replaces the hourly Work Log job with an hourly `dailylog-hourly` job.
- `POST /api/cron/dailylog` (replaces `/api/cron/worklog`): from 8 pm Denver, reads `daily_summary`, then updates or creates that day's Daily Log row. Safe to run every hour; later runs refresh the numbers. `?dry=1` shows the row, `?force=1` skips the 8 pm check, `?date=YYYY-MM-DD` picks a day.
- Env: `NOTION_DAILYLOG_DS` (local `.env.local` and Vercel).
- Work Log goes back to project sessions only.
- Task pick already uses Effort (Low prefers Quick) from the MVP; nothing to change.

**Done when:** after a workday the Daily Log row is full and Duet's wrap quotes it.

**Test on the Pixel:** run two or three short blocks (one Done, one Stuck, one break), then call the dry run, then the real one, and look at the row in Notion.

## Step 6 — Avoidance help (code)

- Count per task, per 7 days: "switched away from" (Different task) and "skipped" (Different task suggestion swapped before starting). Needs a skip event; today a swap before the timer starts is not recorded, so add a `skip` event action and log it from the Focus screen.
- Nightly job writes tasks at 3+ into Daily Log → Avoided tasks.
- Duet offers the breakdown (already in its instructions).

**Done when:** a task skipped 3 times shows up in the check-in with an offer.

## Step 7 — Weekly page (no code)

Duet writes "Your week" each Sunday from the Daily Log: one win, one pattern, one thing to try. "Still learning your patterns" until 5 workdays are logged.

## Order of work

1. Step 5 code, apply migration, deploy, test one real day.
2. Step 6 once Step 5 has produced a few real rows.
3. Step 7 after 5 workdays.
