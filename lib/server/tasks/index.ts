// The only tasks entry point for the app. TASKS_PROVIDER picks the backend ("notion" | "linear");
// it defaults to "notion" so nothing changes until it is flipped on purpose.
import { linearProvider } from "./linear";
import { notionProvider } from "./notion";
import type { TasksProvider } from "./types";

export type { DailyNumbers, Effort, Task, TasksProvider } from "./types";

/** Which app the tasks live in, for on-screen copy ("Linear didn't save that..."). */
export function tasksAppName(): "Notion" | "Linear" {
  return (process.env.TASKS_PROVIDER || "notion").trim().toLowerCase() === "linear" ? "Linear" : "Notion";
}

/** Only the Notion Daily Log has an Avoided tasks field; the Linear log line does not. */
export const supportsAvoided = () => tasksAppName() === "Notion";

function resolveProvider(): TasksProvider {
  const name = (process.env.TASKS_PROVIDER || "notion").trim().toLowerCase();
  if (name === "notion") return notionProvider;
  if (name === "linear") return linearProvider;
  throw new Error(`Unknown TASKS_PROVIDER "${name}". Use "notion" or "linear".`);
}

// Resolved per call so a bad value fails loudly where it is used, not at import time.
export const getTodayTasks: TasksProvider["getTodayTasks"] = () => resolveProvider().getTodayTasks();
export const getTask: TasksProvider["getTask"] = (id) => resolveProvider().getTask(id);
export const markDone: TasksProvider["markDone"] = (id) => resolveProvider().markDone(id);
export const markWaiting: TasksProvider["markWaiting"] = (id, note) => resolveProvider().markWaiting(id, note);
export const getBreakIdeas: TasksProvider["getBreakIdeas"] = () => resolveProvider().getBreakIdeas();
export const writeDailyLog: TasksProvider["writeDailyLog"] = (day, label, n) => resolveProvider().writeDailyLog(day, label, n);
