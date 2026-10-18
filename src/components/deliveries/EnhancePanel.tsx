"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { checkEnhance, enhanceCompareUrls, removeEnhanced, startEnhance, type EnhanceState } from "@/lib/enhance-actions";
import { formatSize } from "@/lib/storage-limits";
import styles from "./Editor.module.css";

const POLL_MS = 3000;

// AI enhance on one photo card: start it, watch it run, then compare, keep or remove the enhanced copy. The
// original is never changed, and clients get the enhanced copy labelled as such. The editor keys this panel by the
// server's state, so a refresh after another tab's change starts it fresh.
export function EnhancePanel({
  fileId,
  initial,
  allowance,
}: {
  fileId: string;
  initial: EnhanceState;
  allowance: { used: number; limit: number };
}) {
  const router = useRouter();
  const [state, setState] = useState<EnhanceState>(initial);
  const [faces, setFaces] = useState(false);
  const [busy, setBusy] = useState(false);
  const [compare, setCompare] = useState<{ before: string; after: string } | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);

  useEffect(() => {
    if (state.state !== "running") return;
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const next = await checkEnhance(fileId);
        if (stopped || next.state === "running") return;
        setState(next);
        router.refresh();
      } catch {
        // A dropped check is tried again on the next tick.
      }
    }, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [state.state, fileId, router]);

  async function run(action: () => Promise<EnhanceState>) {
    setBusy(true);
    try {
      const next = await action();
      setState(next);
      if (next.state !== "running") router.refresh();
    } catch {
      setState({ state: "failed", error: "Something went wrong. Try again in a moment." });
    } finally {
      setBusy(false);
    }
  }

  async function openCompare() {
    setCompareError(null);
    const result = await enhanceCompareUrls(fileId).catch(() => null);
    if (result?.ok) setCompare({ before: result.before, after: result.after });
    else setCompareError(result?.error ?? "Could not load the pictures. Try again.");
  }

  const left = Math.max(0, allowance.limit - allowance.used);

  return (
    <div className={styles.enhance}>
      {state.state === "ready" ? (
        <>
          <p className={styles.enhanceTitle}>
            <span className={styles.enhanceSpark} aria-hidden="true">
              ✦
            </span>
            Enhanced copy ready · {formatSize(state.bytes)}
          </p>
          <p className={styles.enhanceHint}>Your client gets this copy, marked Enhanced. They can still download the original.</p>
          <div className={styles.enhanceActions}>
            <button type="button" className={`${styles.button} ${styles.secondary}`} onClick={openCompare}>
              Compare
            </button>
            <button
              type="button"
              className={`${styles.button} ${styles.ghost}`}
              disabled={busy}
              onClick={() => run(() => removeEnhanced(fileId))}
            >
              Send the original instead
            </button>
          </div>
          {compareError && <p className={styles.jobError}>{compareError}</p>}
        </>
      ) : state.state === "running" ? (
        <p className={styles.enhanceTitle} aria-live="polite">
          <span className={styles.enhanceSpin} aria-hidden="true" />
          Enhancing… this usually takes under a minute.
        </p>
      ) : (
        <>
          <div className={styles.enhanceActions}>
            <button
              type="button"
              className={`${styles.button} ${styles.enhanceButton}`}
              disabled={busy || left === 0}
              onClick={() => run(() => startEnhance(fileId, faces))}
            >
              <span aria-hidden="true">✦</span> {busy ? "Starting…" : "Enhance with AI"}
            </button>
            <label className={styles.enhanceFaces}>
              <input type="checkbox" checked={faces} onChange={(event) => setFaces(event.currentTarget.checked)} />
              Repair faces
            </label>
          </div>
          <p className={styles.enhanceHint}>
            Makes a soft or small photo sharper and bigger. Your original stays as it is.{" "}
            {left === 0 ? "No enhances left this month." : `${left} of ${allowance.limit} left this month.`}
          </p>
          {state.state === "failed" && (
            <p role="alert" className={styles.jobError}>
              {state.error}
            </p>
          )}
        </>
      )}
      {compare && <Compare before={compare.before} after={compare.after} onClose={() => setCompare(null)} />}
    </div>
  );
}

// Before and after on top of each other; the slider shows more of one or the other.
function Compare({ before, after, onClose }: { before: string; after: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [split, setSplit] = useState(50);

  useEffect(() => {
    const node = dialog.current;
    if (node && !node.open) node.showModal();
  }, []);

  return (
    <dialog ref={dialog} className={styles.compare} onClose={onClose} aria-label="Before and after">
      <div className={styles.compareFrame}>
        {/* eslint-disable-next-line @next/next/no-img-element -- signed storage links, not site assets */}
        <img src={after} alt="Enhanced" className={styles.compareImage} referrerPolicy="no-referrer" />
        {/* eslint-disable-next-line @next/next/no-img-element -- signed storage links, not site assets */}
        <img
          src={before}
          alt="Original"
          className={styles.compareImage}
          style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
          referrerPolicy="no-referrer"
        />
        <span className={styles.compareLabel} data-side="before">
          Original
        </span>
        <span className={styles.compareLabel} data-side="after">
          Enhanced
        </span>
        <span className={styles.compareLine} style={{ left: `${split}%` }} aria-hidden="true" />
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={split}
        onChange={(event) => setSplit(Number(event.currentTarget.value))}
        className={styles.compareSlider}
        aria-label="Show more of the original or the enhanced copy"
      />
      <button type="button" className={`${styles.button} ${styles.secondary}`} onClick={() => dialog.current?.close()}>
        Close
      </button>
    </dialog>
  );
}
