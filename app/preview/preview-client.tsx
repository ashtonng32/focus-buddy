"use client";

import { useSearchParams } from "next/navigation";
import {
  BackToTaskScreen,
  BreakScreen,
  CheckInScreen,
  DoneScreen,
  FocusScreen,
  StartScreen,
  StuckScreen,
  TalkScreen,
  TaskPreviewScreen,
} from "@/components/screens";
import { claudeLink, stuckPrompt } from "@/lib/claude-link";

const noop = () => {};

const task = { id: "1", title: "Getting Shipping Wrapped Up", firstStep: "Print the labels." };

export function PreviewClient() {
  const s = useSearchParams().get("s") ?? "start";
  switch (s) {
    case "task":
      return <TaskPreviewScreen task={task} mode="steady" kind="focus" minutes={50} canSwap busy={false} onStart={noop} onSwap={noop} onBack={noop} />;
    case "switch":
      return <TaskPreviewScreen task={task} mode="low" kind="switch" minutes={20} canSwap busy={false} onStart={noop} onSwap={noop} onBack={noop} />;
    case "focus-low":
    case "focus-steady":
    case "focus-flow": {
      const mode = s.replace("focus-", "") as "low" | "steady" | "flow";
      return <FocusScreen mode={mode} kind="focus" title={task.title} firstStep={task.firstStep} remainingMs={1_650_000} totalMs={3_000_000} onDone={noop} onStuck={noop} onStop={noop} />;
    }
    case "checkin":
      return <CheckInScreen pitStop={false} onKeep={noop} onDone={noop} onStuck={noop} onStop={noop} />;
    case "pit":
      return <CheckInScreen pitStop onKeep={noop} onDone={noop} onStuck={noop} onStop={noop} />;
    case "break":
      return <BreakScreen idea="Read scriptures // spiritual book" note="" remainingMs={780_000} over={false} onAnother={noop} onBack={noop} onStop={noop} />;
    case "break-timer":
      return <BreakScreen idea="Xbox // Switch" note="Set a timer so it doesn't take over." remainingMs={780_000} over={false} onAnother={noop} onBack={noop} onStop={noop} />;
    case "break-over":
      return <BreakScreen idea="" note="" remainingMs={0} over onAnother={noop} onBack={noop} onStop={noop} />;
    case "done":
      return <DoneScreen title={task.title} notionFailed={false} busy={false} onNext={noop} onBreak={noop} onStop={noop} />;
    case "done-fail":
      return <DoneScreen title={task.title} notionFailed busy={false} onNext={noop} onBreak={noop} onStop={noop} />;
    case "stuck":
      return <StuckScreen busy={false} onBreak={noop} onSwitch={noop} onTalk={noop} onStop={noop} />;
    case "back":
      return <BackToTaskScreen title={task.title} minutes={{ low: 10, steady: 50, flow: 90 }} busy={false} onPick={noop} onElse={noop} onStop={noop} />;
    case "talk":
      return <TalkScreen message={stuckPrompt(task.title)} copied={null} claudeHref={claudeLink(task.title)} onCopy={noop} onBack={noop} onStop={noop} />;
    default:
      return <StartScreen minutes={{ low: 10, steady: 50, flow: 90 }} busy={false} failed={false} push={null} onPick={noop} />;
  }
}
