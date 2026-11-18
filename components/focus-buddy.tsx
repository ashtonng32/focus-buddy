"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { PushSetup } from "@/components/push-setup";
import { useAppState, type Kind, type Mode, type SuggestedTask } from "@/lib/app-state";

const MODES: { mode: Mode; label: string; hint: string }[] = [
  { mode: "low", label: "Low", hint: "A gentle start" },
  { mode: "steady", label: "Steady", hint: "A normal block" },
  { mode: "flow", label: "Flow", hint: "Long and deep" },
];

// Opens the Claude Android app (falls back to the website if it isn't installed).
const CLAUDE_LINK =
  "intent://claude.ai/new#Intent;scheme=https;package=com.anthropic.claude;S.browser_fallback_url=https%3A%2F%2Fclaude.ai%2Fnew;end";

const NO_TASK: SuggestedTask = { id: null, title: "Your next thing", firstStep: "Just open it." };

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

type Preview = {
  kind: Exclude<Kind, "break">;
  mode: Mode;
  tasks: SuggestedTask[];
  idx: number;
  fromSessionId?: string;
};

function Screen({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 p-6">{children}</main>;
}

function Heading({ children }: { children: ReactNode }) {
  return <h1 className="text-center text-3xl font-semibold">{children}</h1>;
}

function LinkButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className="text-sm text-muted-foreground underline">
      {children}
    </button>
  );
}

