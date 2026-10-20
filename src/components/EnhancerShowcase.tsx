"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { photos } from "./photos";
import styles from "./EnhancerShowcase.module.css";

type Phase = "waiting" | "finding" | "rebuilding" | "done";

const phaseLabel: Record<Phase, string> = {
  waiting: "Ready",
  finding: "Finding faces",
  rebuilding: "Rebuilding the face",
  done: "1 face rebuilt, 4x sharper",
};

// The landing page's before and after: a real soft photo and what the free enhancer made of it. Scrolling it into view
// plays the run once (the line sweeps across while the face is found and rebuilt), then the line is the visitor's to
// drag. Reduced motion skips the run and starts half way.
export function EnhancerShowcase({ heading: Heading = "h2" }: { heading?: "h1" | "h2" }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("waiting");
  const [pos, setPos] = useState(50);
  const touched = useRef(false);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const set = (value: number) => stage.style.setProperty("--pos", `${value}%`);
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!still) set(100);
    let frame = 0;
    const timers: number[] = [];
    const run = () => {
      if (still || touched.current) {
        setPhase("done");
        return;
      }
      setPhase("finding");
      timers.push(
        window.setTimeout(() => {
          setPhase("rebuilding");
          const start = performance.now();
          // Across to the left edge, showing the whole result, then back to the middle.
          const tick = (now: number) => {
            if (touched.current) return;
            const t = (now - start) / 3200;
            const value = t < 0.62 ? 100 - 96 * ease(t / 0.62) : 4 + 46 * ease(Math.min(1, (t - 0.62) / 0.38));
            set(value);
            if (t < 1) frame = requestAnimationFrame(tick);
            else {
              setPos(50);
              setPhase("done");
            }
          };
          frame = requestAnimationFrame(tick);
        }, 1200),
      );
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          run();
        }
      },
      { threshold: 0.45 },
    );
    observer.observe(stage);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
    };
  }, []);

  const take = (value: number) => {
    touched.current = true;
    const clamped = Math.max(0, Math.min(100, value));
    stageRef.current?.style.setProperty("--pos", `${clamped}%`);
    setPos(Math.round(clamped));
    setPhase("done");
  };

  const fromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    take(((e.clientX - box.left) / box.width) * 100);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.copy}>
        <p className={styles.kicker}>
          <span className={styles.kickerDot} aria-hidden="true" />
          Free photo enhancer
        </p>
        <Heading className={styles.title}>
          Missed the focus?
          <span className={styles.titleAccent}> Keep the shot.</span>
        </Heading>
        <p className={styles.body}>
          Drop in a soft photo. Memocraft finds every face, rebuilds the detail and makes the whole picture four times
          bigger. It runs on your own device, so the photo never leaves it.
        </p>
        <dl className={styles.specs}>
          <div>
            <dt>4x</dt>
            <dd>the resolution</dd>
          </div>
          <div>
            <dt>Faces</dt>
            <dd>rebuilt one by one</dd>
          </div>
          <div>
            <dt>Free</dt>
            <dd>with every account</dd>
          </div>
        </dl>
        <Link className={styles.cta} href="/signup">
          Try the enhancer
          <span className={styles.ctaArrow} aria-hidden="true">
            &rarr;
          </span>
        </Link>
      </div>

      <div className={styles.stageWrap}>
        <div
          ref={stageRef}
          className={styles.stage}
          data-phase={phase}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            fromPointer(e);
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e);
          }}
        >
          <Image
            src={photos.portraitBefore.src}
            alt="The original portrait: soft and out of focus"
            fill
            sizes="(min-width: 960px) 560px, 92vw"
            className={styles.photo}
            draggable={false}
          />
          <div className={styles.after}>
            <Image
              src={photos.portraitAfter.src}
              alt="The same portrait, sharp, with clear eyes, curls and the knit of her sweater"
              fill
              sizes="(min-width: 960px) 560px, 92vw"
              className={styles.photo}
              draggable={false}
            />
          </div>
          <span className={styles.face} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <b>{phase === "finding" ? "Face found" : "Face rebuilt"}</b>
          </span>
          <span className={styles.scan} aria-hidden="true" />
          <span className={`${styles.tag} ${styles.tagBefore}`} aria-hidden="true">
            Before
          </span>
          <span className={`${styles.tag} ${styles.tagAfter}`} aria-hidden="true">
            Enhanced
          </span>
          <span className={styles.handle} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path d="M9 6 3 12l6 6M15 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <p className={styles.status} aria-live="polite">
            <span className={styles.statusSpark} aria-hidden="true">
              ✦
            </span>
            <span key={phase} className={styles.statusWord}>
              {phaseLabel[phase]}
            </span>
          </p>
          <input
            className={styles.range}
            type="range"
            min={0}
            max={100}
            value={pos}
            aria-label="Compare the original with the enhanced photo"
            onChange={(e) => take(Number(e.target.value))}
          />
        </div>
        <p className={styles.caption}>Drag to compare.</p>
      </div>
    </div>
  );
}

function ease(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
