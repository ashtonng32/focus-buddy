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
