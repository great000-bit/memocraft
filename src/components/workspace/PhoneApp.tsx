"use client";

import { useEffect, useState } from "react";
import editor from "../deliveries/Editor.module.css";
import { hasInstallPrompt, installEvent, takeInstallPrompt } from "./ServiceWorker";
import styles from "./Settings.module.css";

// The two panels at the top of the Notifications page: getting Memocraft onto the phone's Home Screen, and switching
// phone notifications on for this device. iPhones only allow web notifications for an app on the Home Screen
// (iOS 16.4 and later), so on an iPhone in Safari the first panel says how, and the second waits for it.

type Device = { ios: boolean; installed: boolean; supported: boolean };

function detect(): Device {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const installed =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  return { ios, installed, supported };
}

function keyBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function registration() {
  await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  return navigator.serviceWorker.ready;
}

export function GetTheApp() {
  const [device, setDevice] = useState<Device | null>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    // Read once in the browser; the server cannot know what phone this is.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDevice(detect());
    setCanInstall(hasInstallPrompt());
    const onReady = () => setCanInstall(true);
    window.addEventListener(installEvent, onReady);
    return () => window.removeEventListener(installEvent, onReady);
  }, []);

  async function install() {
    const prompt = takeInstallPrompt();
    setCanInstall(false);
    if (!prompt) return;
    await prompt.prompt();
    if ((await prompt.userChoice).outcome === "accepted") setDevice((d) => (d ? { ...d, installed: true } : d));
  }

  let body: React.ReactNode;
  if (!device) body = <p className={styles.panelText}>Checking this device…</p>;
  else if (device.installed) body = <p className={styles.panelText}>You are using the Memocraft app on this device.</p>;
  else if (device.ios)
    body = (
      <ol className={styles.steps}>
        <li>
          In Safari, tap the <b>Share</b> button (the square with an arrow).
        </li>
        <li>
          Choose <b>Add to Home Screen</b>, then <b>Add</b>.
        </li>
        <li>Open Memocraft from your Home Screen and come back to this page to turn on notifications.</li>
      </ol>
    );
  else if (canInstall)
    body = (
      <>
        <p className={styles.panelText}>Add Memocraft to this device. It opens on your dashboard, full screen, like any app.</p>
        <div className={styles.buttonRow}>
          <button type="button" className={`${editor.button} ${editor.primary}`} onClick={install}>
            Install Memocraft
          </button>
        </div>
      </>
    );
  else
    body = (
      <p className={styles.panelText}>
        On Android, open the browser menu and choose <b>Install app</b> or <b>Add to Home screen</b>. On an iPhone, open
        this page in Safari, tap <b>Share</b>, then <b>Add to Home Screen</b>.
      </p>
    );

  return (
    <section className={styles.panel} aria-labelledby="app-title">
      <h2 id="app-title" className={styles.panelTitle}>
        Get the app on your phone
      </h2>
      {body}
    </section>
  );
}

type PushState = "checking" | "unconfigured" | "unsupported" | "needs-install" | "blocked" | "off" | "on";

export function PhoneNotifications({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = useState<PushState>("checking");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const device = detect();
      let next: PushState;
      if (!publicKey) next = "unconfigured";
      else if (device.ios && !device.installed) next = "needs-install";
      else if (!device.supported) next = "unsupported";
      else if (Notification.permission === "denied") next = "blocked";
      else {
        try {
          const sub = await (await registration()).pushManager.getSubscription();
          next = sub ? "on" : "off";
        } catch {
          next = "unsupported";
        }
      }
      if (live) setState(next);
    })();
    return () => {
      live = false;
    };
  }, [publicKey]);

  async function turnOn() {
    if (!publicKey) return;
    setBusy(true);
    setNote(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const reg = await registration();
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
      const response = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!response.ok) throw new Error("save");
      setState("on");
      setNote("Notifications are on for this device.");
    } catch {
      setNote("That did not work. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setNote(null);
    try {
      const sub = await (await registration()).pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
      setNote("Notifications are off for this device.");
    } catch {
      setNote("That did not work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setNote(null);
    try {
      const response = await fetch("/api/push/test", { method: "POST" });
      const { devices } = (await response.json()) as { devices?: number };
      setNote(devices ? "Sent. It should arrive in a few seconds." : "No device has notifications on yet.");
    } catch {
      setNote("That did not work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const text: Record<PushState, string> = {
    checking: "Checking this device…",
    unconfigured: "Phone notifications are not set up on this site yet.",
    unsupported:
      "This browser cannot show notifications. Use Chrome on Android, or Memocraft added to an iPhone's Home Screen.",
    "needs-install": "On iPhone, notifications work once Memocraft is on your Home Screen. Follow the steps above first.",
    blocked:
      "Notifications are blocked for Memocraft on this device. Allow them in your phone or browser settings, then come back.",
    off: "Get a notification on this device when a client opens a delivery, starts saving files, or asks for something.",
    on: "On for this device. You hear about it when a client opens a delivery, starts saving files, or asks for something.",
  };

  return (
    <section className={styles.panel} aria-labelledby="push-title">
      <h2 id="push-title" className={styles.panelTitle}>
        Phone notifications
      </h2>
      <p className={styles.panelText}>{text[state]}</p>
      {(state === "off" || state === "on") && (
        <div className={styles.buttonRow}>
          {state === "off" ? (
            <button type="button" className={`${editor.button} ${editor.primary}`} onClick={turnOn} disabled={busy}>
              Turn on notifications
            </button>
          ) : (
            <>
              <button type="button" className={`${editor.button} ${editor.secondary}`} onClick={test} disabled={busy}>
                Send a test
              </button>
              <button type="button" className={`${editor.button} ${editor.ghost}`} onClick={turnOff} disabled={busy}>
                Turn off
              </button>
            </>
          )}
        </div>
      )}
      {note && (
        <p className={styles.ok} role="status">
          {note}
        </p>
      )}
    </section>
  );
}