export function FocusBuddy() {
  const app = useAppState();
  const { session, lastEnded, settings } = app;
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const now = useNow(Boolean(session));

  if (!app.ready || (session && now === 0)) return <main className="flex-1" />;

  async function openPreview(kind: Preview["kind"], mode: Mode, exclude: string[], fromSessionId?: string) {
    setBusy(true);
    const tasks = await app.today(mode, exclude);
    setBusy(false);
    setPreview({ kind, mode, tasks: tasks.length ? tasks : [NO_TASK], idx: 0, fromSessionId });
  }

  async function begin(b: Parameters<typeof app.start>[0]) {
    setBusy(true);
    try {
      await app.start(b);
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  // Running block
  if (session) {
    const remaining = session.endsAt - (now + app.offset);

    // Break
    if (session.kind === "break") {
      return (
        <Screen>
          <Heading>{remaining > 0 ? "Take a break" : "Break's over"}</Heading>
          {remaining > 0 && (
            <>
              <p className="text-center text-2xl">{session.taskTitle}</p>
              {session.firstStep && <p className="text-center text-muted-foreground">{session.firstStep}</p>}
              <p className="text-center text-7xl font-semibold tabular-nums">{fmt(remaining)}</p>
              <Button variant="outline" className="h-16 text-lg" onClick={() => app.anotherIdea()}>
                Another idea
              </Button>
            </>
          )}
          <Button className="h-20 text-xl" onClick={() => app.checkin("back")}>
            I&apos;m back
          </Button>
          <div className="text-center">
            <LinkButton onClick={() => app.stop()}>Stop</LinkButton>
          </div>
        </Screen>
      );
    }

    // Check-in (the notification's buttons answer the same question)
    if (remaining <= 0) {
      return (
        <Screen>
          <Heading>Time&apos;s up. How&apos;s it going?</Heading>
          <Button className="h-20 text-xl" onClick={() => app.checkin("keep_going")}>
            Keep going
          </Button>
          <Button variant="secondary" className="h-20 text-xl" onClick={() => app.checkin("done")}>
            Done
          </Button>
          <Button variant="outline" className="h-20 text-xl" onClick={() => app.checkin("stuck")}>
            I&apos;m stuck
          </Button>
          <div className="text-center">
            <LinkButton onClick={() => app.stop()}>Stop</LinkButton>
          </div>
        </Screen>
      );
    }

    // Focus
    return (
      <Screen>
        <div className="text-center">
          <h1 className="text-3xl font-semibold">{session.taskTitle}</h1>
          <p className="mt-2 text-lg text-muted-foreground">{session.firstStep}</p>
        </div>
        <p className="text-center text-7xl font-semibold tabular-nums" aria-live="off">
          {fmt(remaining)}
        </p>
        <Button className="h-20 text-xl" onClick={() => app.checkin("done")}>
          Done
        </Button>
        <Button variant="outline" className="h-20 text-xl" onClick={() => app.checkin("stuck")}>
          I&apos;m stuck
        </Button>
        <div className="text-center">
          <LinkButton onClick={() => app.stop()}>Stop</LinkButton>
        </div>
      </Screen>
    );
  }

  // Suggested task, before the timer starts: Start, or swap for a different one
  if (preview) {
    const task = preview.tasks[preview.idx];
    const minutes = preview.kind === "switch" ? settings.switch : settings[preview.mode];
    return (
      <Screen>
        <div className="text-center">
          <h1 className="text-3xl font-semibold">{task.title}</h1>
          <p className="mt-2 text-lg text-muted-foreground">{task.firstStep}</p>
        </div>
        <Button
          className="h-24 text-2xl"
          disabled={busy}
          onClick={() =>
            begin({ kind: preview.kind, mode: preview.mode, taskId: task.id, fromSessionId: preview.fromSessionId })
          }
        >
          Start · {minutes} min
        </Button>
        {preview.tasks.length > 1 && (
          <Button
            variant="outline"
            className="h-16 text-lg"
            onClick={() => setPreview({ ...preview, idx: (preview.idx + 1) % preview.tasks.length })}
          >
            Different task
          </Button>
        )}
        <div className="text-center">
          <LinkButton onClick={() => setPreview(null)}>Back</LinkButton>
        </div>
      </Screen>
    );
  }

  // Finished block waiting on its follow-up
  if (lastEnded) {
    const mode: Mode = lastEnded.mode ?? "steady";

    if (lastEnded.status === "done") {
      return (
        <Screen>
          <Heading>One done is a good day.</Heading>
          {lastEnded.notionFailed && (
            <p className="text-center text-muted-foreground">
              I couldn&apos;t update Notion. Mark &ldquo;{lastEnded.taskTitle}&rdquo; done there.
            </p>
          )}
          <Button className="h-20 text-xl" onClick={() => app.resolve(lastEnded.id, "handled")}>
            Next task
          </Button>
          <Button
            variant="outline"
            className="h-20 text-xl"
            disabled={busy}
            onClick={() => begin({ kind: "break", mode, fromSessionId: lastEnded.id })}
          >
            Take a break
          </Button>
        </Screen>
      );
    }

    // Stuck, and off talking it through in the Claude app
    if (lastEnded.talking) {
      return (
        <Screen>
          <Heading>Talk it through</Heading>
          <p className="text-center text-muted-foreground">Come back whenever you&apos;re ready.</p>
          <Button className="h-20 text-xl" onClick={() => app.resolve(lastEnded.id, "handled")}>
            I&apos;m back
          </Button>
          <a href={CLAUDE_LINK} className="text-center text-sm text-muted-foreground underline">
            Open Claude again
          </a>
        </Screen>
      );
    }

    // Stuck: What do you need?
    return (
      <Screen>
        <Heading>What do you need?</Heading>
        <p className="text-center text-muted-foreground">Being stuck is okay.</p>
        <Button
          className="h-20 text-xl"
          disabled={busy}
          onClick={() => begin({ kind: "break", mode, fromSessionId: lastEnded.id })}
        >
          A break
        </Button>
        <Button
          variant="secondary"
          className="h-20 text-xl"
          disabled={busy}
          onClick={() =>
            openPreview("switch", mode, lastEnded.notionTaskId ? [lastEnded.notionTaskId] : [], lastEnded.id)
          }
        >
          Different task for a bit
        </Button>
        <Button
          variant="outline"
          className="h-20 text-xl"
          onClick={async () => {
            await app.resolve(lastEnded.id, "talk");
            window.location.href = CLAUDE_LINK;
          }}
        >
          Talk it through
        </Button>
      </Screen>
    );
  }

  // Start
  return (
    <Screen>
      <Heading>How are you feeling?</Heading>
      {app.failed && (
        <p className="text-center text-sm text-muted-foreground">Can&apos;t reach the server. Check your connection.</p>
      )}
      <div className="flex flex-col gap-3">
        {MODES.map(({ mode, label, hint }) => (
          <Button
            key={mode}
            className="h-24 flex-col text-2xl"
            disabled={busy}
            onClick={() => openPreview("focus", mode, [])}
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
    </Screen>
  );
}
