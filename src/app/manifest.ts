import type { MetadataRoute } from "next";

// Lets a creative add Memocraft to their phone's Home Screen and open it like an app, straight into the workspace.
// The icons are the amber "em" mark on the dark tile.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/dashboard",
    name: "Memocraft",
    short_name: "Memocraft",
    description: "Deliver files to clients with one link, and know when they opened and saved them.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
