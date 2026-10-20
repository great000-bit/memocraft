"use client";

import { useEffect, useState } from "react";
import type { BrowserStage } from "@/lib/enhance-client";
import styles from "./EnhanceStatus.module.css";

const WORDS = [
  "Actioning",
  "Newspapering",
  "Cleaning film",
  "Developing",
  "Dusting the lens",
  "Pulling focus",
  "Coaxing out detail",
  "Taming the grain",
  "Printing proofs",
  "Polishing pixels",
  "Darkroom work",
  "Spotting dust",
  "Tuning contrast",
  "Sharpening up",
];
const SWAP_MS = 1800;

// The line shown while a photo is being enhanced: a playful word that changes every couple of seconds, a shimmer
// across it, and the share done. Without a total yet (the model is still loading) the bar just keeps moving.
export function EnhanceStatus({
  done,
  total,
  saving,
  waiting,
  stage,
}: {
  done: number;
  total: number;
  saving?: boolean;
  waiting?: boolean;
  stage?: BrowserStage;
}) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * WORDS.length));
  useEffect(() => {
    const timer = setInterval(() => setIndex((current) => (current + 1) % WORDS.length), SWAP_MS);
    return () => clearInterval(timer);
  }, []);
  // Faces are few, so their count would sit at 0% and jump; the bar just keeps moving instead.
  const percent = total && !waiting && stage !== "faces" ? Math.round((done / total) * 100) : null;
  const label = saving
    ? "Saving"
    : stage === "download"
      ? "Downloading face repair, first time only"
      : stage === "faces"
        ? "Rebuilding faces"
        : total || waiting
          ? WORDS[index]
          : "Loading the enhancer";
  return (
    <div className={styles.status} aria-live="polite">
      <p className={styles.line}>
        <span className={styles.spark} aria-hidden="true">
          ✦
        </span>
        <span key={label} className={styles.word}>
          {label}…
        </span>
        {percent !== null && !saving && <span className={styles.percent}>{percent}%</span>}
      </p>
      <span className={styles.track} aria-hidden="true">
        <span className={styles.fill} data-moving={percent === null || saving ? "" : undefined} style={percent === null || saving ? undefined : { width: `${percent}%` }} />
      </span>
    </div>
  );
}
