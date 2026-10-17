"use client";

import { useEffect } from "react";

// Android's "Install app" offer arrives once, early, and may come before the Notifications page is open. It is kept
// here so that page's Install button can use it later.
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let installPrompt: InstallPrompt | null = null;
export const installEvent = "mc-install-ready";

export function takeInstallPrompt() {
  const prompt = installPrompt;
  installPrompt = null;
  return prompt;
}

export function hasInstallPrompt() {
  return installPrompt !== null;
}

// Registers the service worker that shows phone notifications. It caches nothing, so registering it on every workspace
// page is cheap; it also lets Android offer "Install app".
export function ServiceWorker() {
  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      installPrompt = event as InstallPrompt;
      window.dispatchEvent(new Event(installEvent));
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
        // Blocked (some private windows): the app works the same, only without phone notifications.
      });
    }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  return null;
}
