// The one shape every tasks provider (Notion, Linear) speaks. The app only imports from "@/lib/server/tasks".

export type Effort = "Quick" | "Medium" | "Big";

export type Task = {
  id: string;
  title: string;
  status: string;
  effort: Effort | null;
  due: string | null; // YYYY-MM-DD (or ISO datetime)
  firstStep: string;
  parentId: string | null;
  subtaskIds: string[];
};

export type DailyNumbers = {
  mode: "Low" | "Steady" | "Flow" | null;
  focusMinutes: number;
  blocks: number;
  tasksDone: number;
  keepGoings: number;
  stuckTaps: number;
  switches: number;
  breaks: number;
  /** Task ids avoided 3+ times in the last 7 days; replaces the day's Avoided tasks. */
  avoided: string[];
};

export interface TasksProvider {
  /** Open tasks marked Today (cached for 60 seconds, cleared on every write). */
  getTodayTasks(): Promise<Task[]>;
  /** One task by id, from the Today cache when possible. */
  getTask(id: string): Promise<Task | null>;
  /** Marks the task Done, and every open subtask too. Retries once; false if any write failed. */
  markDone(id: string): Promise<boolean>;
  /** "Moved it forward" but can't finish: Waiting On, off Today, with a dated note. */
  markWaiting(id: string, note: string): Promise<boolean>;
  /** Break ideas keyed by lowercase heading (spiritual, learning, fun). */
  getBreakIdeas(): Promise<Record<string, string[]>>;
  /** Fills the day's log with Focus Buddy's numbers, creating it if missing. */
  writeDailyLog(day: string, label: string, numbers: DailyNumbers): Promise<{ id: string; created: boolean }>;
}
