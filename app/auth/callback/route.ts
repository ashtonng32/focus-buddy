import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowed } from "@/lib/supabase/env";

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data } = await supabase.auth.getUser();
      if (isAllowed(data.user?.email)) return NextResponse.redirect(`${origin}/`);
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=denied`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=failed`);
}
