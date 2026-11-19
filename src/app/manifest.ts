import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kaban — Personal Finance",
    short_name: "Kaban",
    description: "Offline-first personal finance tracker for cash, bank and e-wallet accounts, credit cards and instalments.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#F7FAF7",
    theme_color: "#176B4D",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "Add transaction", short_name: "Add", url: "/add" }],
  };
}
