// Linear implementation of TasksProvider, built on the official @linear/sdk. The API key stays server-side.
// Reads: Today tasks, one task, break ideas. Writes: Done (with sub-issues), Waiting On (comment), Daily Log line.
import { LinearClient } from "@linear/sdk";
import type { DailyNumbers, Effort, Task, TasksProvider } from "./types";

const NUDGE = "Just open it. That's the whole first step.";
const OPEN_STATE_TYPES = ["backlog", "unstarted", "started"];

let client: LinearClient | null = null;
function linear() {
  if (!process.env.LINEAR_API_KEY) throw new Error("LINEAR_API_KEY is not set");
  return (client ??= new LinearClient({ apiKey: process.env.LINEAR_API_KEY }));
}

function need(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

type IssueNode = {
  id: string;
  title: string;
  description: string | null;
  estimate: number | null;
  dueDate: string | null;
  state: { name: string };
  parent: { id: string } | null;
  project: { name: string } | null;
  children: { nodes: { id: string; completedAt: string | null; canceledAt: string | null }[] };
};

const ISSUE_FIELDS = `
  id title description estimate dueDate
  state { name }
  parent { id }
  project { name }
  children { nodes { id completedAt canceledAt } }
`;

/** Estimates are numbers: 2 = S (Quick), 3 = M (Medium), 5 = L (Big). No estimate = treat as Medium. */
function effortOf(estimate: number | null): Effort | null {
  if (estimate == null) return null;
  if (estimate <= 2) return "Quick";
  if (estimate >= 5) return "Big";
  return "Medium";
}

/** First line of the description, with markdown list/heading/checkbox marks stripped. */
function firstStepOf(description: string | null): string {
  const line = (description ?? "").split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  return line.replace(/^(#{1,6}\s+|[-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+)/, "").trim();
}

/** Projects whose issues are for AI agents, never for Ashton. Override with LINEAR_EXCLUDE_PROJECTS (comma-separated). */
const hiddenProjects = () =>
  (process.env.LINEAR_EXCLUDE_PROJECTS ?? "AI Agents")
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);

const isHidden = (i: IssueNode) => Boolean(i.project && hiddenProjects().includes(i.project.name.trim().toLowerCase()));

function parseIssue(i: IssueNode): Task {
  return {
    id: i.id,
    title: i.title.trim() || "Untitled",
    status: i.state.name,
    effort: effortOf(i.estimate),
    due: i.dueDate,
    firstStep: firstStepOf(i.description) || NUDGE,
    parentId: i.parent?.id ?? null,
    // Open sub-issues only: the L3 Done step closes whatever is not completed or canceled.
    subtaskIds: i.children.nodes.filter((c) => !c.completedAt && !c.canceledAt).map((c) => c.id),
  };
}

// Cache Today for 60 seconds; cleared whenever we write.
let cache: { at: number; tasks: Task[] } | null = null;

async function fetchToday(): Promise<Task[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.tasks;
  const filter = {
    team: { id: { eq: need("LINEAR_TEAM_ID") } },
    labels: { id: { eq: need("LINEAR_TODAY_LABEL_ID") } },
    // A parked ("waiting") issue simply loses its Today label, so no extra state filter is needed.
    state: { type: { in: OPEN_STATE_TYPES } },
  };
  const tasks: Task[] = [];
  let after: string | null = null;
  do {
    const data: { issues: { nodes: IssueNode[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } } =
      await linear().client.request(
        `query Today($filter: IssueFilter, $after: String) {
          issues(filter: $filter, first: 100, after: $after) {
            nodes { ${ISSUE_FIELDS} }
            pageInfo { hasNextPage endCursor }
          }
        }`,
        { filter, after },
      );
    tasks.push(...data.issues.nodes.filter((i) => !isHidden(i)).map(parseIssue));
    after = data.issues.pageInfo.hasNextPage ? data.issues.pageInfo.endCursor : null;
  } while (after);
  cache = { at: Date.now(), tasks };
  return tasks;
}

async function getTask(id: string): Promise<Task | null> {
  const cached = (await fetchToday().catch(() => [])).find((t) => t.id === id);
  if (cached) return cached;
  try {
    const data: { issue: IssueNode | null } = await linear().client.request(
      `query One($id: String!) { issue(id: $id) { ${ISSUE_FIELDS} } }`,
      { id },
    );
    return data.issue ? parseIssue(data.issue) : null; // lookup by id still works for hidden projects
  } catch {
    return null;
  }
}

/**
 * Splits the Ideas For A Break document by its `## Heading` lines (Spiritual, Learning, Fun) and
 * collects the bullet items under each. Keys are lowercase headings, same as the Notion provider.
 */
export function parseBreakIdeas(markdown: string): Record<string, string[]> {
  const lists: Record<string, string[]> = {};
  let current: string | null = null;
  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    const heading = line.match(/^#{1,6}\s+(.+?)\s*#*$/);
    if (heading) {
      current = heading[1].replace(/[*_`]/g, "").trim().toLowerCase();
      lists[current] ??= [];
      continue;
    }
    const bullet = line.match(/^[-*+]\s+(?:\[[ xX]\]\s+)?(.+)$/);
    if (bullet && current) {
      const idea = bullet[1].replace(/\\([_*`])/g, "$1").trim();
      if (idea) lists[current].push(idea);
    }
  }
  return lists;
}

async function getBreakIdeas(): Promise<Record<string, string[]>> {
  const data: { document: { content: string | null } | null } = await linear().client.request(
    `query Doc($id: String!) { document(id: $id) { content } }`,
    { id: need("LINEAR_BREAKS_DOC_ID") },
  );
  if (!data.document) throw new Error("Ideas For A Break document not found");
  return parseBreakIdeas(data.document.content ?? "");
}

/* ---------------- Writes ---------------- */

async function mutate(query: string, variables: Record<string, unknown>) {
  await linear().client.request(query, variables);
}

/** Runs a write, retrying once. Returns false if both attempts fail. */
async function withRetry(fn: () => Promise<void>): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await fn();
      return true;
    } catch {
      /* retry once, then give up */
    }
  }
  return false;
}

