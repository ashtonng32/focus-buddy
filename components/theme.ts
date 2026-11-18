import { Flame, Leaf, Waves, type LucideIcon } from "lucide-react";
import type { Mode } from "@/lib/app-state";

// One color family per mode: sage (Low), violet (Steady), sunset (Flow).
export const MODES: Record<
  Mode,
  { label: string; hint: string; Icon: LucideIcon; card: string; iconBg: string; iconFg: string; chip: string; sky: string }
> = {
  low: {
    label: "Low",
    hint: "A gentle start",
    Icon: Leaf,
    card: "bg-[#e3f4eb]",
    iconBg: "bg-[#bfe5d3]",
    iconFg: "text-[#1f6b55]",
    chip: "bg-white/70 text-[#1f6b55]",
    sky: "linear-gradient(180deg,#12303b 0%,#1f5560 55%,#3b8b7f 100%)",
  },
  steady: {
    label: "Steady",
    hint: "A normal block",
    Icon: Waves,
    card: "bg-[#ece6ff]",
    iconBg: "bg-[#d4c8ff]",
    iconFg: "text-[#4a2fb8]",
    chip: "bg-white/70 text-[#4a2fb8]",
    sky: "linear-gradient(180deg,#1b1048 0%,#4a2fb8 58%,#8f6df0 100%)",
  },
  flow: {
    label: "Flow",
    hint: "Long and deep",
    Icon: Flame,
    card: "bg-[#ffeadf]",
    iconBg: "bg-[#ffcaae]",
    iconFg: "text-[#b4441b]",
    chip: "bg-white/70 text-[#b4441b]",
    sky: "linear-gradient(180deg,#2a1148 0%,#9b3a6e 55%,#f08a5d 100%)",
  },
};
