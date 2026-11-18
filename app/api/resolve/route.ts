import { NextResponse } from "next/server";
import { authedDb, unauthorized } from "@/lib/server/api";

// Follow-up to a finished block: "talk" (opened the Claude app, paused until "I'm back")
// or "handled" (moved on to pick a mode).
export async function POST(req: Request) {
  const db = await authedDb();
  if (!db) return unauthorized();
  const { sessionId, action } = (await req.json()) as { sessionId: string; action: "talk" | "handled" };
  if (!sessionId || !["talk", "handled"].includes(action)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (action === "talk") {
    await db.from("events").insert({ session_id: sessionId, action: "talk" });
  } else {
    await db.from("sessions").update({ handled_at: new Date().toISOString() }).eq("id", sessionId);
  }
  return NextResponse.json({ ok: true });
}
