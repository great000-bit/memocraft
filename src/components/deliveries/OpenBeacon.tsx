"use client";

import { useEffect } from "react";

const showingFor = 1500;

// Tells the sender the page was opened, once per tab session, after it has been on screen for a moment.
// The id is made in the browser and kept only in this tab; it stops a reload counting as a second open.
export function OpenBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `memocraft:seen:${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      // Storage can be blocked. The page is still reported once for this load.
    }
    let timer: ReturnType<typeof setTimeout> | undefined;

    function send() {
      let visit = "";
      try {
        visit = crypto.randomUUID();
        sessionStorage.setItem(key, visit);
      } catch {
        // Without storage or crypto there is nothing to dedupe on, so an id made from the clock is used.
        visit = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
      }
      document.removeEventListener("visibilitychange", check);
      fetch(`/d/${slug}/seen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visit }),
        keepalive: true,
      }).catch(() => {
        // Proof is best effort; a failed report never shows the client anything.
      });
    }

    function check() {
      clearTimeout(timer);
      if (document.visibilityState === "visible") timer = setTimeout(send, showingFor);
    }

    document.addEventListener("visibilitychange", check);
    check();
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [slug]);

  return null;
}
