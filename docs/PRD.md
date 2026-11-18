# Focus Buddy — MVP PRD

Nov 18, 2026 · Ashton

## Overview

Focus Buddy is a phone timer that works like an accountability buddy for an ADHD brain. It sets each work block by how you feel, checks in when time is up, and helps you get unstuck without guilt.

**Problem.** Starting is the hardest part. Some days are 3 hours of flow with no breaks, some days nothing starts, and dreaded tasks turn into hours of avoidance and guilt. Fixed timers like Pomodoro assume every day is the same.

**MVP goal.** A working app on Ashton's Pixel within about 4 build sessions, used on real workdays for 2 weeks.

**Success after 2 weeks**

- Used on at least 4 workdays a week
- Most check-ins answered from the notification, without opening the app
- Ashton reports fewer "lost afternoons" and less guilt (a yes/no gut check, not a metric)
- A short list of what to build next, based on real use

## Scope

The MVP is one user (Ashton), one device (Android Pixel, Chrome), and the core loop only. Anything that does not make the loop work waits.

| Area | In the MVP | Later |
| --- | --- | --- |
| Mode check-in | Low / Steady / Flow, one tap | Mood history and trends |
| Task | Suggests one task from Notion Today, swap with one tap | AI-written "tiny first step" |
| Timer | Per-mode length, runs with phone locked | Ambient sound, focus mode toggle |
| Check-in | Notification buttons: Keep going / Done / I'm stuck | Wear OS / watch buttons |
| Stuck | Break / Different task / Talk it through | Built-in AI chat |
| Talk it through | Opens the Claude app | In-app chat that sees the task and Notion |
| Breaks | Suggests from the Notion break page, timed | Learns which breaks work |
| Notion writes | Mark Done, end-of-day Work Log entry | Time per task, pattern insights |
| Settings | Timer lengths for each mode, keep-going, break, switch | Themes, sounds |
| Users | Single user, sign in with Google (Ashton's account only) | Accounts, other users |

## Core loop

```
Pick mode (Low / Steady / Flow)
   │
   ▼
Focus block (Notion task + timer)  ◄──────────────┐ Keep going
   │                                               │
   ▼                                               │
Check-in ──────────────────────────────────────────┘
   ├── Done ──────► task marked Done in Notion ──► back to Pick mode (next task) or Break
   └── I'm stuck ─► "What do you need?"
                      ├── Different task ─► short timed focus block on another task ─► Check-in
                      ├── Break ──────────► idea from the break list, timed ─────────► back to Pick mode
                      └── Talk it through ► opens the Claude app ────────────────────► back to Pick mode
```

Every block ends at one check-in. Keep going loops straight back into focus, Done writes to Notion, and every stuck path ends in a task again, never in a dead end. Stop ends the loop from any screen.

## Screens and requirements

Six screens, each doing one job. Big tap targets, one main action per screen, no lists longer than 3 items.

1. **Start** — three big buttons: Low, Steady, Flow. A small "Stop" link if a session is running.
2. **Focus** — the suggested task's name only (no project emoji or due date), its first step (the task's Notes line, or "Just open it."), a countdown, and two buttons: Done and I'm stuck. "Different task" swaps the suggestion before the timer starts.
3. **Check-in** — shown when the timer ends (notification or in-app): Keep going, Done, I'm stuck.
4. **Stuck** — "What do you need?": A break, Different task for a bit, Talk it through.
5. **Break** — one break idea from your list, a countdown, "Another idea", and "I'm back".
6. **Settings** — minutes for Low, Steady, Flow, Keep going, Break, and Switch.

**Requirements**

- Timers fire on time with the screen off and the app closed.
- Every check-in can be answered from the notification itself (action buttons).
- Keep going restarts the timer at the Keep going length with no questions; after 90 minutes of total flow it adds a "2-minute pit stop" line.
- Done marks the task Done in Notion, then offers Next task or Break. Marking a parent task Done also marks all its subtasks Done.
- Different task for a bit parks the current task (stays on Today) and runs a Switch timer.
- Talk it through opens the Claude Android app; the session pauses until "I'm back".
- Stop ends any session from anywhere and cancels pending check-ins.
- No streaks, no missed-day counts, no red warnings. Copy stays kind: "One done is a good day."
- Default times: Low 10, Steady 50, Flow 90, Keep going 30, Break 15, Switch 20 minutes.

## Notion integration

