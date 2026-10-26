import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // The "N" badge Next shows on the local dev server only; production builds never have it.
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  // The in-browser enhancer runs its model on several threads, which the browser allows only on a cross-origin isolated
  // page. "credentialless" keeps the pictures and uploads that come from the storage bucket working. The workspace is
  // isolated as a whole because moving between its pages in the app never loads a new document.
  async headers() {
    const isolated = [
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
    ];
    return [
      ...["/dashboard", "/deliveries", "/enhancer", "/requests", "/notifications", "/profile", "/settings", "/team"].flatMap((base) => [
        { source: base, headers: isolated },
        { source: `${base}/:path*`, headers: isolated },
      ]),
      // Public files are served with no browser caching by default, so every visit re-asked for them. The mock photos and icons
      // keep a week (and refresh quietly after that); the enhancer's runtime files keep a day, because their names carry no version.
      ...["/images/:path*", "/icons/:path*"].map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      })),
      // Worker scripts must carry the policy themselves: the enhancer's own and the runtime's helper threads.
      ...["/enhance-worker.js", "/ort/:path*"].map((source) => ({
        source,
        headers: [{ key: "Cross-Origin-Embedder-Policy", value: "credentialless" }],
      })),
      // The runtime files never change under the same version; the worker script ships with each deploy, so it is left out.
      {
        source: "/ort/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
      // The face models never change under the same name, so the browser may keep them for good.
      {
        source: "/models/face/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      // The service worker must never be served stale, or a fix to notifications would wait on the browser's cache.
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
