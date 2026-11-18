import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowed, supabaseConfigured, supabaseKey, supabaseUrl } from "@/lib/supabase/env";

const PUBLIC = ["/login", "/auth", "/manifest.webmanifest", "/sw.js", "/icons"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const toLogin = (reason?: string) => {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = reason ? `?error=${reason}` : "";
    return NextResponse.redirect(url);
  };

  if (!supabaseConfigured) return toLogin("setup");

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  if (!data.user) return toLogin();
  if (!isAllowed(data.user.email)) {
    await supabase.auth.signOut();
    return toLogin("denied");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