Notion stays the source of truth for tasks and breaks; Focus Buddy only reads Today and writes back what happened. Access is a Notion internal integration shared with the Command Center and the Ideas For A Break page; its token lives on the server, never in the phone.

| Direction | What | Notion source |
| --- | --- | --- |
| Read | Today tasks: Task, Priority, Due, Status, Notes, Parent Task, Subtasks | All Tasks, where Today is checked and Status is not Done |
| Read | Break ideas, grouped by heading (Spiritual, Learning, Fun) | Ideas For A Break page |
| Write | Status = Done (and on every subtask when a parent is marked Done) | The task page |
| Write | One entry per day: tasks done, minutes focused, breaks taken | Work Log, Logged By = Focus Buddy |

**Task suggestion (no AI in the MVP)** — updated Nov 18: uses the Effort field (Quick, Medium, Big), not Priority.

- Low: all the Quick tasks (Medium, then Big, only if no Quick ones are left).
- Steady: Quick and Medium tasks in no set order; Big only if nothing else is left.
- Flow: the only mode with a set start: Big first, then Medium, then Quick.
- A task with no Effort counts as Medium. Skip any task parked in this session. "Different task" shows the next one in the same order.

**Break suggestion**

- Low → Spiritual list. Steady → Learning or Fun. Flow (after the flow ends) → Fun, movement items first.
- Pick at random within the list; "Another idea" picks again.
- Items with Xbox, Switch, or show in the name carry a "set a timer" line.
- Re-read the page at the start of each session, so new ideas show up without code changes.

**Notion setup:** "Focus Buddy" is already an option in Work Log → Logged By. A "First Step" text field on tasks (added Nov 18) is shown on the Focus screen when filled; otherwise the first line of Notes, otherwise "Just open it."

## Tech approach

Build it as an installable web app (PWA) on the same stack as the ops platform: Next.js on Vercel, Supabase for data and timers, Web Push for check-ins. No app store, nothing new to learn, and it can later become a module of the ops platform.

**Why this is fast**

- Same tools and accounts Claude Code is already set up for.
- Android Chrome supports installed web apps and notifications with action buttons, so check-ins work from the lock screen.
- Sign in with Google through Supabase Auth, the same as the ops platform, with only Ashton's email allowed in.
- No AI in the MVP; "Talk it through" opens the Claude app, which already reads Notion and follows the AI Instructions page.

**How timers fire with the phone locked**

A phone can't run a web timer in the background, so the server owns the clock:

1. Starting a block saves a session with `ends_at` in Supabase.
2. A Supabase cron job (`pg_cron`) runs every minute and calls an Edge Function.
3. The function sends a high-urgency Web Push for every session whose `ends_at` has passed.
4. The service worker shows the notification with action buttons and posts the tapped action to `/api/checkin`.

Check-ins can land up to about a minute late, which is fine for 10–90 minute blocks. The open app shows a live countdown from `ends_at`.

**Data model (Supabase)**

| Table | Key columns |
| --- | --- |
| settings | low_min, steady_min, flow_min, keepgoing_min, break_min, switch_min |
| sessions | id, kind (focus, break, switch), mode, notion_task_id, task_title, started_at, ends_at, notified_at, status |
| events | session_id, action (keep_going, done, stuck, break, switch, talk, stop), at |
| push_subscriptions | endpoint, p256dh, auth |

**API routes (Next.js)**

| Route | Does |
| --- | --- |
| GET /api/today | Today tasks from Notion, sorted by the suggestion rules |
| POST /api/session | Start a focus, break or switch block |
| POST /api/checkin | Keep going, Done, or Stuck from the app or the notification |
| GET /api/break?mode= | One break idea from the Notion page |
| POST /api/stop | End the session, cancel pending check-ins |
| POST /api/push/subscribe | Save this phone's push subscription |

A nightly job (`pg_cron`, 9 pm America/Denver) writes the day's Work Log entry if any sessions ran.

## Build plan

Four slices, each a working app on the phone at the end. Build one slice at a time and test on the Pixel before starting the next.

