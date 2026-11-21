# Kindle desk screen

A jailbroken Kindle Touch running KOReader shows Focus Buddy in landscape:
How are you feeling? → Pick a task → Timer → I'm stuck → Take a break / Work on something else.
It uses the same API and data as the phone, so the two stay in sync (the Kindle re-checks every minute).

## Server setup (once)

1. Apply the migration `supabase/migrations/20261121120000_kindle.sql` (`supabase db push`, or paste it in the SQL editor).
2. In Vercel → Settings → Environment Variables, add:
   - `KINDLE_PIN_HASH`: the SHA-256 of your PIN. On a Mac: `echo -n 'YOUR-PIN' | shasum -a 256` (copy the long hex part).
   - `KINDLE_SECRET`: any long random string. On a Mac: `openssl rand -hex 32`.
3. Redeploy.

## Kindle setup (once)

1. Plug in the Kindle and copy the `kindle/focusbuddy.koplugin` folder into `koreader/plugins/` on the Kindle drive.
2. Eject, open KOReader, then top menu → Tools → Focus Buddy → Open Focus Buddy.
3. Tap **Enter PIN**. The Kindle keeps its sign-in after that.

Wrong PIN 5 times locks sign-in for 15 minutes.
To sign the Kindle out: Tools → Focus Buddy → Sign out this Kindle.
To revoke every Kindle sign-in from the server: `update public.kindle_auth set token_version = token_version + 1;`

## How it works

- `POST /api/kindle/login` trades the PIN for a signed token.
- The Kindle sends `Authorization: Bearer <token>` to the normal API routes (`/api/state`, `/api/today`,
  `/api/session`, `/api/checkin`, `/api/resolve`). `authedDb()` accepts either that token or the usual sign-in.
- "Talk it through" and "Moved it forward" stay on the phone.
