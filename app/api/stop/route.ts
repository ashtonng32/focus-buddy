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
  return NextResponse.json({ ok: true });
}
