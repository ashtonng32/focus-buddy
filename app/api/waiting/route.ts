import { NextResponse } from "next/server";
import { authedDb, unauthorized, type SessionRow } from "@/lib/server/api";
import { markWaiting } from "@/lib/server/tasks";

// "Moved it forward": the task can't be finished yet. It goes off Today with a note
// (Notion: Waiting On; Linear: a comment), and this block ends without counting as done.
export async function POST(req: Request) {
  const db = await authedDb();
  if (!db) return unauthorized();
  const { sessionId, note } = (await req.json()) as { sessionId?: string; note?: string };
  if (!sessionId) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const { data } = await db.from("sessions").select("*").eq("id", sessionId).in("status", ["running", "stuck"]).maybeSingle();
  const session = data as SessionRow | null;
  if (!session) return NextResponse.json({ ok: true, ignored: true });

  let notionFailed = false;
  if (session.notion_task_id) notionFailed = !(await markWaiting(session.notion_task_id, note ?? ""));

  await db
    .from("sessions")
    .update({ status: "stopped", handled_at: new Date().toISOString(), resume_pending: false, notion_failed: notionFailed })
    .eq("id", session.id);
  await db.from("events").insert({ session_id: session.id, action: "waiting" });
  return NextResponse.json({ ok: true, notionFailed });
}
