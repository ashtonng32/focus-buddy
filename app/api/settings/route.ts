import { NextResponse } from "next/server";
import { authedDb, unauthorized } from "@/lib/server/api";

const MAP = {
  low: "low_min",
  steady: "steady_min",
  flow: "flow_min",
  keepGoing: "keepgoing_min",
  break: "break_min",
  switch: "switch_min",
} as const;

export async function PUT(req: Request) {
  const db = await authedDb();
  if (!db) return unauthorized();
  const body = (await req.json()) as Record<string, unknown>;
  const row: Record<string, number> = {};
  for (const [k, col] of Object.entries(MAP)) {
    const n = Number(body[k]);
    if (Number.isFinite(n) && n > 0 && n <= 600) row[col] = n;
  }
  const { error } = await db.from("settings").update(row).eq("id", 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
