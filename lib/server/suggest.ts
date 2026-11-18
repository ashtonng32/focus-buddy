import type { Task } from "./notion";

export type Mode = "low" | "steady" | "flow";

export function todayString(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.APP_TIMEZONE || "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Suggestion order (no AI), by the task's Effort in Notion (Quick, Medium, Big):
 *  Low:    all the Quick tasks (then Medium, then Big only if no Quick ones are left).
 *  Steady: Quick and Medium tasks, in no set order (shuffled); Big only if nothing else is left.
 *  Flow:   the only mode with a set start: Big first, then Medium, then Quick.
 * A task with no Effort counts as Medium. Tasks in `exclude` (parked) are skipped.
 * Within a group the order is Notion's.
 */
export function orderTasks(tasks: Task[], mode: Mode, exclude: string[] = []): Task[] {
  const pool = tasks.filter((t) => !exclude.includes(t.id));
  const group = (e: "Quick" | "Medium" | "Big") => pool.filter((t) => (t.effort ?? "Medium") === e);
  const quick = group("Quick");
  const medium = group("Medium");
  const big = group("Big");
  if (mode === "low") return [...quick, ...medium, ...big];
  if (mode === "steady") return [...shuffle([...quick, ...medium]), ...big];
  return [...big, ...medium, ...quick];
}
