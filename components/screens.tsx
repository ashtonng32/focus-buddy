import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ArrowLeft, Check, ChevronRight, Coffee, Hourglass, MessageCircleHeart, Settings, Shuffle, Sparkles } from "lucide-react";
import type { Mode, SuggestedTask } from "@/lib/app-state";
import { Blobs, Landscape, Ring } from "./art";
import { Pill, PillLink, TextButton } from "./pill";
import { MODES } from "./theme";

export function fmt(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const padTop = "pt-[max(1.25rem,env(safe-area-inset-top))]";
const padBottom = "pb-[max(1.5rem,env(safe-area-inset-bottom))]";

/** Calm light screen with soft circles behind the content. */
export function Light({ children, bg }: { children?: ReactNode; bg?: string }) {
  return (
    <div className="relative flex min-h-dvh flex-col" style={bg ? { background: bg } : undefined}>
      <Blobs />
      <main className={`relative mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-6 ${padTop} ${padBottom}`}>
        {children}
      </main>
    </div>
  );
}

/** Full-bleed gradient screen (timer, check-in, break). */
export function Immersive({
  sky,
  tone,
  children,
}: {
  sky: string;
  tone?: "low" | "steady" | "flow" | "sage" | "dawn";
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden text-white" style={{ background: sky }}>
      {tone && <Landscape tone={tone} className="pointer-events-none absolute inset-x-0 bottom-0 w-full opacity-70" />}
      <main className={`relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-6 ${padTop} ${padBottom}`}>
        {children}
      </main>
    </div>
  );
}

function Title({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h1 className={`font-display text-[2.2rem] leading-[1.12] ${className}`}>{children}</h1>;
}

/* ---------------- Start ---------------- */

export function StartScreen({
  minutes,
  onPick,
  busy,
  failed,
  push,
}: {
  minutes: Record<Mode, number>;
  onPick: (m: Mode) => void;
  busy: boolean;
  failed: boolean;
  push: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header
        className="relative overflow-hidden text-white"
        style={{ background: "linear-gradient(180deg,#2b1b6e 0%,#5b3fd0 55%,#9a7cf2 100%)" }}
      >
        <div className={`relative z-10 mx-auto w-full max-w-md px-6 pb-44 ${padTop}`}>
          <div className="flex items-center justify-between">
            <span className="font-display text-2xl">Focus Buddy</span>
            <Link
              href="/settings"
              aria-label="Settings"
              className="flex size-11 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30"
            >
              <Settings className="size-5" />
            </Link>
          </div>
          <h1 className="font-display mt-8 text-[2.5rem] leading-[1.08]">
            How are you <em>feeling</em>?
          </h1>
        </div>
        <Landscape tone="dawn" className="absolute inset-x-0 bottom-0 w-full" />
      </header>

      <section
        className={`relative -mt-8 flex-1 rounded-t-[2rem] bg-[#faf8ff] px-5 pt-7 shadow-[0_-14px_30px_-18px_rgba(60,40,140,0.55)] ${padBottom}`}
      >
        <div className="mx-auto flex max-w-md flex-col gap-3">
          <p className="px-1 text-sm text-[#6c6290]">Pick One</p>
          {(Object.keys(MODES) as Mode[]).map((mode, i) => {
            const m = MODES[mode];
            return (
              <button
                key={mode}
                disabled={busy}
                onClick={() => onPick(mode)}
                style={{ animationDelay: `${i * 70}ms` }}
                className={`rise flex w-full items-center gap-4 rounded-[1.75rem] p-4 text-left transition active:scale-[0.98] disabled:opacity-60 ${m.card}`}
              >
                <span className={`flex size-16 shrink-0 items-center justify-center rounded-full ${m.iconBg} ${m.iconFg}`}>
                  <m.Icon className="size-8" />
                </span>
                <span className="flex-1">
                  <span className="font-display block text-[1.7rem] leading-tight">{m.label}</span>
                  <span className="text-sm text-[#6c6290]">{m.hint}</span>
                </span>
                <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${m.chip}`}>{minutes[mode]} min</span>
              </button>
            );
          })}
          {failed && (
            <p className="px-1 text-center text-sm text-[#6c6290]">Can&apos;t connect right now. Check your signal and try again.</p>
          )}
          {push}
        </div>
      </section>
    </div>
  );
}

/* ---------------- Suggested task, before the timer starts ---------------- */

export function TaskPreviewScreen({
  task,
  mode,
  kind,
  minutes,
  canSwap,
  busy,
  onStart,
  onSwap,
  onBack,
}: {
  task: SuggestedTask;
  mode: Mode;
  kind: "focus" | "switch";
  minutes: number;
  canSwap: boolean;
  busy: boolean;
  onStart: () => void;
  onSwap: () => void;
  onBack: () => void;
}) {
  const m = MODES[mode];
  return (
    <Light>
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          aria-label="Back"
          className="flex size-11 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-[#e3dcf8]"
        >
          <ArrowLeft className="size-5 text-[#3d2a91]" />
        </button>
        <span className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${m.card} ${m.iconFg}`}>
          <m.Icon className="size-4" />
          {kind === "switch" ? "Okay, something else for a bit." : m.label}
        </span>
      </div>

      <div className="rise mt-6 flex flex-1 flex-col justify-center gap-6">
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#8a7fb5]">
            {kind === "switch" ? "Your other task will be waiting." : "Up next"}
          </p>
          <Title className="text-[2.5rem]">{task.title}</Title>
        </div>
        <div className="flex items-start gap-3 rounded-3xl bg-white p-5 shadow-[0_12px_30px_-20px_rgba(60,40,140,0.6)]">
          <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${m.iconBg} ${m.iconFg}`}>
            <Sparkles className="size-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8a7fb5]">First step</p>
            <p className="mt-1 text-lg">{task.firstStep}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Pill disabled={busy} onClick={onStart} className="min-h-20 text-xl">
          Start · {minutes} min
        </Pill>
        {canSwap && (
          <Pill variant="soft" onClick={onSwap}>
            <Shuffle className="size-5" /> Different task
          </Pill>
        )}
      </div>
    </Light>
  );
}

/* ---------------- Focus timer ---------------- */

export function FocusScreen({
  mode,
  kind,
  title,
  firstStep,
  remainingMs,
  totalMs,
  onDone,
  onStuck,
  onStop,
}: {
  mode: Mode;
  kind: "focus" | "switch";
  title: string;
  firstStep: string;
  remainingMs: number;
  totalMs: number;
  onDone: () => void;
  onStuck: () => void;
  onStop: () => void;
}) {
  const m = MODES[mode];
  return (
    <Immersive sky={m.sky} tone={mode}>
      <div className="flex flex-col items-center gap-3 pt-2 text-center">
        <span className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold ring-1 ring-white/25">
          <m.Icon className="size-4" />
          {kind === "switch" ? "Okay, something else for a bit." : m.label}
        </span>
        <Title className="text-[2rem]">{title}</Title>
        <p className="text-white/75">{firstStep}</p>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <Ring progress={totalMs > 0 ? remainingMs / totalMs : 0}>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Focus</span>
          <span className="mt-1 text-[4.2rem] font-light leading-none tabular-nums" aria-live="off">
            {fmt(remainingMs)}
          </span>
        </Ring>
      </div>

      <div className="flex flex-col gap-3">
        <Pill variant="light" onClick={onDone} className="min-h-20 text-xl">
          <Check className="size-6" /> Done
        </Pill>
        <Pill variant="glass" onClick={onStuck}>
          I&apos;m stuck
        </Pill>
        <TextButton tone="dark" onClick={onStop}>
          Stop for now
        </TextButton>
      </div>
    </Immersive>
  );
}

/* ---------------- Check-in ---------------- */

export function CheckInScreen({
  pitStop,
  onKeep,
  onDone,
  onStuck,
  onWaiting,
  onStop,
}: {
  pitStop: boolean;
  onKeep: () => void;
  onDone: () => void;
  onStuck: () => void;
  onWaiting: () => void;
  onStop: () => void;
}) {
  return (
    <Immersive sky="linear-gradient(180deg,#3a1d6e 0%,#a3466f 52%,#ff9b6a 100%)" tone="flow">
      <div className="rise flex flex-1 flex-col justify-center gap-5">
        <div>
          <Title className="text-[3rem]">That&apos;s time.</Title>
          <p className="font-display mt-1 text-[1.8rem] italic text-white/85">How&apos;s it going?</p>
        </div>
        {pitStop && (
          <div className="flex items-start gap-3 rounded-3xl bg-white/15 p-4 ring-1 ring-white/30 backdrop-blur">
            <Coffee className="mt-0.5 size-6 shrink-0" />
            <p>You&apos;ve been at it a while. Take 2 minutes? Grab some water, stretch, then jump back in.</p>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3">
        <Pill variant="light" onClick={onKeep} className="min-h-20 text-xl">
          Keep going
        </Pill>
        <Pill variant="glass" onClick={onDone}>
          <Check className="size-5" /> Done
        </Pill>
        <Pill variant="glass" onClick={onStuck}>
          I&apos;m stuck
        </Pill>
        <Pill variant="glass" onClick={onWaiting}>
          <Hourglass className="size-5" /> Moved it forward
        </Pill>
        <TextButton tone="dark" onClick={onStop}>
          Stop for now
        </TextButton>
      </div>
    </Immersive>
  );
}

/* ---------------- Break ---------------- */

export function BreakScreen({
  idea,
  note,
  remainingMs,
  over,
  onAnother,
  onBack,
  onStop,
}: {
  idea: string;
  note: string;
  remainingMs: number;
  over: boolean;
  onAnother: () => void;
  onBack: () => void;
  onStop: () => void;
}) {
  return (
    <Immersive sky="linear-gradient(180deg,#123d37 0%,#2f7a62 55%,#8fc79a 100%)" tone="sage">
      <div className="flex flex-1 items-center justify-center">
        <div className="relative flex size-[19rem] items-center justify-center">
          <div className="breathe absolute inset-0 rounded-full bg-white/10" />
          <div className="breathe absolute inset-7 rounded-full bg-white/10" style={{ animationDelay: "0.5s" }} />
          <div className="breathe absolute inset-14 rounded-full bg-white/15" style={{ animationDelay: "1s" }} />
          <div className="relative flex max-w-[11rem] flex-col items-center text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">
              {over ? "Break's over." : "Take a break"}
            </span>
            {over ? (
              <p className="font-display mt-2 text-3xl">Ready when you are.</p>
            ) : (
              <>
                <p className="font-display mt-2 text-[1.7rem] leading-tight">{idea}</p>
                {note && <p className="mt-2 text-sm text-white/80">{note}</p>}
                <p className="mt-3 text-3xl font-light tabular-nums">{fmt(remainingMs)}</p>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {!over && (
          <Pill variant="glass" onClick={onAnother}>
            <Shuffle className="size-5" /> Another idea
          </Pill>
        )}
        <Pill variant="light" onClick={onBack} className="min-h-20 text-xl">
          I&apos;m back
        </Pill>
        <TextButton tone="dark" onClick={onStop}>
          Stop for now
        </TextButton>
      </div>
    </Immersive>
  );
}

/* ---------------- Done ---------------- */

export function DoneScreen({
  title,
  notionFailed,
  busy,
  onNext,
  onBreak,
  onStop,
}: {
  title: string;
  notionFailed: boolean;
  busy: boolean;
  onNext: () => void;
  onBreak: () => void;
  onStop: () => void;
}) {
  return (
    <Light bg="linear-gradient(180deg,#fff3e6 0%,#fdf8f1 60%)">
      <div className="rise flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <div className="relative">
          <div className="absolute -inset-5 rounded-full bg-[#ffd9b8]/60" />
          <div className="absolute -inset-10 rounded-full bg-[#ffe7cf]/60" />
          <div
            className="relative flex size-28 items-center justify-center rounded-full text-white shadow-[0_18px_30px_-14px_rgba(180,68,27,0.7)]"
            style={{ background: "linear-gradient(135deg,#ffb27a,#f0764f)" }}
          >
            <Check className="size-14" strokeWidth={3} />
          </div>
        </div>
        <Title className="mt-8 text-[2.4rem]">Nice, that one&apos;s done. One done is a good day.</Title>
        <p className="text-[#6c6290]">&ldquo;{title}&rdquo;</p>
        {notionFailed && (
          <p className="rounded-2xl bg-[#fff0d6] px-4 py-3 text-sm text-[#7a4a00]">
            Notion didn&apos;t save that. Mark it done there when you get a sec.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-3">
        <Pill onClick={onNext} className="min-h-20 text-xl">
          What&apos;s next?
        </Pill>
        <Pill variant="soft" disabled={busy} onClick={onBreak}>
          <Coffee className="size-5" /> Take a break
        </Pill>
        <TextButton onClick={onStop}>Stop for now</TextButton>
      </div>
    </Light>
  );
}

/* ---------------- Stuck ---------------- */

function Option({
  Icon,
  card,
  iconBg,
  iconFg,
  title,
  sub,
  disabled,
  onClick,
}: {
  Icon: typeof Coffee;
  card: string;
  iconBg: string;
  iconFg: string;
  title: string;
  sub: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-[1.75rem] p-4 text-left transition active:scale-[0.98] disabled:opacity-60 ${card}`}
    >
      <span className={`flex size-14 shrink-0 items-center justify-center rounded-full ${iconBg} ${iconFg}`}>
        <Icon className="size-7" />
      </span>
      <span className="flex-1">
        <span className="font-display block text-[1.35rem] leading-tight">{title}</span>
        <span className="text-sm text-[#6c6290]">{sub}</span>
      </span>
      <ChevronRight className="size-5 text-[#8a7fb5]" />
    </button>
  );
}

export function StuckScreen({
  busy,
  onBreak,
  onSwitch,
  onTalk,
  onWaiting,
  onStop,
}: {
  busy: boolean;
  onBreak: () => void;
  onSwitch: () => void;
  onTalk: () => void;
  onWaiting?: () => void;
  onStop: () => void;
}) {
  return (
    <Light>
      <div className="rise flex flex-1 flex-col justify-center gap-6">
        <div>
          <Title className="text-[2.5rem]">What do you need?</Title>
          <p className="mt-2 text-lg text-[#6c6290]">Let&apos;s get you moving again.</p>
        </div>
        <div className="flex flex-col gap-3">
          <Option
            Icon={Coffee}
            card="bg-[#e3f4eb]"
            iconBg="bg-[#bfe5d3]"
            iconFg="text-[#1f6b55]"
            title="A break"
            sub="Step away for a few minutes."
            disabled={busy}
            onClick={onBreak}
          />
          <Option
            Icon={Shuffle}
            card="bg-[#ece6ff]"
            iconBg="bg-[#d4c8ff]"
            iconFg="text-[#4a2fb8]"
            title="Something else for a bit"
            sub="This one will be here when you come back."
            disabled={busy}
            onClick={onSwitch}
          />
          <Option
            Icon={MessageCircleHeart}
            card="bg-[#ffeadf]"
            iconBg="bg-[#ffcaae]"
            iconFg="text-[#b4441b]"
            title="Talk it through"
            sub="Talk it out with Claude."
            onClick={onTalk}
          />
          {onWaiting && (
            <Option
              Icon={Hourglass}
              card="bg-[#fff3d6]"
              iconBg="bg-[#ffe3a0]"
              iconFg="text-[#8a5a00]"
              title="Moved it forward"
              sub="I did what I could. Now I'm waiting on something."
              onClick={onWaiting}
            />
          )}
        </div>
      </div>
      <TextButton onClick={onStop}>Stop for now</TextButton>
    </Light>
  );
}

/* ---------------- Back to the task you were stuck on ---------------- */

export function BackToTaskScreen({
  title,
  minutes,
  busy,
  onPick,
  onElse,
  onStop,
}: {
  title: string;
  minutes: Record<Mode, number>;
  busy: boolean;
  onPick: (m: Mode) => void;
  onElse: () => void;
  onStop: () => void;
}) {
  return (
    <Light>
      <div className="rise flex flex-1 flex-col justify-center gap-6">
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#8a7fb5]">Back to</p>
          <Title className="text-[2.5rem]">{title}</Title>
          <p className="mt-2 text-lg text-[#6c6290]">Pick a timer and jump back in.</p>
        </div>
        <div className="flex flex-col gap-3">
          {(Object.keys(MODES) as Mode[]).map((mode) => {
            const m = MODES[mode];
            return (
              <button
                key={mode}
                disabled={busy}
                onClick={() => onPick(mode)}
                className={`flex w-full items-center gap-4 rounded-[1.75rem] p-4 text-left transition active:scale-[0.98] disabled:opacity-60 ${m.card}`}
              >
                <span className={`flex size-14 shrink-0 items-center justify-center rounded-full ${m.iconBg} ${m.iconFg}`}>
                  <m.Icon className="size-7" />
                </span>
                <span className="flex-1">
                  <span className="font-display block text-[1.5rem] leading-tight">{m.label}</span>
                  <span className="text-sm text-[#6c6290]">{m.hint}</span>
                </span>
                <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${m.chip}`}>{minutes[mode]} min</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col items-center gap-1">
        <TextButton onClick={onElse}>Pick something else</TextButton>
        <TextButton onClick={onStop}>Stop for now</TextButton>
      </div>
    </Light>
  );
}

/* ---------------- Talk it through (waiting while in the Claude app) ---------------- */

export function TalkScreen({
  message,
  copied,
  claudeHref,
  onCopy,
  onBack,
  onStop,
}: {
  message: string;
  copied: boolean | null;
  claudeHref: string;
  onCopy: () => void;
  onBack: () => void;
  onStop: () => void;
}) {
  return (
    <Light>
      <div className="rise flex flex-1 flex-col justify-center gap-5">
        <Title className="text-[2.4rem]">Talk it through</Title>
        <div className="rounded-3xl rounded-tl-md bg-white p-5 shadow-[0_12px_30px_-20px_rgba(60,40,140,0.6)]">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#8a7fb5]">Here&apos;s what I&apos;ll send Claude</p>
          <p className="text-[#3a2f66]">{message}</p>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <PillLink href={claudeHref} className="min-h-20 text-xl">
          Open Claude
        </PillLink>
        <Pill variant="soft" onClick={onCopy}>
          {copied === true ? "Copied. Paste it into Claude." : copied === false ? "Couldn't copy it. Press and hold the text instead." : "Copy message"}
        </Pill>
        <Pill variant="outline" onClick={onBack}>
          I&apos;m back
        </Pill>
        <TextButton onClick={onStop}>Stop for now</TextButton>
      </div>
    </Light>
  );
}

/* ---------------- Moved it forward (waiting) ---------------- */

export function WaitingScreen({
  title,
  busy,
  onSave,
  onCancel,
}: {
  title: string;
  busy: boolean;
  onSave: (note: string) => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState("");
  return (
    <Light>
      <div className="rise flex flex-1 flex-col justify-center gap-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#8a7fb5]">Moved forward</p>
          <Title className="text-[2.2rem]">{title}</Title>
          <p className="mt-2 text-lg text-[#6c6290]">What are you waiting on? One line is plenty.</p>
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Need my number. Call back."
          className="w-full resize-none rounded-3xl bg-white p-4 text-lg text-[#3a2f66] shadow-[0_12px_30px_-20px_rgba(60,40,140,0.6)] outline-none ring-1 ring-[#e3dcf7] focus:ring-2 focus:ring-[#5b3fd0]"
        />
        <p className="text-sm text-[#6c6290]">It moves to Waiting On and leaves your Today list. Duet will check in on it.</p>
      </div>
      <div className="flex flex-col gap-3">
        <Pill variant="light" onClick={() => onSave(note)} disabled={busy} className="min-h-20 text-xl">
          Save and move on
        </Pill>
        <TextButton onClick={onCancel}>Never mind</TextButton>
      </div>
    </Light>
  );
}
