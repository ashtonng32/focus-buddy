import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";
import { RegisterSW } from "@/components/register-sw";

const dm = DM_Sans({ variable: "--font-dm", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "Focus Buddy",
  description: "An accountability buddy timer.",
  appleWebApp: { capable: true, title: "Focus Buddy", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#5b3fd0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dm.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
