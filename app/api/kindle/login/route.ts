import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { kindleConfigured, kindleLogin } from "@/lib/server/kindle-auth";

// Kindle PIN sign-in. Public route (see proxy.ts); returns a token for the Kindle to keep.
export async function POST(req: Request) {
  if (!kindleConfigured()) return NextResponse.json({ error: "Kindle sign-in isn't set up" }, { status: 503 });
  const { pin } = (await req.json().catch(() => ({}))) as { pin?: unknown };
  const result = await kindleLogin(createAdminClient(), typeof pin === "string" ? pin.trim() : "");
  if (result.ok) return NextResponse.json({ token: result.token });
  if (result.locked) {
    return NextResponse.json({ error: `Too many tries. Wait ${result.minutes} min.` }, { status: 429 });
  }
  return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
}
