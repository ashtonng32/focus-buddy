# Focus Buddy V2 — build plan

Source: [PRD-V2.md](PRD-V2.md). Same rules as the MVP: one slice at a time, test on the Pixel, anything new goes to LATER.md.

## Status

| Step | What | State |
| --- | --- | --- |
| 0. Duet setup | Daily Log database in Notion, Duet section on AI Instructions | **Done** (Nov 18). Still Ashton's: schedule the 8:30 pm Duet check-in (Sun–Fri) in the Duet research preview |
| 5. Daily Log | Migration, nightly job, Effort on sessions | **Live** (Nov 18) |
| 6. Avoidance help | Count switches and skips per task, write Avoided tasks | **Live** (Nov 18), skip recording confirmed in production |
| + Moved it forward | Waiting button on check-in and Stuck, Notion Waiting On, Duet Mon/Thu cleanup | Built (Nov 18), awaiting ship |
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

- A **skip** is swapping a suggested task for another before its timer starts (new `task_skips` table, `POST /api/skip`; browsing past the same task again within 10 minutes counts once). A **switch** is the existing "Different task for a bit".
- View `task_avoidance`: per task, skips + switches over the last 7 days.
- The nightly job writes tasks with 3+ hits that are still open on Today into the Daily Log's **Avoided tasks** (it replaces the list each run, so a task drops off once it is done or the week rolls over). A day with no blocks still gets a row if something is being avoided.
- Duet reads Avoided tasks and offers the breakdown (already in its instructions). No count is ever shown to Ashton.

**Done when:** a task skipped 3 times shows up in the check-in with an offer.

**Test on the Pixel:** swap the same task away on three separate occasions (10+ minutes apart, or use Different task for a bit), then run `/api/cron/dailylog?force=1` and look at Avoided tasks in Notion.

## Step 7 — Weekly page (no code)

Duet writes "Your week" each Sunday from the Daily Log: one win, one pattern, one thing to try. "Still learning your patterns" until 5 workdays are logged.

## Order of work

1. ~~Step 5~~ done.
2. ~~Step 6~~ done. Remaining: real use, then Step 7 (no code).
3. Step 7 after 5 workdays.
