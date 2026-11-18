"use client";

import { useEffect, useState } from "react";
import { PushSetup } from "@/components/push-setup";
import {
  BreakScreen,
  CheckInScreen,
  DoneScreen,
  FocusScreen,
  Light,
  StartScreen,
  StuckScreen,
  TalkScreen,
  TaskPreviewScreen,
} from "@/components/screens";
import { useBackStack } from "@/lib/back-stack";
import { claudeLink, copyPrompt, stuckPrompt } from "@/lib/claude-link";
import { useAppState, type Kind, type Mode, type SuggestedTask } from "@/lib/app-state";

const NO_TASK: SuggestedTask = { id: null, title: "Your next thing", firstStep: "Just open it." };

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

export function FocusBuddy() {
  const app = useAppState();
  const { session, lastEnded, settings } = app;
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<boolean | null>(null);
  const now = useNow(Boolean(session));

  // Back swipe: closes the suggested-task screen; never closes the app mid-block.
  useBackStack({
    overlay: Boolean(preview) && !session,
    hold: Boolean(session || lastEnded),
    onOverlayBack: () => setPreview(null),
  });

  if (!app.ready || (session && now === 0)) return <Light />;

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

    if (session.kind === "break") {
      return (
        <BreakScreen
          idea={session.taskTitle}
          note={session.firstStep}
          remainingMs={remaining}
          over={remaining <= 0}
          onAnother={() => app.anotherIdea()}
          onBack={() => app.checkin("back")}
          onStop={() => app.stop()}
        />
      );
    }

    const mode: Mode = session.mode ?? "steady";
    const kind = session.kind;

    // Check-in (the notification's buttons answer the same question)
    if (remaining <= 0) {
      // After 90 minutes of total flow, the check-in adds a pit stop line.
      const flowMs = session.focusTotalMs + (session.endsAt - session.startedAt);
      return (
        <CheckInScreen
          pitStop={kind === "focus" && mode === "flow" && flowMs >= 90 * 60_000}
          onKeep={() => app.checkin("keep_going")}
          onDone={() => app.checkin("done")}
          onStuck={() => app.checkin("stuck")}
          onStop={() => app.stop()}
        />
      );
    }

    return (
      <FocusScreen
        mode={mode}
        kind={kind}
        title={session.taskTitle}
        firstStep={session.firstStep}
        remainingMs={remaining}
        totalMs={session.endsAt - session.startedAt}
        onDone={() => app.checkin("done")}
        onStuck={() => app.checkin("stuck")}
        onStop={() => app.stop()}
      />
    );
  }

  // Suggested task, before the timer starts: Start, or swap for a different one
  if (preview) {
    const task = preview.tasks[preview.idx];
    return (
      <TaskPreviewScreen
        task={task}
        mode={preview.mode}
        kind={preview.kind}
        minutes={preview.kind === "switch" ? settings.switch : settings[preview.mode]}
        canSwap={preview.tasks.length > 1}
        busy={busy}
        onStart={() =>
          begin({ kind: preview.kind, mode: preview.mode, taskId: task.id, fromSessionId: preview.fromSessionId })
        }
        onSwap={() => {
          if (task.id) app.skip({ id: task.id, title: task.title });
          setPreview({ ...preview, idx: (preview.idx + 1) % preview.tasks.length });
        }}
        onBack={() => setPreview(null)}
      />
    );
  }

  // Finished block waiting on its follow-up
  if (lastEnded) {
    const mode: Mode = lastEnded.mode ?? "steady";

    if (lastEnded.status === "done") {
      return (
        <DoneScreen
          title={lastEnded.taskTitle}
          notionFailed={lastEnded.notionFailed}
          busy={busy}
          onNext={() => app.resolve(lastEnded.id, "handled")}
          onBreak={() => begin({ kind: "break", mode, fromSessionId: lastEnded.id })}
          onStop={() => app.stop()}
        />
      );
    }

    // Stuck, and off talking it through in the Claude app
    if (lastEnded.talking) {
      return (
        <TalkScreen
          message={stuckPrompt(lastEnded.taskTitle)}
          copied={copied}
          claudeHref={claudeLink(lastEnded.taskTitle)}
          onCopy={async () => setCopied(await copyPrompt(lastEnded.taskTitle))}
          onBack={() => app.resolve(lastEnded.id, "handled")}
          onStop={() => app.stop()}
        />
      );
    }

    // Stuck: What do you need?
    return (
      <StuckScreen
        busy={busy}
        onBreak={() => begin({ kind: "break", mode, fromSessionId: lastEnded.id })}
        onSwitch={() =>
          openPreview("switch", mode, lastEnded.notionTaskId ? [lastEnded.notionTaskId] : [], lastEnded.id)
        }
        onTalk={async () => {
          copyPrompt(lastEnded.taskTitle); // inside the tap, so the browser allows it
          await app.resolve(lastEnded.id, "talk");
          window.location.href = claudeLink(lastEnded.taskTitle);
        }}
        onStop={() => app.stop()}
      />
    );
  }

  // Start
  return (
    <StartScreen
      minutes={{ low: settings.low, steady: settings.steady, flow: settings.flow }}
      busy={busy}
      failed={app.failed}
      push={<PushSetup />}
      onPick={(mode) => openPreview("focus", mode, [])}
    />
  );
}
