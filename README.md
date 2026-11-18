# Focus Buddy

A phone timer that works like an accountability buddy. See [docs/PRD.md](docs/PRD.md).
Out-of-scope ideas go in [LATER.md](LATER.md).

## Status: Slice 1 (Skeleton)

Google sign-in (Supabase Auth, one allowed email), installable PWA, Start / Focus / Check-in / Settings screens, local countdown. Timers and settings live in the browser for now; slice 2 moves them to Supabase and adds push.

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
