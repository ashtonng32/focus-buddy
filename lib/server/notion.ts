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
  // First step: the task's "First Step" field if filled, else the first line of Notes, else a nudge.
  const firstLine = (rt: any[] | undefined) => plain(rt).split("\n")[0].trim();
  const firstStep = firstLine(p["First Step"]?.rich_text) || firstLine(p.Notes?.rich_text);
  return {
    id: page.id,
    title: plain(p.Task?.title).trim() || "Untitled",
    status: p.Status?.status?.name ?? "",
    effort: p.Effort?.select?.name ?? null,
    due: p.Due?.date?.start ?? null,
    firstStep: firstStep || "Just open it.",
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

/** Creates one Work Log entry (Logged By = Focus Buddy). Returns the new page id. */
export async function createWorkLog(entry: { title: string; date: string; whatGotDone: string }): Promise<string> {
  const res = await notion<any>("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { type: "data_source_id", data_source_id: process.env.NOTION_WORKLOG_DS },
      properties: {
        Entry: { title: [{ text: { content: entry.title } }] },
        Date: { date: { start: entry.date } },
        "Logged By": { select: { name: "Focus Buddy" } },
        "What Got Done": { rich_text: [{ text: { content: entry.whatGotDone.slice(0, 1900) } }] },
      },
    }),
  });
  return res.id as string;
}
