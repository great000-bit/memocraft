"use client";

import { useEffect, useRef, useState } from "react";
import buttons from "./Button.module.css";
import styles from "./GetApp.module.css";

// The hero's second button: put Memocraft on the phone's Home Screen. Where the browser can install it (Chrome on
// Android and on computers) the button opens the browser's own install prompt. Everywhere else, and always on an
// iPhone, where only Safari's Share menu can add an app, it opens a short sheet with the two taps it takes.

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
type Device = "iphone" | "android" | "computer";

function detect(): Device {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "iphone";
  if (/Android/.test(ua)) return "android";
  return "computer";
}

const shareIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 9H6.5A1.5 1.5 0 0 0 5 10.5v8A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 17.5 9H16" />
    <path d="M12 14V3.5M8.5 7 12 3.5 15.5 7" />
  </svg>
);

const plusIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="4" />
    <path d="M12 8.5v7M8.5 12h7" />
  </svg>
);

const menuIcon = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="5.5" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="12" cy="18.5" r="1.8" />
  </svg>
);

const phoneIcon = (
  <svg className={styles.buttonIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
    <path d="M12 7.5v7M9.5 12l2.5 2.5 2.5-2.5" />
  </svg>
);

function IphoneSteps() {
  return (
    <ol className={styles.steps}>
      <li>
        <span className={styles.stepIcon}>{shareIcon}</span>
        <span>
          In Safari, tap <b>Share</b> at the bottom of the screen.
        </span>
      </li>
      <li>
        <span className={styles.stepIcon}>{plusIcon}</span>
        <span>
          Tap <b>Add to Home Screen</b>, then <b>Add</b>.
        </span>
      </li>
    </ol>
  );
}

function AndroidSteps() {
  return (
    <ol className={styles.steps}>
      <li>
        <span className={styles.stepIcon}>{menuIcon}</span>
        <span>
          In Chrome, tap the <b>menu</b> at the top right.
        </span>
      </li>
      <li>
        <span className={styles.stepIcon}>{plusIcon}</span>
        <span>
          Tap <b>Install app</b> (or <b>Add to Home screen</b>), then <b>Install</b>.
        </span>
      </li>
    </ol>
  );
}

export function GetAppButton() {
  const prompt = useRef<InstallPrompt | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [device, setDevice] = useState<Device>("computer");
  const [host, setHost] = useState("memocraft-alpha.vercel.app");

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      prompt.current = event as InstallPrompt;
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function open() {
    if (prompt.current) {
      const offer = prompt.current;
      prompt.current = null;
      await offer.prompt();
      return;
    }
    setDevice(detect());
    setHost(window.location.host);
    dialog.current?.showModal();
  }

  return (
    <>
      <button type="button" className={`${buttons.button} ${buttons.outline} ${buttons.lg} ${styles.trigger}`} onClick={open}>
        {phoneIcon}
        <span className={buttons.label}>Get the app</span>
      </button>
      <dialog
        ref={dialog}
        className={styles.sheet}
        aria-labelledby="get-app-title"
        onClick={(event) => {
          // A tap on the dimmed page around the sheet closes it.
          if (event.target === dialog.current) dialog.current.close();
        }}
      >
        <div className={styles.inner}>
          {/* eslint-disable-next-line @next/next/no-img-element -- the installed app's own icon, already sized */}
          <img className={styles.appIcon} src="/icons/apple-touch-icon.png" alt="" width={64} height={64} />
          <h2 id="get-app-title" className={styles.title}>
            Memocraft on your Home Screen
          </h2>
          <p className={styles.lede}>
            It opens full screen like any app, and can tell you the moment a client opens or saves your files.
          </p>
          {device === "iphone" && <IphoneSteps />}
          {device === "android" && <AndroidSteps />}
          {device === "computer" && (
            <>
              <p className={styles.where}>
                On your phone, open <b>{host}</b>, then:
              </p>
              <h3 className={styles.platform}>iPhone</h3>
              <IphoneSteps />
              <h3 className={styles.platform}>Android</h3>
              <AndroidSteps />
            </>
          )}
          <button type="button" className={`${buttons.button} ${buttons.primary} ${styles.done}`} onClick={() => dialog.current?.close()}>
            Got it
          </button>
        </div>
      </dialog>
    </>
  );
}
