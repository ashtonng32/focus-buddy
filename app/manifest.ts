import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Focus Buddy",
    short_name: "Focus Buddy",
    description: "An accountability buddy timer.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f1ff",
    theme_color: "#5b3fd0",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
