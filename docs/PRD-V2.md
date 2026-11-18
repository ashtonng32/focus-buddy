# Focus Buddy — V2 PRD

Nov 18, 2026 · Ashton

> Builds on the MVP PRD (docs/PRD.md). Everything in the MVP stays unless this doc says otherwise.

## Overview

V2 splits the work three ways: Claude Duet plans the day, Focus Buddy runs the moment, and Notion keeps the record both of them read. On top of that record, V2 adds analytics so Ashton can see how he actually works — what makes a good day, what gets avoided, how sleep and field days affect energy.

**Starts when:** the MVP has been used on real workdays for 2 weeks and Ashton has access to the Duet research preview (US Pro/Max waitlist).

**Success after 4 weeks on V2**

- Ashton no longer has to remember to plan the day; the plan arrives each evening.
- One weekly insight changes how he plans (for example, hard tasks moved after good-sleep days).
- The analytics feel helpful, not judgmental. If any part makes him feel worse, it gets cut.

## Scope

V2 adds a nightly Duet check-in, a Daily Log in Notion, and a weekly insights page in Notion. Everything from the MVP stays.

| Area | In V2 | V3 ideas |
| --- | --- | --- |
| Planning | One nightly Duet check-in: wraps today, plans tomorrow | Duet re-plans mid-day when a day goes sideways |
| Weekly focus | Sunday night: "What's the one thing that would make this week a win?" Daily picks lean toward it | — |
| Rough-day protection | A Rough day or Poor sleep means a lighter tomorrow: 2 Quick tasks, start in Low | — |
| Day type | "Tomorrow is a field day" option in the nightly plan | — |
| Mode | Picked in the app each morning; Low mode prefers Quick tasks | Mode suggested from past patterns |
| Inbox | Duet proposes a project and Effort for each new Inbox task; Ashton says yes or fixes it | — |
| Waiting On | Items waiting 5+ days get a mention and a ready-to-send follow-up text | — |
| Nightly journal | Day feel, sleep last night, and one optional journal line | Habit experiments (protein, water) |
| Daily Log | One Notion row per day with the day's numbers and journal | Monthly trends, export |
| Insights | Weekly "Your week" page in Notion, written by Duet | Insights screen in the app with hourly patterns |
| Avoidance help | Flags tasks switched away from 3+ times; Duet offers to break them down | Automatic breakdown |
| Talk it through | Opens the Claude app (unchanged) | Hands off to Duet with the task attached |

V3 ideas are kept in Notion: Ideas → Focus Buddy → V3 Ideas.

## How the pieces fit

```
                         Ashton
          1 check-in a night │ taps check-ins
                ┌────────────┴────────────┐
                ▼                         ▼
          Claude Duet                Focus Buddy
   nightly wrap, journal,       timers and check-ins,
     and tomorrow's plan          Daily Log numbers
                │                         │
 writes: Today picks, journal   reads: Today, mode, breaks
 reads: Daily Log, tasks        writes: Done, day's numbers
                │                         │
                └──────────► Notion ◄─────┘
                 Today tasks, break ideas, Daily Log
```

Duet and Focus Buddy never talk to each other directly. Each reads and writes Notion, so either one can be swapped or paused without breaking the other.

## Duet as planner

Duet sends one message a night at 8:30 pm: a short wrap of today, a short journal, and tomorrow's plan, so Ashton can mentally prepare for the next day. It runs on the same Notion connector and AI Instructions page as regular Claude.

**Nightly check-in (8:30 pm)**

1. **Wrap today.** Reads today's Daily Log row and says what got done in one or two lines, naming one win, even if it's small. On days with no focus blocks: "No focus blocks today. How did it go?"
2. **Journal (one tap each).** How did today feel: Rough, OK, Good? How did you sleep last night: Poor, OK, Great? Then one optional line: "Anything on your mind about today?" (typed or spoken).
3. **Tomorrow's day type.** Office, Field, or Mixed. A field day gets 1 Quick task or none.
4. **Tomorrow's plan.** Asks whether unfinished Today tasks stay, then suggests up to 3 tasks, one line each, and checks Today on them after Ashton says yes.
5. **One pattern, when it helps.** For example: "Your Good days lately follow Great sleep."
6. **Avoidance offer.** If a task was switched away from 3 or more times this week, offers to break it into smaller steps.

**Built into the check-in**

- **Rough-day protection.** If today was Rough or last night's sleep was Poor, tomorrow's plan is 2 Quick tasks with a nudge to start in Low mode. No explanation needed.
- **Inbox sorting.** If tasks landed in the Inbox today, Duet lists them with a proposed project and Effort each. Ashton says yes or fixes the one that's wrong.
- **Waiting On follow-ups.** Anything in Waiting On for 5 or more days gets one line and a short follow-up text Ashton can copy and send. At most 2 per night.
- **Weekly focus.** On Sunday night, Duet asks for the week's one focus and saves it at the top of that week's "Your week" page. Daily picks lean toward it all week.

On a busy night the check-in stays short: wrap and journal first, then only the parts that have something to say.

**Which nights**

- Sunday: pick the week's one focus, then plan Monday.
- Monday to Thursday: wrap today, journal, plan tomorrow.
- Friday: wrap and journal only.
- Saturday: nothing, unless Ashton starts the conversation.

**Rules for Duet**

- One message a night. No reminders, nudges, or follow-ups in between unless Ashton starts the conversation.
- Never mention missed days, streaks, or what didn't get done as a failure.
- Every question is one tap; the journal line is always optional.
- Keep every message short enough to read on a phone screen without scrolling.

