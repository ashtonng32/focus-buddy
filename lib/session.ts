"use client";

import { useSyncExternalStore } from "react";

export type Mode = "low" | "steady" | "flow";

// Slice 1: the running block lives in this browser. Slice 2 moves it to Supabase (ends_at).
export type LocalSession = {
  mode: Mode;
  startedAt: number;
  endsAt: number;
  taskTitle: string;
  firstStep: string;
};

const KEY = "fb.session";
let raw: string | null | undefined;
const listeners = new Set<() => void>();

function snapshot(): string | null {
  if (raw === undefined) {
    try {
      raw = localStorage.getItem(KEY);
    } catch {
      raw = null;
    }
  }
  return raw;
}

export function setSession(s: LocalSession | null) {
  raw = s ? JSON.stringify(s) : null;
  try {
    if (raw) localStorage.setItem(KEY, raw);
    else localStorage.removeItem(KEY);
  } catch {}
  listeners.forEach((l) => l());
}

export function useSession(): LocalSession | null | undefined {
  const s = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    snapshot,
    () => undefined as unknown as string | null,
  );
  if (s === undefined) return undefined; // not hydrated yet
  return s ? (JSON.parse(s) as LocalSession) : null;
}

export function startSession(mode: Mode, minutes: number) {
  const startedAt = Date.now();
  setSession({
    mode,
    startedAt,
    endsAt: startedAt + minutes * 60_000,
    // Slice 3 replaces this with a real Notion Today task.
    taskTitle: "Your next thing",
    firstStep: "Just open it.",
  });
}

export function restartSession(s: LocalSession, minutes: number) {
  const startedAt = Date.now();
  setSession({ ...s, startedAt, endsAt: startedAt + minutes * 60_000 });
}
