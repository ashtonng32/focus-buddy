"use client";

import { Pill } from "@/components/pill";
import { createClient } from "@/lib/supabase/client";

export function LoginButton() {
  return (
    <Pill
      variant="light"
      className="min-h-16 text-lg"
      onClick={() =>
        createClient().auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${location.origin}/auth/callback` },
        })
      }
    >
      Continue with Google
    </Pill>
  );
}
