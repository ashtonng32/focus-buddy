import { Suspense } from "react";
import { LoginButton } from "@/components/login-button";
import { supabaseConfigured } from "@/lib/supabase/env";

const messages: Record<string, string> = {
  setup: "Supabase isn't set up yet. Add the keys to .env.local (see README).",
  denied: "That Google account isn't allowed here.",
  failed: "Sign-in didn't finish. Try again.",
};

async function ErrorNote({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  if (!error) return null;
  return <p className="max-w-xs text-sm">{messages[error] ?? messages.failed}</p>;
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-4xl font-semibold">Focus Buddy</h1>
      <p className="text-muted-foreground">Your accountability buddy.</p>
      <Suspense>
        <ErrorNote searchParams={searchParams} />
      </Suspense>
      {supabaseConfigured && <LoginButton />}
    </main>
  );
}
