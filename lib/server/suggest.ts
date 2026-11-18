import type { Priority, Task } from "./notion";

export type Mode = "low" | "steady" | "flow";

export function todayString(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.APP_TIMEZONE || "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

const rank = (p: Priority | null) => (p === "Low" ? 0 : p === "High" ? 2 : 1);

/**
 * Suggestion order (no AI):
 *  Low: a task already in Doing (momentum), else a subtask, else lowest priority first.
 *  Steady/Flow: overdue or due today, then High priority, then the rest.
 * Tasks in `exclude` (parked this session) are skipped. Sort is stable, so Notion order breaks ties.
 */
export function orderTasks(tasks: Task[], mode: Mode, exclude: string[] = [], today = todayString()): Task[] {
  const pool = tasks.filter((t) => !exclude.includes(t.id));
  const tier = (t: Task): number => {
    if (mode === "low") {
      if (t.status === "Doing") return 0;
      if (t.parentId) return 1;
      return 2;
    }
    if (t.due && t.due.slice(0, 10) <= today) return 0;
    if (t.priority === "High") return 1;
    return 2;
  };
  return pool
    .map((t, i) => ({ t, i }))
    .sort((a, b) => {
      const d = tier(a.t) - tier(b.t);
      if (d) return d;
      if (mode === "low" && tier(a.t) === 2) {
        const r = rank(a.t.priority) - rank(b.t.priority);
        if (r) return r;
      }
      if (mode !== "low" && tier(a.t) === 0) {
        const r = (a.t.due ?? "").localeCompare(b.t.due ?? "");
        if (r) return r;
      }
      if (mode !== "low" && tier(a.t) === 2) {
        const r = rank(b.t.priority) - rank(a.t.priority);
        if (r) return r;
      }
      return a.i - b.i;
    })
    .map((x) => x.t);
}
