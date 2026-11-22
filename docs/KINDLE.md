# Kindle desk screen

A jailbroken Kindle Touch running KOReader shows Focus Buddy in landscape:
How are you feeling? → Up next (the suggested task) → Timer → I'm stuck → Take a break / Work on something else.
It uses the same API and data as the phone, so the two stay in sync (the Kindle re-checks every 5 seconds).

## Flow

- **How are you feeling?** Low / Motivated / Flow, each showing its timer length from Settings.
- **Up next:** the first task from `/api/today` for that mode (the same Today list and order as the phone),
  shown large with its first step. **Start · N min**, or **Choose a different task** to step to the next
  suggestion (recorded with `/api/skip`, like the phone's "Different task").
- **Timer:** task on the left, minutes left on the right, **I'm stuck** along the bottom.
- **Time's up:** Keep going / Done / I'm stuck. Stuck → Take a break / Work on something else.

## Sync with the phone

- The plugin polls `/api/state` every 5 s, so starting or stopping a timer on the phone shows up within about
  5 s. After an error (offline, server down) it retries every 60 s, or tap **Try again**.
- It redraws only when what's on screen changed, so polls don't flash the e-ink.
- Each poll briefly blocks the Kindle (about 0.3 s), so a tap now and then can feel a little slow. If the
  Kindle stays open all day, watch Vercel **Usage** (about 17k requests a day).
- Polling only happens while Focus Buddy is open and the Kindle is awake.

## Sleep, auto sleep, and auto-open

- **Open when KOReader starts** (Tools → Focus Buddy, on by default): Focus Buddy opens once each time
  KOReader starts. Close goes to the file browser as usual.
- **Sleep** (top bar, next to Close): KOReader's Keep alive sets `preventScreenSaver 1`, which also blocks the
  power button. Sleep reads that setting from powerd, turns it off, asks KOReader to suspend, and turns it back on
  when the Kindle wakes (the `Resume` event). If KOReader's suspend doesn't work, it tries
  `lipc-set-prop -i com.lab126.powerd powerButton 1`, then `powerd_test -p`. If the Kindle is still awake after
  13 s, Keep alive goes back on and a message shows what was tried. Steps are logged to `koreader/crash.log`
  (`FocusBuddy sleep:`).
- **Auto sleep** (Tools → Focus Buddy → Auto sleep, default 6 PM, or Off / 5–10 PM): when the Kindle's clock
  passes that time while Focus Buddy is open, it sleeps as soon as no focus timer is running. Opening Focus
  Buddy or waking the Kindle later that evening doesn't trigger it again.
- For the first minute after waking, a failed sync retries every 5 s (Wi-Fi reconnecting).

## Updating the plugin on the Kindle

Replace the folder, skipping the macOS `._` files:

```bash
rm -rf /Volumes/Kindle/koreader/plugins/focusbuddy.koplugin
```

```bash
mkdir /Volumes/Kindle/koreader/plugins/focusbuddy.koplugin && COPYFILE_DISABLE=1 cp kindle/focusbuddy.koplugin/*.lua /Volumes/Kindle/koreader/plugins/focusbuddy.koplugin/
```

Then eject and restart KOReader.

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
  `/api/session`, `/api/checkin`, `/api/resolve`, `/api/skip`). `authedDb()` accepts either that token or the usual sign-in.
- "Talk it through" and "Moved it forward" stay on the phone.
