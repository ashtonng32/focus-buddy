import { NextResponse } from "next/server";
import { authedDb, loadActive, unauthorized } from "@/lib/server/api";
import { pickBreak } from "@/lib/server/breaks";

// "Another idea": swap the running break's idea for a different one from the Ideas For A Break list.
export async function POST() {
  const db = await authedDb();
  if (!db) return unauthorized();
  const session = await loadActive(db);
  if (!session || session.kind !== "break") return NextResponse.json({ ok: true, ignored: true });
  const next = await pickBreak(session.mode ?? "steady", session.task_title);
  await db.from("sessions").update({ task_title: next.idea, first_step: next.firstStep }).eq("id", session.id);
  return NextResponse.json({ ok: true });
}
