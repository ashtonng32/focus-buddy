"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PushSetup } from "@/components/push-setup";
import { useAppState, type Mode } from "@/lib/app-state";

const MODES: { mode: Mode; label: string; hint: string }[] = [
  { mode: "low", label: "Low", hint: "A gentle start" },
  { mode: "steady", label: "Steady", hint: "A normal block" },
  { mode: "flow", label: "Flow", hint: "Long and deep" },
];

function fmt(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// 0 until the first tick after mount (Date.now() can't be read during prerender).
function useNow(active: boolean) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 250);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [active]);
  return now;
}

export function FocusBuddy() {
  const app = useAppState();
  const { session, settings } = app;
  const [message, setMessage] = useState<string | null>(null);
  const now = useNow(Boolean(session));

  if (!app.ready || (session && now === 0)) return <main className="flex-1" />;

  const kind = (text: string | null) => setMessage(text);

  // Start
  if (!session) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 p-6">
        <h1 className="text-center text-3xl font-semibold">How are you feeling?</h1>
        {message && <p className="text-center text-muted-foreground">{message}</p>}
        {app.failed && (
          <p className="text-center text-sm text-muted-foreground">
            Can&apos;t reach the server. Check your connection.
          </p>
        )}
        <div className="flex flex-col gap-3">
          {MODES.map(({ mode, label, hint }) => (
            <Button
              key={mode}
              className="h-24 flex-col text-2xl"
              onClick={() => {
                kind(null);
                app.start(mode);
              }}
            >
              {label}
              <span className="text-sm font-normal opacity-80">
                {hint} · {settings[mode]} min
              </span>
            </Button>
          ))}
        </div>
        <PushSetup />
        <Link href="/settings" className="mt-2 text-center text-sm text-muted-foreground underline">
          Settings
        </Link>
      </main>
    );
  }

  const remaining = session.endsAt - (now + app.offset);

  async function done() {
    kind("One done is a good day.");
    await app.checkin("done");
  }
  async function stuck() {
    kind("Being stuck is okay. Stuck options are coming soon.");
    await app.checkin("stuck");
  }
  async function stop() {
    kind(null);
    await app.stop();
  }

  // Check-in (the notification's buttons answer the same question)
  if (remaining <= 0) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 p-6">
        <h1 className="text-center text-3xl font-semibold">Time&apos;s up. How&apos;s it going?</h1>
        <Button className="h-20 text-xl" onClick={() => app.checkin("keep_going")}>
          Keep going
        </Button>
        <Button variant="secondary" className="h-20 text-xl" onClick={done}>
          Done
        </Button>
        <Button variant="outline" className="h-20 text-xl" onClick={stuck}>
          I&apos;m stuck
        </Button>
        <StopLink onStop={stop} />
      </main>
    );
  }

  // Focus
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-6 text-center">
      <div>
        <h1 className="text-3xl font-semibold">{session.taskTitle}</h1>
        <p className="mt-2 text-lg text-muted-foreground">{session.firstStep}</p>
      </div>
      <p className="text-7xl font-semibold tabular-nums" aria-live="off">
        {fmt(remaining)}
      </p>
      <div className="flex flex-col gap-3">
        <Button className="h-20 text-xl" onClick={done}>
          Done
        </Button>
        <Button variant="outline" className="h-20 text-xl" onClick={stuck}>
          I&apos;m stuck
        </Button>
      </div>
      <StopLink onStop={stop} />
    </main>
  );
}

function StopLink({ onStop }: { onStop: () => void }) {
  return (
    <button onClick={onStop} className="text-sm text-muted-foreground underline">
      Stop
    </button>
  );
}
