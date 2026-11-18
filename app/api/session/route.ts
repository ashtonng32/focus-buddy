import { NextResponse } from "next/server";
import { authedDb, loadSettings, sessionOut, unauthorized, type Kind, type Mode } from "@/lib/server/api";
import { getTask } from "@/lib/server/notion";
import { pickBreak } from "@/lib/server/breaks";

const MODES: Mode[] = ["low", "steady", "flow"];
const KINDS: Kind[] = ["focus", "switch", "break"];

// Start a focus, switch or break block. `fromSessionId` is the finished block this one follows
// (Stuck -> break / different task, Done -> break); it is marked handled.
export async function POST(req: Request) {
  const db = await authedDb();
  if (!db) return unauthorized();
  const body = (await req.json()) as { kind?: Kind; mode: Mode; taskId?: string | null; fromSessionId?: string };
  const kind: Kind = body.kind ?? "focus";
  if (!MODES.includes(body.mode) || !KINDS.includes(kind)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const settings = await loadSettings(db);
  const minutes = Number(
    kind === "break" ? settings.break_min : kind === "switch" ? settings.switch_min : settings[`${body.mode}_min` as const],
  );

  let title = "Your next thing";
  let firstStep = "Just open it.";
  let taskId: string | null = null;
  let effort: string | null = null;
  if (kind === "break") {
    const idea = await pickBreak(body.mode).catch(() => ({ idea: "Step away from the screen for a bit.", firstStep: "" }));
    title = idea.idea;
    firstStep = idea.firstStep;
  } else if (body.taskId) {
    const task = await getTask(body.taskId);
    if (task) {
      title = task.title;
      firstStep = task.firstStep;
      taskId = task.id;
      effort = task.effort;
    }
  }

  const now = Date.now();
  // Only one running session at a time: end any leftover one first.
  await db.from("sessions").update({ status: "stopped" }).eq("status", "running");
  const { data, error } = await db
    .from("sessions")
    .insert({
      kind,
      mode: body.mode,
      notion_task_id: taskId,
      effort,
      task_title: title,
      first_step: firstStep,
      started_at: new Date(now).toISOString(),
      ends_at: new Date(now + minutes * 60_000).toISOString(),
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.fromSessionId) {
    await db.from("sessions").update({ handled_at: new Date().toISOString() }).eq("id", body.fromSessionId);
    if (kind === "break" || kind === "switch") {
      await db.from("events").insert({ session_id: body.fromSessionId, action: kind });
    }
  }
  return NextResponse.json({ session: sessionOut(data) });
}
