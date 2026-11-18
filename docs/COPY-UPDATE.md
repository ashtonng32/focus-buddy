# Focus Buddy — Copy Update

Nov 18, 2026 · Ashton

Every screen's text rewritten in one voice: a friend texting you, not an app talking to you.

## Prompt for Claude Code

```
Read docs/COPY-UPDATE.md. Update the app's user-facing text to match the "New" column in every table.
Rules:
- Change words only. No layout, styling, logic, or route changes.
- Find each "Current" string in the codebase (components, the service worker, and the Edge Function that sends push notifications) and replace it with "New".
- Keep existing emphasis styling where noted (e.g. the italic word in the Start heading).
- The "Steady" mode is renamed "Motivated" on screen only. Keep the internal value (e.g. "steady" in the database, API, and settings keys) unchanged.
- If you find user-facing text that isn't in this doc, rewrite it using the Voice rules and list it in your summary so I can check it.
- When done, list every file you changed.
```

## Voice rules

Focus Buddy should sound like a friend texting you, not an app talking to you.

1. **Short and plain.** Contractions always. If a sentence works with fewer words, use fewer.
2. **No slogans, no therapy-speak.** Skip lines like "One gentle step at a time" or "Being stuck is okay." Say what a real person would say out loud.
3. **Say what happens next.** Buttons and messages tell you what will happen, not how you should feel.
4. **One kind line per screen, max.** Warmth comes from tone, not from reassuring every sentence.
5. **No guilt, no hype.** No "Great job!!", no streaks, no "You missed…". At most one exclamation mark in the whole app.
6. **Errors sound human.** Say what went wrong in plain words and what to do. Ashton is often in the field with bad signal.
7. **No developer notes in the UI** (like "Use 1 while testing").

## Sign-in screen

| Current | New |
| --- | --- |
| Find your focus. One gentle step at a time. | Let's get something done. |
| Your accountability buddy. | Tell me how you're feeling and I'll take it from there. |
| Sign in with Google | Continue with Google |

## Start screen

| Current | New |
| --- | --- |
| How's your *energy* today? | How are you *feeling*? (keep the italic on the last word) |
| Pick one. There's no wrong answer. | Pick One |
| Low — A gentle start | Low — Easy |
| Steady — A normal block | Motivated — Ready |
| Flow — Long and deep | Flow — Locked-in |
| Notifications are blocked. Allow them for this app in Chrome's site settings. | Notifications are off, so I can't check in with you. Turn them on in Chrome's site settings. |
| This browser can't send check-ins. Open the installed app on your phone. | Check-ins only work in the app on your phone. Open it there. |
| Can't reach the server. Check your connection. | Can't connect right now. Check your signal and try again. |

## Focus screen

| Current | New |
| --- | --- |
| Your next thing | Up next |
| First step | First step (keep) |
| Just open it. | Just open it. That's the whole first step. |
| Start · {minutes} | Start · {minutes} (keep) |
| Stop | Stop for now |

## Check-in (in the app)

| Current | New |
| --- | --- |
| Time's up. | That's time. |
| How's it going? | How's it going? (keep) |
| You've been in flow a while. Want a 2-minute pit stop? Water, stretch, then keep going. | You've been at it a while. Take 2 minutes? Grab some water, stretch, then jump back in. |
| Keep going | Keep going (keep) |
| I'm stuck | I'm stuck (keep) |
| One done is a good day. | Nice, that one's done. One done is a good day. |
| I couldn't update Notion. Mark it done there. | Notion didn't save that. Mark it done there when you get a sec. |
| Next task | What's next? |

## Push notification

The title and body come from the Edge Function, so their current wording wasn't visible from the app.

| Current | New |
| --- | --- |
| Title (in the Edge Function) | That's time. |
| Body (in the Edge Function) | How's it going? |
| Button: Keep going | Keep going (keep) |
| Button: I'm stuck | I'm stuck (keep) |

## Stuck screen

| Current | New |
| --- | --- |
| What do you need? | What do you need? (keep) |
| Being stuck is okay. | Let's get you moving again. |
| A break — A little reset, timed. | A break — Step away for a few minutes. |
| Different task for a bit — Switch gears for a short while. | Something else for a bit — This one will be here when you come back. |
| Talk it through — Chat with Claude about it. | Talk it through — Talk it out with Claude. |

## Talk it through screen

| Current | New |
| --- | --- |
| Your first message | Here's what I'll send Claude |
| Open Claude | Open Claude (keep) |
| Copy message | Copy message (keep) |
| Copied. Paste it into Claude | Copied. Paste it into Claude. |
| Couldn't copy. Press and hold the text | Couldn't copy it. Press and hold the text instead. |

**Message sent to Claude**

- Current: I'm using my Focus Buddy timer and I'm stuck on "{task}". Help me get unstuck without any guilt. Ask me one short question about what's getting in the way, then help me find a tiny first step. If it helps, look at my Today list in Notion.
- New: I'm stuck on "{task}" and could use a hand. Ask me one quick question about what's in the way, then help me find a tiny first step. My Today list in Notion might help.

## Switch screen

| Current | New |
| --- | --- |
| Switching gears | Okay, something else for a bit. |
| A little something else | Your other task will be waiting. |
| Up next | Up next (keep) |

## Break screen

| Current | New |
| --- | --- |
| Take a break | Take a break (keep) |
| Break's over | Break's over. |
| Ready when you are. | Ready when you are. (keep) |
| I'm back | I'm back (keep) |

## Settings

| Current | New |
| --- | --- |
| Settings | Settings (keep) |
| Minutes for each block. Use 1 while testing. | How long each timer runs, in minutes. |
| Focus blocks | Work timers |
| In between | Breaks and switches |
| Keep going | Keep going adds |
| Break | Break (keep) |
| Switch | Something else |
| Couldn't save. Try again. | That didn't save. Try again? |

## Leave as is

The generic error page ("This page couldn't load", "Reload", "Back") is the framework's default and is fine to keep.
