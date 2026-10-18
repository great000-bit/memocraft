"use client";

import { useEffect, useRef, useState } from "react";
import { LogoMark } from "./Logo";
import { Phone } from "./Phone";
import { Photo } from "./Photo";
import type { PhotoKey } from "./photos";
import styles from "./HeroDemo.module.css";

// A short film inside the hero phone: a cursor sends a delivery from start to finish, the client opens it and saves
// the photos, and the creative gets the proof. It loops, pauses when it is off screen or the tab is hidden, and
// people who ask for less motion see the finished client page standing still.

type Scene = "home" | "new" | "link" | "client" | "proof";

type State = {
  scene: Scene;
  cursor: { x: number; y: number; shown: boolean; down: boolean };
  ripple: number;
  focused: boolean;
  typed: string;
  files: number;
  uploaded: boolean;
  pressed: string | null;
  copied: boolean;
  saving: boolean;
  saved: boolean;
  proof: number;
  fading: boolean;
};

const start: State = {
  scene: "home",
  cursor: { x: 80, y: 92, shown: false, down: false },
  ripple: 0,
  focused: false,
  typed: "",
  files: 0,
  uploaded: false,
  pressed: null,
  copied: false,
  saving: false,
  saved: false,
  proof: 0,
  fading: false,
};

const clientName = "Kemi at Orbit Foods";
const shots: PhotoKey[] = ["printLaugh", "capFists", "faceSculpture", "purplePhone", "limePhone", "beretPhone"];
const steps: Scene[] = ["home", "new", "link", "client", "proof"];

// The order of events, as a script. Each line waits for the one before it; `move` glides the cursor to a point given
// as a percentage of the screen.
async function film(set: (change: (state: State) => State) => void, wait: (ms: number) => Promise<void>) {
  const patch = (change: Partial<State>) => set((state) => ({ ...state, ...change }));
  const move = async (x: number, y: number, ms = 850) => {
    set((state) => ({ ...state, cursor: { ...state.cursor, x, y, shown: true } }));
    await wait(ms);
  };
  const click = async (target: string | null = null) => {
    set((state) => ({ ...state, pressed: target, ripple: state.ripple + 1, cursor: { ...state.cursor, down: true } }));
    await wait(170);
    set((state) => ({ ...state, pressed: null, cursor: { ...state.cursor, down: false } }));
    await wait(230);
  };

  set(() => start);
  await wait(500);
  await move(50, 61, 1000);
  await click("start");
  patch({ scene: "new" });
  await wait(650);

  await move(50, 21);
  await click("field");
  patch({ focused: true });
  for (let i = 1; i <= clientName.length; i++) {
    patch({ typed: clientName.slice(0, i) });
    await wait(45 + (i % 3) * 18);
  }
  await wait(250);
  await move(50, 50);
  await click("drop");
  patch({ focused: false });
  for (let i = 1; i <= shots.length; i++) {
    patch({ files: i });
    await wait(130);
  }
  await wait(1250);
  patch({ uploaded: true });
  await wait(350);
  await move(50, 87);
  await click("publish");
  patch({ scene: "link" });
  await wait(800);

  await move(81, 60);
  await click("copy");
  patch({ copied: true });
  await wait(1000);

  set((state) => ({ ...state, cursor: { ...state.cursor, shown: false } }));
  patch({ scene: "client" });
  await wait(1300);
  await move(50, 88, 950);
  await click("save");
  patch({ saving: true });
  await wait(1200);
  patch({ saving: false, saved: true });
  await wait(900);

  set((state) => ({ ...state, cursor: { ...state.cursor, shown: false } }));
  patch({ scene: "proof" });
  for (let i = 1; i <= 3; i++) {
    await wait(420);
    patch({ proof: i });
  }
  await wait(2600);
  patch({ fading: true });
  await wait(600);
}