| Slice | Builds | Done when |
| --- | --- | --- |
| 1. Skeleton | Next.js app, Google sign-in (Supabase Auth), installable PWA, Start and Focus screens, local countdown, Settings | It installs to the home screen and runs a 1-minute Low block in the open app |
| 2. Timers that fire | Supabase tables, pg_cron + Edge Function, Web Push, service worker with Keep going / Done / I'm stuck buttons | A 1-minute block buzzes the locked phone and Keep going restarts it |
| 3. Notion | /api/today with suggestion rules, Done writes back (incl. subtasks), break ideas from the page, Stuck and Break screens, open Claude app | A real Today task shows; Done in the notification marks it Done in Notion |
| 4. Polish for real use | Stop everywhere, park and switch, 90-minute pit stop, nightly Work Log entry, kind copy | A full workday runs on it without opening Notion to manage timers |

**Rules for speed**

- Use defaults: shadcn/ui, Tailwind, the Supabase and Notion SDKs, the `web-push` library. No custom design system.
- Test with 1-minute timers; switch to real lengths only after slice 4.
- Anything not in Scope goes to a "Later" list (LATER.md in the repo), not into the build.
- After 2 weeks of use, review the events table and the Later list, then decide v2.

## Risks

The biggest risk is check-ins arriving late or not at all on a locked phone; slice 2 exists to prove that early.

| Risk | Fallback |
| --- | --- |
| Android battery saving delays Web Push | Set Chrome battery to Unrestricted; if still unreliable, rebuild the client in Expo with on-device scheduled notifications (same API) |
| Notion API changes or rate limits | Cache Today for 60 seconds; writes retry once, then show "Mark it in Notion" |
| It becomes another project that eats the week | Hard stop at 4 slices; everything else goes to Later |

**Decisions (Nov 18)**

- The Focus screen shows the task name only: no project emoji, no due date.
- Sign in with Google, the same as the ops platform.
- Marking a parent task Done marks all its subtasks Done.

## Handoff to Claude Code

**Ashton does these first (Claude Code can't)**

- [ ] Create a Notion internal integration named Focus Buddy; share the Command Center and Ideas For A Break pages with it; copy the token.
- [ ] Create a Supabase project and turn on Google sign-in under Auth.
- [ ] Create a Google OAuth client (Web) using the callback URL Supabase shows.
- [ ] Create a GitHub repo `focus-buddy` and a Vercel project linked to it.
- [ ] On the Pixel: Settings → Apps → Chrome → Battery → Unrestricted.

Claude Code handles the rest: VAPID keys, the `pg_cron` and `pg_net` extensions, tables, the Edge Function, and deploys.

**Notion reference** (use the Notion API version that supports data sources)

| Item | ID | Fields the app uses |
| --- | --- | --- |
| All Tasks (data source) | 41c973bc-129e-816a-b4cc-000bea524497 | Task (title), Status (To Do, Doing, Waiting On, Done), Today (checkbox), Priority (High, Medium, Low), Due (date), Notes (text), Project (relation), Parent Task (relation), Subtasks (relation) |
| Work Log (data source) | 41c973bc-129e-81a5-8cea-000bcdbc9347 | Entry (title), Date, Project, Logged By (select: use "Focus Buddy"), What Got Done (text), Next Steps (text) |
| Projects (data source) | 41c973bc-129e-810c-876a-000b057445a1 | Name (title) |
| Ideas For A Break (page) | 84e233d5-a5f5-446e-8ef0-92788bc3aca1 | Three columns, each a heading (Spiritual, Learning, Fun) over a bullet list |

**Environment variables**

| Name | What |
| --- | --- |
| NOTION_TOKEN | The Focus Buddy integration token |
| NOTION_TASKS_DS | 41c973bc-129e-816a-b4cc-000bea524497 |
| NOTION_WORKLOG_DS | 41c973bc-129e-81a5-8cea-000bcdbc9347 |
| NOTION_BREAKS_PAGE | 84e233d5-a5f5-446e-8ef0-92788bc3aca1 |
| SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY | From the Supabase project settings |
| ALLOWED_EMAIL | Ashton's Google email; everyone else is signed out |
| VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT | Web Push keys; Claude Code generates them |
| CRON_SECRET | Shared secret so only pg_cron can call the Edge Function |
| APP_TIMEZONE | America/Denver (nightly Work Log at 9 pm local) |

**First prompt for Claude Code** (save this file as `docs/PRD.md` in the repo first)

```
Read docs/PRD.md. We're building Focus Buddy one slice at a time.
Build slice 1 only. Stop when its "Done when" check passes on my Pixel, then summarize what you built and what I need to test.
Rules: stay inside Scope; put anything else in LATER.md instead of building it. Use 1-minute timers while testing. Ask me before adding a dependency that isn't named in the PRD.
```