const setState = (id: string, stateId: string) =>
  mutate(`mutation($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success } }`, {
    id,
    input: { stateId },
  });

/** Marks the issue Done, and every open sub-issue too when it is a parent. Returns false if any write failed. */
async function markDone(id: string): Promise<boolean> {
  const doneId = need("LINEAR_DONE_STATE_ID");
  const task = await getTask(id);
  const ids = [id, ...(task?.subtaskIds ?? [])];
  let ok = true;
  for (const issueId of ids) ok = (await withRetry(() => setState(issueId, doneId))) && ok;
  cache = null;
  return ok;
}

/** "Moved it forward" but can't finish: off Today, with a dated comment saying why. The status is unchanged. */
async function markWaiting(id: string, note: string): Promise<boolean> {
  const stamp = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Denver" });
  const body = `Waiting (${stamp}): ${note.trim() || "moved forward, can't finish yet"}`;
  const commented = await withRetry(() =>
    mutate(`mutation($input: CommentCreateInput!) { commentCreate(input: $input) { success } }`, {
      input: { issueId: id, body },
    }),
  );
  const unlabeled = await withRetry(() =>
    mutate(`mutation($id: String!, $labelId: String!) { issueRemoveLabel(id: $id, labelId: $labelId) { success } }`, {
      id,
      labelId: need("LINEAR_TODAY_LABEL_ID"),
    }),
  );
  cache = null;
  return commented && unlabeled;
}

/* ---------------- Daily Log ---------------- */

// One line per day, keys never renamed, newest on top. The app owns Mode through Breaks; Duet owns Type, Sleep, Day, Note.
const LOG_KEYS = ["Type", "Mode", "Focus", "Blocks", "Done", "Stuck", "Switches", "Breaks", "Sleep", "Day", "Note"];
const BLANK = "—";
const MODE_WORDS = { Low: "Low", Steady: "Motivated", Flow: "Flow" } as const; // Steady is shown as "Motivated"

/** The app's keys for a day, as log text. Mode is left out when no block has started yet. */
function appValues(n: DailyNumbers): Record<string, string> {
  const v: Record<string, string> = {
    Focus: `${n.focusMinutes}m`,
    Blocks: String(n.blocks),
    Done: String(n.tasksDone),
    Stuck: String(n.stuckTaps),
    Switches: String(n.switches),
    Breaks: String(n.breaks),
  };
  if (n.mode) v.Mode = MODE_WORDS[n.mode];
  return v;
}

const SEP = " · ";
const dateOf = (line: string) => line.trim().match(/^(\d{4}-\d{2}-\d{2})\b/)?.[1];

/**
 * Updates one day's line, touching only the app's keys. Tolerant: the line is matched by its date and keys
 * by name; anything it can't read is kept as it was. Returns the new line.
 */
export function updateLogLine(line: string, values: Record<string, string>): string {
  const parts = line.trim().split(SEP);
  const head = parts.shift() ?? "";
  const kept = new Map<string, string>();
  const extra: string[] = [];
  for (const part of parts) {
    const m = part.match(/^([A-Za-z]+):\s?(.*)$/);
    if (m && LOG_KEYS.includes(m[1])) kept.set(m[1], m[2]);
    else extra.push(part); // unreadable: keep it where we can
  }
  for (const [key, value] of Object.entries(values)) {
    // The day's first mode is recorded once; later runs keep it.
    if (key === "Mode" && kept.has("Mode") && kept.get("Mode") !== BLANK) continue;
    kept.set(key, value);
  }
  const ordered = LOG_KEYS.map((k) => `${k}: ${kept.get(k) ?? BLANK}`);
  return [head, ...ordered, ...extra].join(SEP);
}

function newLogLine(day: string, values: Record<string, string>) {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" }).format(new Date(`${day}T12:00:00Z`));
  return updateLogLine(`${day} (${weekday})`, values);
}

/** Puts the day's numbers on its line in the Daily Log document, creating the line (newest on top) if missing. */
async function writeDailyLog(day: string, _label: string, n: DailyNumbers): Promise<{ id: string; created: boolean }> {
  const id = need("LINEAR_DAILY_LOG_DOC_ID");
  // Re-read right before writing so Duet's keys (and anything hand-edited) are kept.
  const data: { document: { content: string | null } | null } = await linear().client.request(
    `query Doc($id: String!) { document(id: $id) { content } }`,
    { id },
  );
  if (!data.document) throw new Error("Daily Log document not found");
  const lines = (data.document.content ?? "").split("\n");
  const values = appValues(n);

  let created = false;
  const at = lines.findIndex((l) => dateOf(l) === day);
  if (at >= 0) {
    lines[at] = updateLogLine(lines[at], values);
  } else {
    created = true;
    const firstDated = lines.findIndex((l) => dateOf(l));
    const line = newLogLine(day, values);
    if (firstDated >= 0) lines.splice(firstDated, 0, line, "");
    else lines.push("", line);
  }
  await mutate(`mutation($id: String!, $input: DocumentUpdateInput!) { documentUpdate(id: $id, input: $input) { success } }`, {
    id,
    input: { content: lines.join("\n") },
  });
  return { id, created };
}

export const linearProvider: TasksProvider = {
  getTodayTasks: fetchToday,
  getTask,
  markDone,
  markWaiting,
  getBreakIdeas,
  writeDailyLog,
};
