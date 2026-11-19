# Focus Buddy — Linear Migration PRD

Nov 18, 2026 · Ashton

## Prompt for Claude Code

```
Read docs/PRD-LINEAR.md. Migrate Focus Buddy from Notion to Linear as described.
Rules:
- App behavior, screens, timers, and copy stay the same except where this doc says otherwise.
- Build it behind a TASKS_PROVIDER env var ("notion" | "linear") so we can switch back if something breaks. Default stays "notion" until I confirm the Acceptance checks pass.
- Use the official @linear/sdk. Keep the Linear API key server-side only.
- Do the slices in order. Stop after each one, tell me what to test, and wait for my OK.
- Anything not in this doc goes in LATER.md.
```

## Overview

Linear replaces Notion as the one place for tasks, break ideas, and the daily log. Focus Buddy keeps working exactly the same from the user's side; only where it reads and writes changes. Notion stays as a read-only archive and is not deleted.

**Why:** one fast, clean app for all work, with real sub-issues, project icons, and Claude Code working from the same issues.

## Where things live in Linear

Workspace **Shadow Design**, team **Ashton** (key `ASH`, id `4afcdd92-f68b-4864-a0a4-056919dbde45`). It's the only team, and every issue is assigned to Ashton.

**Projects** (in team ASH, all to create)

| Project | Notes |
| --- | --- |
| Nimbus | |
| Blue Gold | |
| SRI | |
| Ops Platform | |
| YouTube | |
| Personal | |
| Focus Buddy | Holds the app's docs and its own dev issues |

## Field mapping (Notion → Linear)

| Notion | Linear | Notes |
| --- | --- | --- |
| Task | Issue title | |
| Project | Issue project | |
| Inbox (unsorted) | State `Backlog` (backlog, id `a23d3f4e-6d63-461a-ba12-a763f0280778`) | The team's default status, so every new capture lands here |
| Status: To Do | State `Todo` (unstarted, id `420f7fb2-9bda-48d2-98ec-776a790390dd`) | Sorted and committed |
| Status: Doing | State `In Progress` (started, id `411cac64-fb1a-410f-902d-6dfc18d8e39f`) | |
| Status: Waiting On | No new state. The issue keeps its status and **loses the Today label**; the reason goes in as a **comment** | Changed Nov 18 (see Decisions). Today needs the label, so a parked issue drops off it |
| Status: Done | State `Done` (completed, id `9d1375e3-c02c-444e-a16b-494f7f7b5d58`) | |
| — | Assignee | Always Ashton. Anything created by the app, Claude, ChatGPT, or Duet is assigned to "me" |
| Priority: High / Medium / Low | Linear priority 2 / 3 / 4 | 1 (Urgent) and 0 (none) sort after Low |
| Effort: Quick / Medium / Big | Built-in **T-shirt estimates**: S (2) / M (3) / L (5) | Feeds the cycle capacity dial and graph. No estimate = treat as M |
| This week | Current **cycle** (1 week, starts Monday) | Unfinished issues roll into next week automatically |
| Today checkbox | Label **Today** | |
| Due | Issue due date | |
| Notes | Issue description | First line = the "First step" shown on the Focus screen |
| Parent Task / Subtasks | Issue parent / sub-issues | |
| Icon (project emoji) | Not needed | The Focus screen shows the task name only |
| Source | Dropped | |

## Documents

All under the **Focus Buddy** project except AI Instructions.

| Document | Used by | Format |
| --- | --- | --- |
| Daily Log | App (nightly) + Duet (nightly) | One line per day, newest on top (below) |
| Ideas For A Break | App | `## Spiritual`, `## Learning`, `## Fun`, each with a bullet list |
| Weekly | Duet | One "Your week" entry per week, newest on top |
| AI Instructions | Claude, ChatGPT, Duet | Team-level document in ASH, rewritten for Linear |
| PRD, PRD-V2, Copy Update, V3 Ideas | People | Copied from the current docs |

**Daily Log line format** (one line per day, keys never renamed):

```
2026-11-18 (Tue) · Type: Office · Mode: Motivated · Focus: 27m · Blocks: 3 · Done: 2 · Stuck: 1 · Switches: 1 · Breaks: 1 · Sleep: OK · Day: Good · Note: felt scattered after lunch
```

- `—` means not filled yet.
- Duet's nightly check-in adds tomorrow's line at the top with `Type` filled and everything else `—`.
- The app's nightly job (8 pm) fills `Mode` through `Breaks` on today's line, creating the line if it's missing.
- Duet's 8:30 pm check-in fills `Sleep`, `Day`, and `Note` on today's line.
- Each writer re-reads the document right before writing and changes only its own keys on its own line.

## Cycles (the week)

- 1-week cycles starting Monday, no cooldown, "auto-add active issues" on.
- Unfinished issues roll into the next cycle automatically. Nothing is ever "missed."
- On Sunday night, Duet asks for the week's one focus and **renames the upcoming cycle** with it (e.g. "SRI bid sheet"). It also writes the focus at the top of that week's Weekly entry.
- The app does not read or write cycles in this migration. "This week" is a saved view in Linear.

## App changes

**1. Task provider layer**
Put every Notion call behind one interface (`getTodayTasks`, `markDone`, `getBreakIdeas`, `writeDailyLog`) with a Notion and a Linear implementation, chosen by `TASKS_PROVIDER`.

**2. Today tasks (`GET /api/today`)**
- Query team ASH issues with label **Today** whose state type is `backlog`, `unstarted`, or `started`.
- Suggestion rules are unchanged. "Doing" = state `In Progress`. "Subtask" = has a parent. "Quick" = estimate S (2). No estimate counts as M. Overdue = due date before today (America/Denver).
- Cache the result for 60 seconds.

