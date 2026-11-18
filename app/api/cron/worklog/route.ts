import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createWorkLog } from "@/lib/server/notion";

const TZ = () => process.env.APP_TIMEZONE || "America/Denver";

function localParts(d: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ(),
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

function duration(ms: number) {
  const m = Math.round(ms / 60_000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

// Called hourly by pg_cron. From 9 pm local time on, writes the day's Work Log entry once
// (if any blocks ran). ?dry=1 shows the entry without writing; ?force=1 skips the 9 pm check.
export async function POST(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const dry = url.searchParams.has("dry");
  const force = url.searchParams.has("force") || dry;

  const now = new Date();
  const here = localParts(now);
  if (!force && here.hour < 21) return NextResponse.json({ skipped: "before 9 pm" });
  const day = url.searchParams.get("date") ?? here.day;

  const db = createAdminClient();
  const { data: existing } = await db.from("worklog_days").select("day").eq("day", day).maybeSingle();
  if (existing && !dry) return NextResponse.json({ skipped: "already logged" });

  const since = new Date(now.getTime() - 48 * 3_600_000).toISOString();
  const { data } = await db.from("sessions").select("*").gte("started_at", since).neq("status", "running");
  const sessions = (data ?? []).filter((s) => localParts(new Date(s.started_at)).day === day);
  if (!sessions.length) return NextResponse.json({ skipped: "no sessions" });

  const { data: ev } = await db
    .from("events")
    .select("session_id, action, at")
    .in("session_id", sessions.map((s) => s.id))
    .in("action", ["done", "stuck", "stop"])
    .order("at", { ascending: true });
  const endedAt = new Map<string, number>();
  for (const e of ev ?? []) endedAt.set(e.session_id, new Date(e.at).getTime());

  const work = sessions.filter((s) => s.kind !== "break");
  const done = [...new Set(work.filter((s) => s.status === "done" && s.notion_task_id).map((s) => s.task_title))];
  const focusMs = work.reduce((sum, s) => {
    const start = new Date(s.started_at).getTime();
    const end = Math.min(endedAt.get(s.id) ?? Infinity, new Date(s.ends_at).getTime());
    return sum + Number(s.focus_total_ms) + Math.max(0, end - start);
  }, 0);
  const breaks = sessions.filter((s) => s.kind === "break").length;

  const when = new Date(`${day}T12:00:00Z`);
  const label = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(when);
  const entry = {
    title: `Focus Buddy · ${label}`,
    date: day,
    whatGotDone: [
      done.length ? `Tasks done: ${done.join("; ")}.` : "Tasks done: none marked today.",
      `Focused: ${duration(focusMs)} across ${work.length} block${work.length === 1 ? "" : "s"}.`,
      `Breaks taken: ${breaks}.`,
    ].join("\n"),
  };
  if (dry) return NextResponse.json({ dry: true, entry });

  const pageId = await createWorkLog(entry);
  await db.from("worklog_days").insert({ day, notion_page_id: pageId });
  return NextResponse.json({ logged: true, entry });
}