These rules go in a new "Duet" section on the AI Instructions page so Duet reads them every time.

## Analytics

Analytics answer five questions about how Ashton works, using data the app already records, plus the nightly one-tap journal (day feel and sleep).

| Question | Measure | From |
| --- | --- | --- |
| What makes a good day? | Day feel next to sleep, day type, mode, and focus minutes | Daily Log |
| Does sleep change my energy? | Day feel and mode picked, grouped by sleep last night | Daily Log |
| Does Low mode actually get me started? | Share of Low blocks that end in Keep going or Done, not Stuck | Daily Log |
| What am I avoiding? | Tasks switched away from or skipped 3+ times in 7 days | Daily Log |
| How do field days affect the rest of the week? | Day feel and focus minutes on the day after a field day | Daily Log |

**Where it shows up**

- **Weekly "Your week" page in Notion:** Duet writes it each Sunday from the Daily Log. Three short parts: one win, one pattern worth using, one small thing to try next week.
- **Nightly check-in:** Duet uses at most one pattern, only when it helps tomorrow's plan.
- **Notion Daily Log:** the raw daily numbers and journal, so Ashton (or any AI) can look back.

Hour-by-hour patterns (best flow hours) need the app's own data and move to V3.

**Tone rules**

- Every insight is framed as a pattern to use, never a grade ("Your Good days follow Great sleep", not "You were unfocused 70% of the day").
- No totals that compare weeks against each other, no streaks, no red.
- An avoided task is shown with an offer ("Break it down?"), not a count of failures.
- Insights need at least 5 workdays of data; before that the weekly page says "Still learning your patterns."

## Data changes

The biggest change: the MVP's nightly Work Log entry moves to a new Notion **Daily Log** database, one row per day. Work Log goes back to being for project sessions only.

**New Notion database: Daily Log** (under Command Center)

| Field | Type | Written by |
| --- | --- | --- |
| Date | Title + date | Duet (night before) |
| Day type | Select: Office, Field, Mixed | Duet (night before) |
| Mode | Select: Low, Steady, Flow (first pick of the day) | Focus Buddy |
| Focus minutes | Number | Focus Buddy (nightly) |
| Blocks | Number | Focus Buddy |
| Tasks done | Number | Focus Buddy |
| Keep goings | Number | Focus Buddy |
| Stuck taps | Number | Focus Buddy |
| Switches | Number | Focus Buddy |
| Breaks | Number | Focus Buddy |
| Avoided tasks | Relation to All Tasks | Focus Buddy |
| Day feel | Select: Rough, OK, Good | Duet (nightly check-in) |
| Sleep | Select: Poor, OK, Great (last night) | Duet (nightly check-in) |
| Journal | Text | Duet (nightly check-in) |

**Supabase additions**

- `sessions`: add `effort` (copied from Notion when the block starts).
- `events`: add `hour` and `weekday` (local time, America/Denver) so queries stay simple.
- New view `daily_summary` that the nightly job uses to fill the Daily Log.

**Focus Buddy changes**

- Task pick uses Effort: Low mode prefers Quick tasks.
- The first mode picked each day is written to the Daily Log.
- Nightly job (8 pm, before Duet's check-in) fills the day's Daily Log numbers instead of writing to Work Log.
- No new screens in V2.

## Build plan

Two code slices after the MVP, plus two steps that need no code. The weekly page comes last because it needs real data to be worth writing.

| Step | Builds | Done when |
| --- | --- | --- |
| 0. Duet setup (no code) | Create the Daily Log database; add the Duet section to AI Instructions; set the nightly 8:30 pm check-in schedule | Duet sends a nightly check-in, saves the journal, and checks Today on the tasks Ashton approves |
| 5. Daily Log | Nightly job (8 pm) writes the day's numbers and first mode to Daily Log; Effort in task pick | After a workday, the Daily Log row is full and Duet's wrap quotes it |
| 6. Avoidance help | Count switches and skips per task; write Avoided tasks; Duet offers breakdowns | A task skipped 3 times shows up in the check-in with an offer |
| 7. Weekly page (no code) | Duet writes "Your week" each Sunday from the Daily Log | After 5 workdays, the page shows one win, one pattern, one thing to try |

Same rules as the MVP: one slice at a time, tested on the Pixel, anything new goes to LATER.md.

## Risks and decisions

The main risk is that more data turns into more pressure; the tone rules and the "cut it if it feels bad" test exist for that.

| Risk | Fallback |
| --- | --- |
| Duet is still a research preview and access may be slow or change | Step 0 is optional: "plan my day" in regular Claude works the same way, using the same AI Instructions |
| Duet's background checks use up subscription limits faster | One message a night only; no mid-day monitoring |
| Analytics start to feel like a report card | Drop the part of the weekly page that feels bad; Duet can skip patterns entirely |
| Too little data for real patterns | Show "Still learning" until 5 workdays are logged |

**Decisions (Nov 18)**

- The wrap and the next day's plan are one nightly check-in at 8:30 pm, Sunday to Friday as listed above.
- The check-in runs every night, even with no focus blocks, as a short journal. "Tomorrow is a field day" is an option in the plan.
- Insights are a weekly Notion page written by Duet; the app screen moves to V3.
- Start tracking day feel and sleep only. Habit experiments wait for V3.
- Added to the check-in: rough-day protection, Inbox sorting, Waiting On follow-ups, and a weekly focus. All of it is Duet behavior; no app code.
- Google Calendar is skipped for V2 (moved to V3 Ideas).
