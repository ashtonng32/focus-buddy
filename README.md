# Focus Buddy

A phone timer that works like an accountability buddy. See [docs/PRD.md](docs/PRD.md).
Out-of-scope ideas go in [LATER.md](LATER.md).

## Status: all four slices built

1. Skeleton: Google sign-in, installable PWA, Start / Focus / Settings.
2. Timers that fire: server-owned timers, pg_cron + Edge Function, Web Push check-ins with action buttons.
3. Notion: real Today tasks, suggestion rules, Done write-back (subtasks too), break ideas, Stuck / Break / Talk it through.
4. Polish: Stop from every screen, parked tasks (skipped for 3 hours after "Different task for a bit"), 2-minute pit stop after 90 minutes of flow, nightly Work Log entry (hourly cron, writes from 9 pm America/Denver).

Testing tip: set Low to 1 minute in Settings; switch back to real lengths for real use.

## Run it

```bash
cp .env.example .env.local   # fill in the three values
npm run dev
```

Supabase: Auth → Providers → Google on; add `http://localhost:3000/auth/callback` and your Vercel URL + `/auth/callback` under Auth → URL Configuration → Redirect URLs.

## Test slice 1 on the Pixel

1. Deploy to Vercel with the three env vars, open the URL in Chrome, sign in.
2. Chrome menu → Install app.
3. Settings → set Low to 1 → Save → Start → Low. A 1-minute countdown runs; at zero the check-in appears.
