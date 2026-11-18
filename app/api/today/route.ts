import { NextResponse } from "next/server";
import { authedDb, unauthorized } from "@/lib/server/api";
import { fetchToday } from "@/lib/server/notion";
import { orderTasks, type Mode } from "@/lib/server/suggest";

// Today tasks from Notion, sorted by the suggestion rules for the chosen mode.
export async function GET(req: Request) {
  const db = await authedDb();
  if (!db) return unauthorized();
  const url = new URL(req.url);
  const mode = (url.searchParams.get("mode") ?? "steady") as Mode;
  const exclude = (url.searchParams.get("exclude") ?? "").split(",").filter(Boolean);
  // Parked tasks stay on Today but are skipped for a work session (the last 3 hours).
  const since = new Date(Date.now() - 3 * 60 * 60_000).toISOString();
  const { data: parked } = await db
    .from("events")
    .select("sessions(notion_task_id)")
    .eq("action", "switch")
    .gte("at", since);
  for (const row of (parked ?? []) as unknown as { sessions: { notion_task_id: string | null } | null }[]) {
    const id = row.sessions?.notion_task_id;
    if (id) exclude.push(id);
  }
  try {
    const tasks = orderTasks(await fetchToday(), mode, exclude);
    return NextResponse.json({
      tasks: tasks.map((t) => ({ id: t.id, title: t.title, firstStep: t.firstStep })),
    });
  } catch {
    // Notion unreachable: the app falls back to a generic block.
    return NextResponse.json({ tasks: [], notionDown: true });
  }
}
