import { NextResponse } from "next/server";
import { authedDb, loadActive, loadSettings, sessionOut, settingsOut, unauthorized } from "@/lib/server/api";

export async function GET() {
  const db = await authedDb();
  if (!db) return unauthorized();
  const [settings, session] = await Promise.all([loadSettings(db), loadActive(db)]);
  return NextResponse.json({
    serverNow: Date.now(),
    settings: settingsOut(settings),
    session: sessionOut(session),
  });
}
