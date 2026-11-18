import type { ReactNode } from "react";

type Tone = "dawn" | "low" | "steady" | "flow" | "sage";

// Layered mountains with a sun, in the colors of each mood.
const TONES: Record<Tone, { sun: string; far: string; mid: string; near: string }> = {
  dawn: { sun: "#ffd9a8", far: "#c4b0ff", mid: "#9a7cf2", near: "#6a47dc" },
  low: { sun: "#fff0b8", far: "#6fb3a1", mid: "#3f8d7b", near: "#245f52" },
  steady: { sun: "#ffd3b3", far: "#8f70ea", mid: "#6a45d8", near: "#3f2a9c" },
  flow: { sun: "#ffb26a", far: "#e8708a", mid: "#a83f7f", near: "#4a1f5c" },
  sage: { sun: "#f3f0c4", far: "#a9cf9a", mid: "#7fb083", near: "#4f8a6c" },
};

export function Landscape({ tone = "dawn", className = "" }: { tone?: Tone; className?: string }) {
  const c = TONES[tone];
  return (
    <svg viewBox="0 0 400 200" className={className} aria-hidden="true">
      <circle cx="292" cy="62" r="30" fill={c.sun} opacity="0.95" />
      <circle cx="292" cy="62" r="46" fill={c.sun} opacity="0.18" />
      <path d="M0 200V118l54-52 40 36 62-70 66 74 48-38 56 50 38-24 36 26v80Z" fill={c.far} opacity="0.75" />
      <path d="M0 200v-58l44-34 54 46 50-52 70 60 52-36 70 52 60-28v50Z" fill={c.mid} opacity="0.9" />
      <path d="M0 200v-26c40-30 84-34 130-10 44 22 84 16 128-6 48-24 98-14 142 12v30Z" fill={c.near} />
    </svg>
  );
}

/** Soft overlapping circles, like the feeling bubbles in the reference designs. */
export function Blobs({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <div className="absolute -right-16 -top-12 h-56 w-56 rounded-full bg-[#d9ccff]/45" />
      <div className="absolute -left-20 top-40 h-48 w-48 rounded-full bg-[#cfe9dd]/40" />
      <div className="absolute -right-10 bottom-24 h-40 w-40 rounded-full bg-[#ffd9c7]/40" />
    </div>
  );
}

/** Countdown ring: the arc shrinks as time runs out. */
export function Ring({
  progress,
  size = 290,
  stroke = 10,
  children,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, progress));
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="white"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circ * p} ${circ}`}
          style={{ transition: "stroke-dasharray 0.4s linear" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">{children}</div>
    </div>
  );
}
