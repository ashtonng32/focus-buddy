import { Suspense } from "react";
import { Landscape } from "@/components/art";
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
  return <p className="rounded-2xl bg-white/15 px-4 py-3 text-sm ring-1 ring-white/30">{messages[error] ?? messages.failed}</p>;
}

export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <div
      className="relative flex min-h-dvh flex-col overflow-hidden text-white"
      style={{ background: "linear-gradient(180deg,#2b1b6e 0%,#5b3fd0 55%,#b39bff 100%)" }}
    >
      <Landscape tone="dawn" className="pointer-events-none absolute inset-x-0 bottom-0 w-full" />
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-between px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
        <span className="font-display text-2xl">Focus Buddy</span>
        <div className="flex flex-col gap-4">
          <h1 className="font-display text-[3rem] leading-[1.05]">
            Find your focus. <em>One gentle step</em> at a time.
          </h1>
          <p className="text-white/80">Your accountability buddy.</p>
          <Suspense>
            <ErrorNote searchParams={searchParams} />
          </Suspense>
          {supabaseConfigured && <LoginButton />}
        </div>
        <div className="h-24" />
      </main>
    </div>
  );
}
