import { NextResponse } from "next/server";
import { authedDb, loadSettings, sessionOut, unauthorized, type Mode } from "@/lib/server/api";

const MODES: Mode[] = ["low", "steady", "flow"];

// Start a focus block. (Break and switch blocks arrive in slices 3 and 4.)
export async function POST(req: Request) {
  const db = await authedDb();
  if (!db) return unauthorized();
  const { mode } = (await req.json()) as { mode: Mode };
  if (!MODES.includes(mode)) return NextResponse.json({ error: "bad mode" }, { status: 400 });

  const settings = await loadSettings(db);
  const minutes = Number(settings[`${mode}_min` as const]);
  const now = Date.now();

  // Only one running session at a time: end any leftover one first.
  await db.from("sessions").update({ status: "stopped" }).eq("status", "running");
  const { data, error } = await db
    .from("sessions")
    .insert({
      kind: "focus",
      mode,
      // Slice 3 replaces this with a real Notion Today task.
      task_title: "Your next thing",
      first_step: "Just open it.",
      started_at: new Date(now).toISOString(),
      ends_at: new Date(now + minutes * 60_000).toISOString(),
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ session: sessionOut(data) });
}
