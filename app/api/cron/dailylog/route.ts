import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchToday, upsertDailyLog, type DailyNumbers } from "@/lib/server/notion";

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

const MODE_NAMES = { low: "Low", steady: "Steady", flow: "Flow" } as const;

// Called hourly by pg_cron. From 8 pm local time on, fills the day's Daily Log row in Notion from the
// daily_summary view (later runs refresh the numbers). Does nothing on a day with no blocks.
// ?dry=1 shows the numbers without writing; ?force=1 skips the 8 pm check; ?date=YYYY-MM-DD picks a day.
export async function POST(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const dry = url.searchParams.has("dry");
  const force = url.searchParams.has("force") || dry;

  const here = localParts(new Date());
  if (!force && here.hour < 20) return NextResponse.json({ skipped: "before 8 pm" });
  const day = url.searchParams.get("date") ?? here.day;

  const db = createAdminClient();
  const { data } = await db.from("daily_summary").select("*").eq("day", day).maybeSingle();

  // Avoided: hit 3+ times (skipped or switched away from) in 7 days, and still open on Today.
  const { data: hits } = await db.from("task_avoidance").select("notion_task_id, task_title, total").gte("total", 3);
  const open = new Set((await fetchToday().catch(() => [])).map((t) => t.id));
  const avoided = (hits ?? []).filter((h) => open.has(h.notion_task_id));

  // A day with no blocks still gets a row when something is being avoided: that is when the offer helps.
  if (!Number(data?.blocks) && !avoided.length) return NextResponse.json({ skipped: "no blocks" });

  const numbers: DailyNumbers = {
    mode: data?.first_mode ? MODE_NAMES[data.first_mode as keyof typeof MODE_NAMES] : null,
    focusMinutes: Number(data?.focus_minutes ?? 0),
    blocks: Number(data?.blocks ?? 0),
    tasksDone: Number(data?.tasks_done ?? 0),
    keepGoings: Number(data?.keep_goings ?? 0),
    stuckTaps: Number(data?.stuck_taps ?? 0),
    switches: Number(data?.switches ?? 0),
    breaks: Number(data?.breaks ?? 0),
    avoided: avoided.map((h) => h.notion_task_id),
  };
  if (dry) return NextResponse.json({ dry: true, day, numbers, avoidedTitles: avoided.map((h) => h.task_title) });

  const label = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(
    new Date(`${day}T12:00:00Z`),
  );
  const row = await upsertDailyLog(day, label, numbers);
  return NextResponse.json({ logged: true, ...row, day, numbers });
}
