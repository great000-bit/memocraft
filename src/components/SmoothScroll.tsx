"use client";

import { useEffect } from "react";

// Gentle, weighted scrolling on the landing page for mouse and trackpad. Phones keep their own native scrolling,
// which already feels right, and so does anyone who asked their device for less motion. The library loads after
// the page is interactive, so it never slows the first paint.
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    let lenis: { raf: (time: number) => void; destroy: () => void } | null = null;
    let frame = 0;
    let stopped = false;
    import("lenis").then(({ default: Lenis }) => {
      if (stopped) return;
      lenis = new Lenis({ lerp: 0.12, anchors: { offset: -80 } });
      const loop = (time: number) => {
        lenis?.raf(time);
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
    });
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      lenis?.destroy();
    };
  }, []);
  return null;
}
