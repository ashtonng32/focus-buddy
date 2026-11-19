import { getBreakIdeas } from "./tasks";
import type { Mode } from "./suggest";

const MOVEMENT = /workout|walk|bike|stretch|run|yoga|exercise/i;
const TIMER = /xbox|switch|show/i;

export const TIMER_LINE = "Set a timer so it doesn't take over.";

function pick<T>(list: T[]): T | undefined {
  return list[Math.floor(Math.random() * list.length)];
}

function section(lists: Record<string, string[]>, name: string) {
  const key = Object.keys(lists).find((k) => k.includes(name));
  return key ? lists[key] : [];
}

/**
 * Break suggestion: Low -> Spiritual. Steady -> Learning or Fun. Flow -> Fun, movement first.
 * Re-reads the Notion page every time, so new ideas show up without code changes.
 * `current` is skipped on "Another idea"; the first pick for Flow favors movement.
 */
export async function pickBreak(mode: Mode, current?: string) {
  const lists = await getBreakIdeas();
  const spiritual = section(lists, "spiritual");
  const learning = section(lists, "learning");
  const fun = section(lists, "fun");

  let pool = mode === "low" ? spiritual : mode === "steady" ? [...learning, ...fun] : fun;
  if (mode === "flow" && !current) {
    const movement = fun.filter((i) => MOVEMENT.test(i));
    if (movement.length) pool = movement;
  }
  const options = pool.filter((i) => i !== current);
  const idea = pick(options.length ? options : pool) ?? "Step away from the screen for a bit.";
  return { idea, firstStep: TIMER.test(idea) ? TIMER_LINE : "" };
}
