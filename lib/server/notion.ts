// Thin Notion client (plain fetch). Notion stays the source of truth for tasks and breaks;
// Focus Buddy only reads Today and writes back Done.
const API = "https://api.notion.com/v1";
const VERSION = "2025-09-03"; // the API version that supports data sources

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

async function notion<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API + path, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
      "Notion-Version": VERSION,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) throw new Error(`Notion ${res.status} ${path}`);
  return res.json() as Promise<T>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function parseTask(page: any): Task {
  const p = page.properties;
  const plain = (rt: any[] | undefined) => (rt ?? []).map((x) => x.plain_text).join("");
  // First step: the task's "First Step" (or "First Steps") field if filled, else the first line of Notes, else a nudge.
  const firstLine = (rt: any[] | undefined) => plain(rt).split("\n")[0].trim();
  const firstStep =
    firstLine(p["First Step"]?.rich_text) || firstLine(p["First Steps"]?.rich_text) || firstLine(p.Notes?.rich_text);
  return {
    id: page.id,
    title: plain(p.Task?.title).trim() || "Untitled",
    status: p.Status?.status?.name ?? "",
    effort: p.Effort?.select?.name ?? null,
    due: p.Due?.date?.start ?? null,
    firstStep: firstStep || "Just open it. That's the whole first step.",
    parentId: p["Parent Task"]?.relation?.[0]?.id ?? null,
    subtaskIds: (p.Subtasks?.relation ?? []).map((r: any) => r.id),
  };
}

// Cache Today for 60 seconds (Notion rate limits); cleared whenever we write.
let cache: { at: number; tasks: Task[] } | null = null;

export async function fetchToday(): Promise<Task[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.tasks;
  const tasks: Task[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion<any>(`/data_sources/${process.env.NOTION_TASKS_DS}/query`, {
      method: "POST",
      body: JSON.stringify({
        filter: {
          and: [
            { property: "Today", checkbox: { equals: true } },
            { property: "Status", status: { does_not_equal: "Done" } },
          ],
        },
        page_size: 100,
        start_cursor: cursor,
      }),
    });
    tasks.push(...res.results.map(parseTask));
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  cache = { at: Date.now(), tasks };
  return tasks;
}

export async function getTask(id: string): Promise<Task | null> {
  const cached = (await fetchToday().catch(() => [])).find((t) => t.id === id);
  if (cached) return cached;
  try {
    return parseTask(await notion<any>(`/pages/${id}`));
  } catch {
    return null;
  }
}

async function setDone(id: string) {
  const body = JSON.stringify({ properties: { Status: { status: { name: "Done" } } } });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await notion(`/pages/${id}`, { method: "PATCH", body });
      return true;
    } catch {
      /* retry once, then give up */
    }
  }
  return false;
}

/** Marks the task Done, and every subtask too when it is a parent. Returns false if any write failed. */
export async function markTaskDone(id: string): Promise<boolean> {
  const task = await getTask(id);
  const ids = [id, ...(task?.subtaskIds ?? [])];
  let ok = true;
  for (const pageId of ids) ok = (await setDone(pageId)) && ok;
  cache = null;
  return ok;
}

type Block = { id: string; type: string; has_children: boolean; [k: string]: any };

async function children(id: string): Promise<Block[]> {
  const out: Block[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion<any>(`/blocks/${id}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`);
    out.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return out;
}

const text = (b: Block) => ((b[b.type]?.rich_text ?? []) as any[]).map((x) => x.plain_text).join("").trim();

/** Reads the Ideas For A Break page: headings (Spiritual, Learning, Fun) over bullet lists, even inside columns. */
export async function fetchBreakLists(): Promise<Record<string, string[]>> {
  const lists: Record<string, string[]> = {};
  let current: string | null = null;
  async function walk(id: string) {
    for (const b of await children(id)) {
      if (b.type.startsWith("heading_")) {
        current = text(b).toLowerCase();
        lists[current] ??= [];
      } else if (b.type === "bulleted_list_item" && current) {
        const t = text(b);
        if (t) lists[current].push(t);
      } else if (b.has_children && (b.type === "column_list" || b.type === "column")) {
        await walk(b.id);
      }
    }
  }
  await walk(process.env.NOTION_BREAKS_PAGE!);
  return lists;
}

export type DailyNumbers = {
  mode: "Low" | "Steady" | "Flow" | null;
  focusMinutes: number;
  blocks: number;
  tasksDone: number;
  keepGoings: number;
  stuckTaps: number;
  switches: number;
  breaks: number;
  /** Notion page ids of tasks avoided 3+ times in the last 7 days; replaces the row's Avoided tasks. */
  avoided: string[];
};

/**
 * Fills in the Daily Log row for `day` (YYYY-MM-DD) with Focus Buddy's numbers. Duet may already
 * have created the row the night before (Date, Day, Day type); if so only the numbers are written,
 * otherwise a new row is created. Never touches Day type, Day feel, Sleep or Journal.
 */
export async function upsertDailyLog(day: string, label: string, n: DailyNumbers): Promise<{ id: string; created: boolean }> {
  const ds = process.env.NOTION_DAILYLOG_DS;
  const found = await notion<any>(`/data_sources/${ds}/query`, {
    method: "POST",
    body: JSON.stringify({ filter: { property: "Day", date: { equals: day } }, page_size: 1 }),
  });
  const numbers: Record<string, any> = {
    "Focus minutes": { number: n.focusMinutes },
    Blocks: { number: n.blocks },
    "Tasks done": { number: n.tasksDone },
    "Keep goings": { number: n.keepGoings },
    "Stuck taps": { number: n.stuckTaps },
    Switches: { number: n.switches },
    Breaks: { number: n.breaks },
    "Avoided tasks": { relation: n.avoided.map((id) => ({ id })) },
  };
  // The first mode of the day is recorded once; later runs keep it.
  const existing = found.results[0];
  const hasMode = !!existing?.properties?.Mode?.select;
  if (n.mode && !hasMode) numbers.Mode = { select: { name: n.mode } };

  if (existing) {
    await notion(`/pages/${existing.id}`, { method: "PATCH", body: JSON.stringify({ properties: numbers }) });
    return { id: existing.id as string, created: false };
  }
  const res = await notion<any>("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { type: "data_source_id", data_source_id: ds },
      properties: {
        Date: { title: [{ text: { content: label } }] },
        Day: { date: { start: day } },
        ...numbers,
      },
    }),
  });
  return { id: res.id as string, created: true };
}

/** "Moved it forward" but can't finish: Waiting On, off Today, with a dated note added to Notes. */
export async function markTaskWaiting(id: string, note: string): Promise<boolean> {
  try {
    const page = await notion<any>(`/pages/${id}`);
    const existing = ((page.properties.Notes?.rich_text ?? []) as any[]).map((x) => x.plain_text).join("");
    const stamp = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Denver" });
    const line = `Waiting (${stamp}): ${note.trim() || "moved forward, can't finish yet"}`;
    const notes = (existing ? existing + "\n" : "") + line;
    await notion(`/pages/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        properties: {
          Status: { status: { name: "Waiting On" } },
          Today: { checkbox: false },
          Notes: { rich_text: [{ type: "text", text: { content: notes.slice(-1900) } }] },
        },
      }),
    });
    cache = null;
    return true;
  } catch {
    return false;
  }
}
