import { NextResponse } from "next/server";
import { tasksAppName } from "@/lib/server/tasks";
import {
  authedDb,
  loadActive,
  loadSettings,
  sessionOut,
  settingsOut,
  unauthorized,
  type SessionRow,
} from "@/lib/server/api";

export async function GET() {
  const db = await authedDb();
  if (!db) return unauthorized();
  const [settings, session] = await Promise.all([loadSettings(db), loadActive(db)]);

  // With nothing running, the latest finished block may still be waiting on its follow-up:
  // Done -> Next task or Break, Stuck -> What do you need? (until marked handled).
  let lastEnded = null;
  if (!session) {
    const { data } = await db.from("sessions").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle();
    const s = data as SessionRow | null;
    if (s && !s.handled_at && s.kind !== "break" && (s.status === "done" || s.status === "stuck")) {
      const { data: ev } = await db
        .from("events")
        .select("action")
        .eq("session_id", s.id)
        .order("at", { ascending: false })
        .limit(1)
        .maybeSingle();
      lastEnded = {
        id: s.id,
        status: s.status as "done" | "stuck",
        mode: s.mode,
        notionTaskId: s.notion_task_id,
        taskTitle: s.task_title,
        notionFailed: s.notion_failed,
        talking: ev?.action === "talk",
      };
    }
  }

  // With nothing running or waiting: a stuck task we can offer to go back to (after a break or Claude).
  let resume = null;
  if (!session && !lastEnded) {
    const since = new Date(Date.now() - 6 * 3_600_000).toISOString();
    const { data } = await db
      .from("sessions")
      .select("*")
      .eq("resume_pending", true)
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const r = data as SessionRow | null;
    if (r?.notion_task_id) {
      resume = { id: r.id, mode: r.mode, notionTaskId: r.notion_task_id, taskTitle: r.task_title };
    }
  }

  return NextResponse.json({
    serverNow: Date.now(),
    tasksApp: tasksAppName(),
    settings: settingsOut(settings),
    session: sessionOut(session),
    lastEnded,
    resume,
  });
}
