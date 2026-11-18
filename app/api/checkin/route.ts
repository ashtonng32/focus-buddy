import { NextResponse } from "next/server";
import { authedDb, loadSettings, unauthorized, type SessionRow } from "@/lib/server/api";
import { markTaskDone } from "@/lib/server/notion";

type Action = "keep_going" | "done" | "stuck" | "back";

// Answer a check-in, from the app or from the notification buttons.
// Safe to call twice: it only acts on a session that is still running.
export async function POST(req: Request) {
  const db = await authedDb();
  if (!db) return unauthorized();
  const { sessionId, action } = (await req.json()) as { sessionId?: string; action: Action };
  if (!["keep_going", "done", "stuck", "back"].includes(action)) {
    return NextResponse.json({ error: "bad action" }, { status: 400 });
  }

  let q = db.from("sessions").select("*").eq("status", "running");
  if (sessionId) q = q.eq("id", sessionId);
  const { data } = await q.maybeSingle();
  const session = data as SessionRow | null;
  if (!session) return NextResponse.json({ ok: true, ignored: true });

  let notionFailed = false;

  if (action === "keep_going") {
    const settings = await loadSettings(db);
    const now = Date.now();
    await db
      .from("sessions")
      .update({
        started_at: new Date(now).toISOString(),
        ends_at: new Date(now + Number(settings.keepgoing_min) * 60_000).toISOString(),
        notified_at: null,
        // Total focus so far: what this block just ran, added to earlier Keep going blocks.
        focus_total_ms:
          Number(session.focus_total_ms) + (new Date(session.ends_at).getTime() - new Date(session.started_at).getTime()),
      })
      .eq("id", session.id);
  } else if (action === "back") {
    // "I'm back" ends a break; nothing further to handle.
    await db.from("sessions").update({ status: "done", handled_at: new Date().toISOString() }).eq("id", session.id);
    // A break that began from "I'm stuck": offer to go back to that task.
    if (session.from_session_id) {
      await db
        .from("sessions")
        .update({ resume_pending: true })
        .eq("id", session.from_session_id)
        .eq("status", "stuck")
        .not("notion_task_id", "is", null);
    }
  } else if (action === "done") {
    if (session.notion_task_id) notionFailed = !(await markTaskDone(session.notion_task_id));
    await db.from("sessions").update({ status: "done", notion_failed: notionFailed }).eq("id", session.id);
  } else {
    await db.from("sessions").update({ status: "stuck" }).eq("id", session.id);
  }

  if (action !== "back") await db.from("events").insert({ session_id: session.id, action });
  return NextResponse.json({ ok: true, notionFailed });
}