export function HeroDemo({ className = "" }: { className?: string }) {
  const [state, setState] = useState<State>(start);
  const [still, setStill] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- a one-time switch to the still frame
      setStill(true);
      return;
    }
    let stopped = false;
    let onScreen = true;
    let resume: (() => void) | null = null;
    const playing = () => onScreen && !document.hidden;
    const wake = () => {
      if (playing() && resume) {
        resume();
        resume = null;
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      wake();
    });
    if (root.current) observer.observe(root.current);
    document.addEventListener("visibilitychange", wake);

    // Time only passes while the film can be seen, so it never jumps ahead when you scroll back to it.
    const wait = async (ms: number) => {
      let left = ms;
      while (left > 0 && !stopped) {
        if (!playing()) await new Promise<void>((done) => (resume = done));
        const began = performance.now();
        await new Promise((done) => setTimeout(done, Math.min(left, 100)));
        left -= performance.now() - began;
      }
    };
    const set = (change: (state: State) => State) => {
      if (!stopped) setState(change);
    };
    (async () => {
      while (!stopped) await film(set, wait);
    })();

    return () => {
      stopped = true;
      resume?.();
      observer.disconnect();
      document.removeEventListener("visibilitychange", wake);
    };
  }, []);

  const s = still ? { ...start, scene: "client" as Scene, saved: true } : state;
  const at = steps.indexOf(s.scene);
  const pressed = (name: string) => (s.pressed === name ? styles.pressed : "");

  return (
    <div ref={root} className={styles.frame} data-scene={s.scene}>
      <Phone className={className} label="A walkthrough: sending a delivery in Memocraft, the client saving the photos, and the proof of delivery">
        <div className={`${styles.film} ${s.fading ? styles.fading : ""}`} aria-hidden="true">
          <div className={styles.progress}>
            {steps.map((step, index) => (
              <i key={step} data-state={index < at ? "done" : index === at ? "now" : "next"} />
            ))}
          </div>

          {/* 1. The creative's workspace */}
          <section className={styles.scene} data-shown={s.scene === "home"} data-past={at > 0}>
            <div className={styles.topRow}>
              <LogoMark className={styles.mark} />
              <span className={styles.avatar}>AO</span>
            </div>
            <p className={styles.hello}>Welcome back, Ada</p>
            <p className={styles.muted}>Your deliveries live here.</p>
            <div className={styles.cards}>
              <div className={styles.card}>
                <span>Clients</span>
                <b>0</b>
              </div>
              <div className={`${styles.card} ${styles.cardTeal}`}>
                <span>Storage</span>
                <b>10 GB</b>
              </div>
            </div>
            <div className={styles.empty}>
              <i />
              <i />
              <span>No deliveries yet</span>
            </div>
            <span className={`${styles.cta} ${pressed("start")}`}>Send your first delivery →</span>
            <p className={styles.hint}>Name it, add the files, send one link.</p>
          </section>

          {/* 2. A new delivery: who it is for, then the files */}
          <section className={styles.scene} data-shown={s.scene === "new"} data-past={at > 1}>
            <p className={styles.heading}>New delivery</p>
            <label className={styles.label}>
              <span>1</span> Who is it for?
            </label>
            <span className={`${styles.field} ${s.focused ? styles.focused : ""} ${pressed("field")}`}>
              {s.typed || <em>Client name</em>}
              {s.focused && <i className={styles.caret} />}
            </span>
            <label className={styles.label}>
              <span>2</span> Add the files
            </label>
            <div className={`${styles.drop} ${s.files ? styles.dropFull : ""} ${pressed("drop")}`}>
              {s.files === 0 ? (
                <p>
                  <b>Drop photos here</b>
                  <br />
                  or tap to choose
                </p>
              ) : (
                <div className={styles.thumbs}>
                  {shots.slice(0, s.files).map((shot) => (
                    <i key={shot} className={s.uploaded ? styles.done : ""}>
                      <Photo name={shot} sizes="60px" />
                      <span className={styles.bar} />
                    </i>
                  ))}
                </div>
              )}
            </div>
            <p className={styles.count}>{s.uploaded ? "6 photos ready" : s.files ? `Uploading ${s.files} of 6…` : " "}</p>
            <span className={`${styles.cta} ${styles.publish} ${s.uploaded ? "" : styles.off} ${pressed("publish")}`}>
              Publish link
            </span>
          </section>

          {/* 3. The link is ready */}
          <section className={styles.scene} data-shown={s.scene === "link"} data-past={at > 2}>
            <div className={styles.dim}>
              <p className={styles.heading}>Spring Lookbook</p>
              <p className={styles.muted}>For {clientName} · 6 photos</p>
            </div>
            <div className={styles.sheet}>
              <span className={styles.tick}>✓</span>
              <p className={styles.sheetTitle}>Your link is ready</p>
              <p className={styles.muted}>Send it any way you like. No sign-up for Kemi.</p>
              <div className={styles.linkRow}>
                <span className={styles.url}>memocraft.app/d/spring-lookbook</span>
                <span className={`${styles.copy} ${s.copied ? styles.copied : ""} ${pressed("copy")}`}>
                  {s.copied ? "Copied" : "Copy"}
                </span>
              </div>
            </div>
          </section>

          {/* 4. The client opens it on their phone */}
          <section className={`${styles.scene} ${styles.client}`} data-shown={s.scene === "client"} data-past={at > 3}>
            <div className={styles.brand}>
              <span className={styles.studioMark}>L</span>
              <span>Lumen Studio</span>
            </div>
            <p className={styles.heading}>Spring Lookbook</p>
            <p className={styles.muted}>For {clientName}</p>
            <div className={styles.gallery}>
              {shots.map((shot) => (
                <i key={shot}>
                  <Photo name={shot} sizes="90px" />
                </i>
              ))}
            </div>
            <span className={`${styles.cta} ${styles.save} ${pressed("save")}`}>
              {s.saved ? "✓ Saved to Photos" : s.saving ? <i className={styles.spinner} /> : "Save all 6 to your phone"}
            </span>
          </section>

          {/* 5. Proof of delivery, back with the creative */}
          <section className={styles.scene} data-shown={s.scene === "proof"} data-past={false}>
            <div className={`${styles.toast} ${s.proof > 0 ? styles.toastIn : ""}`}>
              <LogoMark className={styles.toastMark} />
              <span>
                <b>Kemi saved all 6 photos</b>
                <br />
                Spring Lookbook · just now
              </span>
            </div>
            <p className={styles.heading}>Spring Lookbook</p>
            <span className={styles.badge}>Delivered</span>
            <ol className={styles.timeline}>
              {[
                ["Sent", "Link copied", "09:12"],
                ["Opened", "On iPhone", "09:40"],
                ["Downloaded", "All 6 photos", "09:41"],
              ].map(([what, detail, when], index) => (
                <li key={what} data-on={s.proof > index}>
                  <i />
                  <span>
                    <b>{what}</b>
                    <br />
                    {detail}
                  </span>
                  <time>{when}</time>
                </li>
              ))}
            </ol>
          </section>

          {!still && (
            <div
              className={`${styles.cursor} ${s.cursor.shown ? "" : styles.cursorHidden} ${s.cursor.down ? styles.cursorDown : ""}`}
              style={{ left: `${s.cursor.x}%`, top: `${s.cursor.y}%` }}
            >
              <span key={s.ripple} className={s.ripple ? styles.ripple : ""} />
              <svg viewBox="0 0 24 24">
                <path d="M5 3.2v15.6l4.3-4.1 2.7 6.1 2.9-1.3-2.7-6h6z" />
              </svg>
            </div>
          )}
        </div>
      </Phone>
    </div>
  );
}
