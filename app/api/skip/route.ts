import { NextResponse } from "next/server";
import { authedDb, unauthorized } from "@/lib/server/api";

// Records that a suggested task was swapped away before its timer started. Browsing through the
// suggestions in one sitting counts once: a repeat within 10 minutes is ignored.
export async function POST(req: Request) {
  const db = await authedDb();
  if (!db) return unauthorized();
  const { taskId, title } = (await req.json()) as { taskId?: string; title?: string };
  if (!taskId) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: recent } = await db
    .from("task_skips")
    .select("id")
    .eq("notion_task_id", taskId)
    .gte("at", since)
    .limit(1);
  if (!recent?.length) {
    await db.from("task_skips").insert({ notion_task_id: taskId, task_title: (title ?? "").slice(0, 200) || "Untitled" });
  }
  return NextResponse.json({ ok: true });
}