**3. Done**
- Set the issue to state `Done`.
- If it has sub-issues, set every sub-issue that isn't completed or canceled to `Done` too.
- On failure: retry once, then show the existing "didn't save" message.

**4. Break ideas**
Read the Ideas For A Break document, split it by its three headings, and keep the current mode → list rules.

**5. Nightly job**
Replace the Notion Work Log / Daily Log write with the Daily Log line update above. Keep the same numbers in Supabase as now.

**6. Copy that mentions Notion**

| Current | New |
| --- | --- |
| Notion didn't save that. Mark it done there when you get a sec. | Linear didn't save that. Mark it done there when you get a sec. |
| …My Today list in Notion might help. (Talk it through message) | …My Today list in Linear might help. |

Search the codebase for any other user-facing "Notion" and switch it to "Linear".

**7. Environment variables**

| Name | Value |
| --- | --- |
| TASKS_PROVIDER | `notion` until cutover, then `linear` |
| LINEAR_API_KEY | Personal API key from Linear settings |
| LINEAR_TEAM_ID | 4afcdd92-f68b-4864-a0a4-056919dbde45 |
| LINEAR_DONE_STATE_ID | 9d1375e3-c02c-444e-a16b-494f7f7b5d58 |
| LINEAR_TODAY_LABEL_ID | Filled in after setup |
| LINEAR_DAILY_LOG_DOC_ID | Filled in after setup |
| LINEAR_BREAKS_DOC_ID | Filled in after setup |

Estimates are read as numbers (2 = S, 3 = M, 5 = L). Remove the `NOTION_*` variables one week after cutover.

## Setup outside the code

Done in Linear before slice L2.

**Ashton, in Team settings for Ashton (about 5 minutes)**

- [ ] Estimates: turn on, scale **T-shirt sizes**.
- [ ] Cycles: turn on, 1 week, start Monday, no cooldown, auto-add active issues.
- [ ] Issue statuses: confirm **Backlog** is the default status (no new status needed).
- [ ] Automations: auto-archive completed issues after 1 month.
- [ ] Create a Linear personal API key and add it to Vercel.

**Claude, through the Linear connector (once Ashton approves)**

- [ ] Create projects Nimbus, Blue Gold, SRI, Ops Platform, YouTube, Personal, Focus Buddy in team ASH.
- [ ] Create the **Today** label.
- [ ] Retire the "Do Date" label group and its weekday labels (retired, not deleted, so they can be restored).
- [ ] Create the Daily Log, Ideas For A Break, and Weekly documents in the Focus Buddy project; create AI Instructions as a team document.
- [ ] Move the open Notion tasks into Linear with the mapping above (Effort → estimate).
- [ ] Create recurring issues for repeating chores (e.g. "Send hours and receipts").

**Ashton, in the Linear app (if the connector can't)**

- [ ] Saved views in a favorites folder named **Focus**: ☀️ Today, ➕ Pick tasks, 📥 Inbox (Backlog), 🗓️ This week (current cycle).
- [ ] Linear Agent: paste the AI Instructions into personal agent guidance; save skills `/break-it-down`, `/sort-inbox`, `/plan-my-day`.
- [ ] Point Duet and ChatGPT at the new AI Instructions document.

## Build plan

| Slice | Builds | Done when |
| --- | --- | --- |
| L1. Provider layer | Interface + existing Notion code moved behind it, no behavior change | App works exactly as before with `TASKS_PROVIDER=notion` |
| L2. Linear read | Today tasks and break ideas from Linear | With `TASKS_PROVIDER=linear`, the Focus screen suggests a real Linear issue and the Break screen shows an idea from the doc |
| L3. Linear write | Done (with sub-issues), Daily Log line, copy changes | Done in the notification closes the issue and its sub-issues; tonight's Daily Log line is filled |
| L4. Cutover | Flip to `linear` in production, remove Notion code one week later | A full workday runs on Linear with no Notion calls in the logs |

## Acceptance checks

- Today list = exactly the ASH issues labeled Today that aren't Done or Canceled.
- "Moved it forward" (Waiting On) removes the Today label and adds a dated comment with the reason; the issue's status is unchanged.
- Low mode suggests an S-estimate or In Progress issue first.
- Marking a parent Done closes its open sub-issues.
- The Daily Log has one line per day; the app and Duet never overwrite each other's keys.
- Switching `TASKS_PROVIDER` back to `notion` restores the old behavior.

## Risks

| Risk | Fallback |
| --- | --- |
| Free plan caps the workspace at 250 issues | Everything lives in team ASH; auto-archive after 1 month; move to the Basic plan if new issues get blocked |
| App and Duet editing the Daily Log at the same moment | Different times (8:00 vs 8:30 pm), re-read before write, edit only own keys |
| Parsing breaks if the log is hand-edited | Tolerant parser: match the line by its date, keys by name; skip what it can't read and log it |
| Linear API outage | Today list shows cached tasks; Done retries once then shows the "didn't save" message |

## Later (not in this migration)

- Loops: a Sunday loop that writes "Your week" from the Daily Log (uses AI credits).
- GitHub + Linear's cloud coding agent for Focus Buddy and Ops Platform issues (uses AI credits).
- Project updates and Pulse for SRI and Ops Platform.

## Decisions (Nov 18)

- Effort uses Linear's built-in T-shirt estimates, not a label group.
- Inbox = Backlog status.
- 1-week cycles; Duet names each week's cycle with its one focus.
- No "Waiting On" status. Waiting = remove the Today label and add a comment with the reason (Nov 18, later).
- Avoided tasks are not written to the Daily Log in Linear.
- Team is **Ashton** (`ASH`), the only team; every issue is assigned to Ashton, so Today needs no assignee filter.
- The "Do Date" weekday labels are retired; Today + cycles replace them.

