"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  checkEnhance,
  enhanceCompareUrls,
  finishBrowserEnhance,
  prepareBrowserEnhance,
  removeEnhanced,
  repairWithGeminiAction,
  startEnhance,
  type EnhanceState,
} from "@/lib/enhance-actions";
import { enhanceInBrowser, loadSource, looksBlurry, type BrowserProgress } from "@/lib/enhance-client";
import { EnhanceStatus } from "@/components/EnhanceStatus";
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
  allowance: { used: number; limit: number; server: boolean; gemini: boolean; geminiLeft: number };
}) {
  const router = useRouter();
  const [state, setState] = useState<EnhanceState>(initial);
  const [faces, setFaces] = useState(true);
  const [faceNote, setFaceNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [compare, setCompare] = useState<{ before: string; after: string } | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  // The free enhancer works inside this tab: `working` is set from the first step until the copy is saved.
  const [working, setWorking] = useState<(BrowserProgress & { saving: boolean }) | null>(null);
  const cancel = useRef<AbortController | null>(null);
  // Set when the photo is too soft for the model to help much: the creative decides whether to carry on.
  const [blurry, setBlurry] = useState(false);
  const [repairing, setRepairing] = useState(false);

  useEffect(() => () => cancel.current?.abort(), []);

  async function runInBrowser(options: { skipCheck?: boolean; sharpen?: boolean } = {}) {
    const controller = new AbortController();
    cancel.current = controller;
    setBlurry(false);
    setWorking({ done: 0, total: 0, engine: "", saving: false });
    setState({ state: "none" });
    try {
      const source = await loadSource(`/api/enhance/source/${fileId}`, controller.signal);
      if (!options.skipCheck && (await looksBlurry(source).catch(() => false))) {
        setBlurry(true);
        return;
      }
      const { blob, faces: rebuilt, faceProblem } = await enhanceInBrowser(source, {
        signal: controller.signal,
        faces,
        sharpen: options.sharpen,
        onProgress: (progress) => setWorking({ ...progress, saving: false }),
      });
      setWorking((current) => (current ? { ...current, saving: true } : current));
      setFaceNote(faceProblem ?? (rebuilt ? `Rebuilt ${rebuilt === 1 ? "1 face" : `${rebuilt} faces`}. Check it before you send it.` : null));
      const upload = await prepareBrowserEnhance(fileId, blob.size);
      if (!upload.ok) throw new Error(upload.error);
      const put = await fetch(upload.url, { method: "PUT", body: blob, headers: { "Content-Type": "image/jpeg" }, signal: controller.signal });
      if (!put.ok) throw new Error("The enhanced copy did not upload. Try again.");
      const next = await finishBrowserEnhance(fileId, upload.key);
      setState(next);
      router.refresh();
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setState({ state: "failed", error: error instanceof Error ? error.message : "Something went wrong. Try again." });
      }
    } finally {
      cancel.current = null;
      setWorking(null);
    }
  }

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

  async function repairWithGemini() {
    setRepairing(true);
    setState({ state: "none" });
    try {
      const next = await repairWithGeminiAction(fileId);
      setState(next);
      if (next.state !== "running") router.refresh();
    } catch {
      setState({ state: "failed", error: "Something went wrong. Try again in a moment." });
    } finally {
      setRepairing(false);
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
          {faceNote && <p className={styles.enhanceHint}>{faceNote}</p>}
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
      ) : repairing ? (
        <>
          <EnhanceStatus done={0} total={0} waiting />
          <p className={styles.enhanceHint}>Keep this tab open. This usually takes 10 to 30 seconds.</p>
        </>
      ) : working ? (
        <>
          <EnhanceStatus done={working.done} total={working.total} saving={working.saving} stage={working.stage} />
          {!working.saving && (
            <>
              <p className={styles.enhanceHint}>
                Keep this tab open. It takes about a minute.
              </p>
              <div className={styles.enhanceActions}>
                <button type="button" className={`${styles.button} ${styles.ghost}`} onClick={() => cancel.current?.abort()}>
                  Cancel
                </button>
              </div>
            </>
          )}
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
              disabled={busy}
              onClick={() => runInBrowser()}
            >
              <span aria-hidden="true">✦</span> Enhance with AI
            </button>
            <label className={styles.enhanceFaces}>
              <input type="checkbox" checked={faces} onChange={(event) => setFaces(event.currentTarget.checked)} />
              Repair faces
            </label>
            {allowance.gemini && (
              <button
                type="button"
                className={`${styles.button} ${styles.secondary}`}
                disabled={busy || allowance.geminiLeft === 0}
                onClick={repairWithGemini}
              >
                Repair faces with Memocraft
              </button>
            )}
            {allowance.server && (
              <>
                <button
                  type="button"
                  className={`${styles.button} ${styles.secondary}`}
                  disabled={busy || left === 0}
                  onClick={() => run(() => startEnhance(fileId, faces))}
                >
                  {busy ? "Starting…" : "Use the server model"}
                </button>
              </>
            )}
          </div>
          <p className={styles.enhanceHint}>
            Free. Makes a soft or small photo sharper and bigger, on your own device, so the photo stays with you. Repair
            faces rebuilds blurry faces (a 170 MB download the first time). Your original stays as it is.
            {allowance.server ? (left === 0 ? " No server enhances left this month." : ` ${left} of ${allowance.limit} server enhances left this month.`) : ""}
          </p>
          {allowance.gemini && (
            <p className={styles.enhanceHint}>
              Repair faces with Memocraft sends this photo to our cloud AI (run by Google) and redraws it, so a face can look different from the
              real person. Check it before you send it. {allowance.geminiLeft} left this month.
            </p>
          )}
          {blurry && (
            <div role="alert" className={styles.enhanceHint}>
              <p>
                This photo is out of focus. Repair faces rebuilds the faces in it, but the rest of the photo stays soft:
                nothing can bring back a missed focus. Sharpening helps a little.
              </p>
              <div className={styles.enhanceActions}>
                <button type="button" className={`${styles.button} ${styles.secondary}`} onClick={() => runInBrowser({ skipCheck: true, sharpen: true })}>
                  Enhance and sharpen
                </button>
                <button type="button" className={`${styles.button} ${styles.ghost}`} onClick={() => runInBrowser({ skipCheck: true })}>
                  Enhance anyway
                </button>
                <button type="button" className={`${styles.button} ${styles.ghost}`} onClick={() => setBlurry(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
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
