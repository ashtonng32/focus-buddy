"use client";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function LoginButton() {
  return (
    <Button
      size="lg"
      className="h-14 px-8 text-lg"
      onClick={() =>
        createClient().auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${location.origin}/auth/callback` },
        })
      }
    >
      Sign in with Google
    </Button>
  );
}
