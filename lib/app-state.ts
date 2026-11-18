"use client";

import { useCallback, useEffect, useState } from "react";

export type Mode = "low" | "steady" | "flow";

export type Settings = {
  low: number;
  steady: number;
  flow: number;
  keepGoing: number;
  break: number;
  switch: number;
};

export type Session = {
  id: string;
  mode: Mode | null;
  taskTitle: string;
  firstStep: string;
  startedAt: number;
  endsAt: number;
};

// Minutes. PRD defaults, used until the server answers.
export const DEFAULTS: Settings = { low: 10, steady: 50, flow: 90, keepGoing: 30, break: 15, switch: 20 };

type State = {
  ready: boolean;
  failed: boolean;
  session: Session | null;
  settings: Settings;
  /** serverNow - Date.now(): add to Date.now() to get server time. */
  offset: number;
};

async function post(path: string, body?: unknown, method = "POST") {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
}

/** The server owns the timer; this mirrors it and refreshes when the app regains focus. */
export function useAppState() {
  const [state, setState] = useState<State>({
    ready: false,
    failed: false,
    session: null,
    settings: DEFAULTS,
    offset: 0,
  });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const j = await res.json();
      setState({
        ready: true,
        failed: false,
        session: j.session,
        settings: j.settings,
        offset: j.serverNow - Date.now(),
      });
    } catch {
      setState((s) => ({ ...s, ready: true, failed: true }));
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    const onMessage = (e: MessageEvent) => e.data?.type === "refresh" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", onVisible);
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      clearTimeout(first);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onVisible);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [refresh]);

  const act = useCallback(
    async (fn: () => Promise<void>) => {
      try {
        await fn();
      } finally {
        await refresh();
      }
    },
    [refresh],
  );

  return {
    ...state,
    refresh,
    start: (mode: Mode) => act(() => post("/api/session", { mode })),
    checkin: (action: "keep_going" | "done" | "stuck") =>
      act(() => post("/api/checkin", { sessionId: state.session?.id, action })),
    stop: () => act(() => post("/api/stop")),
    saveSettings: (s: Settings) => act(() => post("/api/settings", s, "PUT")),
  };
}
