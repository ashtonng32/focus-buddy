"use client";

import { useSyncExternalStore } from "react";

export type Settings = {
  low: number;
  steady: number;
  flow: number;
  keepGoing: number;
  break: number;
  switch: number;
};

// Minutes. PRD defaults. (Slice 2 moves these into Supabase.)
export const DEFAULTS: Settings = { low: 10, steady: 50, flow: 90, keepGoing: 30, break: 15, switch: 20 };

const KEY = "fb.settings";
let cache: Settings | null = null;
const listeners = new Set<() => void>();

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function getSettings(): Settings {
  return (cache ??= read());
}

export function saveSettings(s: Settings) {
  cache = s;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
  listeners.forEach((l) => l());
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getSettings,
    () => DEFAULTS,
  );
}
