import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

// Server-only: uses the secret key, bypasses RLS. Never import from client code.
export function createAdminClient() {
  return createClient(supabaseUrl!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
