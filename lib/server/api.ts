import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowed } from "@/lib/supabase/env";
import { createAdminClient } from "@/lib/supabase/admin";

export type Mode = "low" | "steady" | "flow";
export type Kind = "focus" | "break" | "switch";
export type Db = ReturnType<typeof createAdminClient>;

export const unauthorized = () => NextResponse.json({ error: "unauthorized" }, { status: 401 });

/** Returns the admin DB client if the caller is the allowed user, else null. */
export async function authedDb() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!isAllowed(data.user?.email)) return null;
  return createAdminClient();
}

type SettingsRow = {
  low_min: number;
  steady_min: number;
  flow_min: number;
  keepgoing_min: number;
  break_min: number;
  switch_min: number;
};

export function settingsOut(r: SettingsRow) {
  return {
    low: Number(r.low_min),
    steady: Number(r.steady_min),
    flow: Number(r.flow_min),
    keepGoing: Number(r.keepgoing_min),
    break: Number(r.break_min),
    switch: Number(r.switch_min),
  };
}

export type SessionRow = {
  id: string;
  kind: Kind;
  mode: Mode | null;
  notion_task_id: string | null;
  task_title: string;
  first_step: string;
  started_at: string;
  ends_at: string;
  status: string;
  handled_at: string | null;
  notion_failed: boolean;
};

export function sessionOut(r: SessionRow | null) {
  if (!r) return null;
  return {
    id: r.id,
    kind: r.kind,
    mode: r.mode,
    notionTaskId: r.notion_task_id,
    taskTitle: r.task_title,
    firstStep: r.first_step,
    startedAt: new Date(r.started_at).getTime(),
    endsAt: new Date(r.ends_at).getTime(),
  };
}

export async function loadSettings(db: Db) {
  const { data } = await db.from("settings").select("*").eq("id", 1).single();
  return data as SettingsRow;
}

export async function loadActive(db: Db) {
  const { data } = await db.from("sessions").select("*").eq("status", "running").maybeSingle();
  return data as SessionRow | null;
}
