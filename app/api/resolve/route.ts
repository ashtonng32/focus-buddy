import { NextResponse } from "next/server";
import { authedDb, unauthorized } from "@/lib/server/api";

// Follow-up to a finished block: "talk" (opened the Claude app, paused until "I'm back")
// or "handled" (moved on to pick a mode).
export async function POST(req: Request) {
  const db = await authedDb();
  if (!db) return unauthorized();
  const { sessionId, action } = (await req.json()) as { sessionId: string; action: "talk" | "handled" | "back" };
  if (!sessionId || !["talk", "handled", "back"].includes(action)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (action === "talk") {
    await db.from("events").insert({ session_id: sessionId, action: "talk" });
  } else if (action === "back") {
    // Back from the Claude app: done with the follow-up, and offer to return to the stuck task.
    await db
      .from("sessions")
      .update({ handled_at: new Date().toISOString(), resume_pending: true })
      .eq("id", sessionId)
      .not("notion_task_id", "is", null);
    await db.from("sessions").update({ handled_at: new Date().toISOString() }).eq("id", sessionId).is("notion_task_id", null);
  } else {
    await db.from("sessions").update({ handled_at: new Date().toISOString(), resume_pending: false }).eq("id", sessionId);
  }
  return NextResponse.json({ ok: true });
}
