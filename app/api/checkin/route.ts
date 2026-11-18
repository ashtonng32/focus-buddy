import { NextResponse } from "next/server";
import { authedDb, loadSettings, unauthorized } from "@/lib/server/api";

type Action = "keep_going" | "done" | "stuck";

// Answer a check-in, from the app or from the notification buttons.
// Safe to call twice: it only acts on a session that is still running.
export async function POST(req: Request) {
  const db = await authedDb();
  if (!db) return unauthorized();
  const { sessionId, action } = (await req.json()) as { sessionId?: string; action: Action };
  if (!["keep_going", "done", "stuck"].includes(action)) {
    return NextResponse.json({ error: "bad action" }, { status: 400 });
  }

  let q = db.from("sessions").select("id").eq("status", "running");
  if (sessionId) q = q.eq("id", sessionId);
  const { data: session } = await q.maybeSingle();
  if (!session) return NextResponse.json({ ok: true, ignored: true });

  if (action === "keep_going") {
    const settings = await loadSettings(db);
    const now = Date.now();
    await db
      .from("sessions")
      .update({
        started_at: new Date(now).toISOString(),
        ends_at: new Date(now + Number(settings.keepgoing_min) * 60_000).toISOString(),
        notified_at: null,
      })
      .eq("id", session.id);
  } else {
    await db
      .from("sessions")
      .update({ status: action === "done" ? "done" : "stuck" })
      .eq("id", session.id);
  }
  await db.from("events").insert({ session_id: session.id, action });
  return NextResponse.json({ ok: true });
}
