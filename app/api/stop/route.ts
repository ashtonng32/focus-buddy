import { NextResponse } from "next/server";
import { authedDb, unauthorized } from "@/lib/server/api";

// End any session from anywhere; a stopped session is never notified.
export async function POST() {
  const db = await authedDb();
  if (!db) return unauthorized();
  const { data } = await db.from("sessions").update({ status: "stopped" }).eq("status", "running").select("id");
  if (data?.length) {
    await db.from("events").insert(data.map((s) => ({ session_id: s.id, action: "stop" })));
  }
  // Stop also ends a pending follow-up (Done -> Next/Break, Stuck -> What do you need?).
  await db
    .from("sessions")
    .update({ handled_at: new Date().toISOString() })
    .is("handled_at", null)
    .in("status", ["done", "stuck"]);
  return NextResponse.json({ ok: true });
}
