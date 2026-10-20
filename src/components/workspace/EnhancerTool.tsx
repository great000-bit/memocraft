"use client";

import { useEffect, useRef, useState } from "react";
import { enhanceInBrowser, looksBlurry, type BrowserProgress } from "@/lib/enhance-client";
import { EnhanceStatus } from "@/components/EnhanceStatus";
import { formatSize } from "@/lib/storage-limits";
import ed from "@/components/deliveries/Editor.module.css";
import styles from "./Enhancer.module.css";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 40 * 1024 * 1024;

type Result = { before: string; after: string; blob: Blob; name: string };

// The standalone Enhancer: pick any photo, it is made sharper and bigger inside this tab (nothing is uploaded), then
// compare and save it. Delivery photos have the same tool on their card; this one is for any picture on the device.
export function EnhancerTool() {
  const input = useRef<HTMLInputElement>(null);
  const cancel = useRef<AbortController | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [blurry, setBlurry] = useState(false);
  const [working, setWorking] = useState<BrowserProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [split, setSplit] = useState(50);
  const [over, setOver] = useState(false);

  useEffect(() => () => cancel.current?.abort(), []);
  useEffect(
    () => () => {
      if (result) {
        URL.revokeObjectURL(result.before);
        URL.revokeObjectURL(result.after);
      }
    },
    [result],
  );

  function choose(file: File | undefined) {
    if (!file) return;
    setResult(null);
    setError(null);
    setBlurry(false);
    if (!ACCEPT.split(",").includes(file.type)) return setError("Choose a JPG, PNG or WebP photo.");
    if (file.size > MAX_BYTES) return setError("That photo is over 40 MB. Choose a smaller one.");
    setPhoto(file);
    looksBlurry(file)
      .then(setBlurry)
      .catch(() => setError("That photo could not be read."));
  }

  async function run(sharpen: boolean) {
    if (!photo) return;
    const controller = new AbortController();
    cancel.current = controller;
    setBlurry(false);
    setError(null);
    setWorking({ done: 0, total: 0, engine: "" });
    try {
      const blob = await enhanceInBrowser(photo, { signal: controller.signal, sharpen, onProgress: setWorking });
      setResult({ before: URL.createObjectURL(photo), after: URL.createObjectURL(blob), blob, name: photo.name });
      setSplit(50);
    } catch (problem) {
      if (!(problem instanceof DOMException && problem.name === "AbortError")) {
        setError(problem instanceof Error ? problem.message : "Something went wrong. Try again.");
      }
    } finally {
      cancel.current = null;
      setWorking(null);
    }
  }

  function save() {
    if (!result) return;
    const link = document.createElement("a");
    link.href = result.after;
    link.download = `${result.name.replace(/\.[^.]+$/, "")}-enhanced.jpg`;
    link.click();
  }

  return (
    <div className={styles.tool}>
      {result ? (
        <>
          <div className={ed.compareFrame}>
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URLs */}
            <img src={result.after} alt="Enhanced" className={ed.compareImage} />
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URLs */}
            <img src={result.before} alt="Original" className={ed.compareImage} style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }} />
            <span className={ed.compareLabel} data-side="before">
              Original
            </span>
            <span className={ed.compareLabel} data-side="after">
              Enhanced
            </span>
            <span className={ed.compareLine} style={{ left: `${split}%` }} aria-hidden="true" />
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={split}
            onChange={(event) => setSplit(Number(event.currentTarget.value))}
            className={ed.compareSlider}
            aria-label="Show more of the original or the enhanced copy"
          />
          <div className={ed.enhanceActions}>
            <button type="button" className={`${ed.button} ${ed.enhanceButton}`} onClick={save}>
              Save enhanced photo · {formatSize(result.blob.size)}
            </button>
            <button type="button" className={`${ed.button} ${ed.ghost}`} onClick={() => input.current?.click()}>
              Choose another photo
            </button>
          </div>
        </>
      ) : working ? (
        <>
          <EnhanceStatus done={working.done} total={working.total} />
          <p className={ed.enhanceHint}>
            Keep this tab open. It takes about a minute.
          </p>
          <div className={ed.enhanceActions}>
            <button type="button" className={`${ed.button} ${ed.ghost}`} onClick={() => cancel.current?.abort()}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <button
            type="button"
            className={styles.drop}
            data-over={over || undefined}
            onClick={() => input.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setOver(false);
              choose(event.dataTransfer.files[0]);
            }}
          >
            <span className={styles.dropTitle}>{photo ? photo.name : "Drop a photo here, or choose one"}</span>
            <span className={ed.enhanceHint}>{photo ? formatSize(photo.size) : "JPG, PNG or WebP, up to 40 MB"}</span>
          </button>
          {blurry && (
            <p role="alert" className={ed.enhanceHint}>
              This photo is out of focus. The enhancer cleans up noise and adds detail, but it cannot bring back a missed
              focus, so the change may be small. Sharpening helps a little.
            </p>
          )}
          {photo && (
            <div className={ed.enhanceActions}>
              <button type="button" className={`${ed.button} ${ed.enhanceButton}`} onClick={() => run(blurry)}>
                <span aria-hidden="true">✦</span> {blurry ? "Enhance and sharpen" : "Enhance with AI"}
              </button>
              {blurry && (
                <button type="button" className={`${ed.button} ${ed.ghost}`} onClick={() => run(false)}>
                  Enhance anyway
                </button>
              )}
            </div>
          )}
          {error && (
            <p role="alert" className={ed.jobError}>
              {error}
            </p>
          )}
        </>
      )}
      <input ref={input} type="file" accept={ACCEPT} hidden onChange={(event) => { choose(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
    </div>
  );
}
