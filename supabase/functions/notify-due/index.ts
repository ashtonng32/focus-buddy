// Called every minute by pg_cron (via pg_net). Sends a Web Push check-in for every
// running session whose ends_at has passed and that has not been notified yet.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const CRON_SECRET = Deno.env.get("CRON_SECRET")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT")!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// After 90 minutes of total flow, the check-in adds a pit stop line.
function pitStop(s: { kind: string; mode: string | null; started_at: string; ends_at: string; focus_total_ms: number }) {
  if (s.kind !== "focus" || s.mode !== "flow") return "";
  const total = Number(s.focus_total_ms) + (new Date(s.ends_at).getTime() - new Date(s.started_at).getTime());
  return total >= 90 * 60_000 ? " Take 2 minutes?" : "";
}

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }

  // Claim due sessions first so an overlapping run can't notify twice.
  const { data: due, error } = await db
    .from("sessions")
    .update({ notified_at: new Date().toISOString() })
    .eq("status", "running")
    .is("notified_at", null)
    .lte("ends_at", new Date().toISOString())
    .select("id, kind, mode, task_title, started_at, ends_at, focus_total_ms");
  if (error) return new Response(error.message, { status: 500 });
  if (!due?.length) return Response.json({ notified: 0 });

  const { data: subs } = await db.from("push_subscriptions").select("*");
  let sent = 0;
  for (const s of due) {
    const payload = JSON.stringify({
      sessionId: s.id,
      kind: s.kind,
      title: s.kind === "break" ? "Break's over." : "That's time.",
      body: s.kind === "break" ? s.task_title : "How's it going?" + pitStop(s),
    });
    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { urgency: "high", TTL: 3600 },
        );
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await db.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        } else {
          console.error("push failed", code, (e as Error).message);
        }
      }
    }
  }
  return Response.json({ notified: due.length, sent });
});
