import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "solid" | "light" | "glass" | "soft" | "outline" | "success";

const STYLES: Record<Variant, string> = {
  solid: "bg-[#5b3fd0] text-white shadow-[0_10px_24px_-10px_rgba(91,63,208,0.7)] active:bg-[#4a2fb8]",
  light: "bg-white text-[#3d2a91] shadow-[0_10px_24px_-12px_rgba(0,0,0,0.45)] active:bg-[#f1ebff]",
  glass: "bg-white/15 text-white ring-1 ring-white/35 backdrop-blur active:bg-white/25",
  soft: "bg-[#ebe5ff] text-[#3d2a91] active:bg-[#ddd3ff]",
  success: "bg-[#2f9e6e] text-white shadow-[0_10px_24px_-10px_rgba(47,158,110,0.7)]",
  outline: "bg-white/70 text-[#3d2a91] ring-1 ring-[#cfc4f5] active:bg-white",
};

type Common = { variant?: Variant; className?: string; children: ReactNode };

const base =
  "flex min-h-16 w-full items-center justify-center gap-2 rounded-full px-6 text-lg font-semibold transition-all duration-300 active:scale-[0.98] disabled:opacity-60";

export function Pill({
  variant = "solid",
  className = "",
  children,
  ...rest
}: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`${base} ${STYLES[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function PillLink({
  variant = "solid",
  className = "",
  children,
  ...rest
}: Common & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a className={`${base} ${STYLES[variant]} ${className}`} {...rest}>
      {children}
    </a>
  );
}

/** Small quiet text button (Stop, Back). `tone="dark"` is for the immersive dark screens. */
export function TextButton({
  onClick,
  children,
  tone = "light",
}: {
  onClick: () => void;
  children: ReactNode;
  tone?: "light" | "dark";
}) {
  return (
    <button
      onClick={onClick}
      className={`mx-auto min-h-11 px-4 text-sm font-medium underline-offset-4 hover:underline ${
        tone === "dark" ? "text-white/70" : "text-[#6c6290]"
      }`}
    >
      {children}
    </button>
  );
}
