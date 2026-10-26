"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { batchTargets, canSaveToPhone, prepareFile, shareFiles, type SaveTarget, type ShareResult } from "@/lib/save-to-phone";
import styles from "./ClientView.module.css";

const noopSubscribe = () => () => {};

type State =
  | { phase: "idle" }
  | { phase: "preparing"; done: number }
  | { phase: "ready" }
  | { phase: "saved" }
  | { phase: "error"; message: string };

const useFallback = "Use Download instead.";

// Saves files to the phone's photo library through the share sheet. The files are fetched first and then
// offered together; a long delivery goes in batches, one tap each. Nothing shows on a computer or in a
// browser without file sharing, so the plain Download button is all anyone sees there.
// With an icon it is a small round button on a picture: the words go to its label, and if saving fails the file is
// downloaded instead, as there is no room for an error under it.
export function SaveToPhone({
  targets,
  label,
  disabled = false,
  className,
  icon,
}: {
  targets: SaveTarget[];
  label: string;
  disabled?: boolean;
  className: string;
  icon?: React.ReactNode;
}) {
  const canSave = useSyncExternalStore(noopSubscribe, canSaveToPhone, () => false);
  const batches = useMemo(() => batchTargets(targets), [targets]);
  const [batchIndex, setBatchIndex] = useState(0);
  const [state, setState] = useState<State>({ phase: "idle" });
  const prepared = useRef<File[]>([]);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  if (!canSave || batches.length === 0) return null;
  if (disabled) {
    return (
      <span className={`${className} ${styles.downloadOff}`} aria-disabled="true" aria-label={icon ? label : undefined} data-save>
        {icon ?? label}
      </span>
    );
  }

  const batch = batches[Math.min(batchIndex, batches.length - 1)];
  const lastBatch = batchIndex >= batches.length - 1;

  function fail(message: string) {
    if (icon && batch.length === 1) {
      setState({ phase: "idle" });
      window.location.assign(batch[0].url);
      return;
    }
    setState({ phase: "error", message });
  }

  function settle(result: ShareResult) {
    if (result === "cancelled") {
      setState({ phase: "ready" });
      return;
    }
    prepared.current = [];
    if (lastBatch) {
      setState({ phase: "saved" });
      setTimeout(() => {
        setBatchIndex(0);
        setState({ phase: "idle" });
      }, 2500);
    } else {
      setBatchIndex(batchIndex + 1);
      setState({ phase: "idle" });
    }
  }

  async function prepareAndShare() {
    const abort = new AbortController();
    controller.current = abort;
    setState({ phase: "preparing", done: 0 });
    try {
      const files: File[] = [];
      for (const target of batch) {
        files.push(await prepareFile(target, abort.signal));
        setState({ phase: "preparing", done: files.length });
      }
      prepared.current = files;
      if (!navigator.canShare({ files })) {
        fail(`This phone cannot save these here. ${useFallback}`);
        return;
      }
      const result = await shareFiles(files);
      if (result === "blocked") setState({ phase: "ready" });
      else settle(result);
    } catch (error) {
      if (abort.signal.aborted) return;
      console.warn("Could not prepare files to save", error);
      fail(`Could not get ${batch.length === 1 ? "this file" : "these files"}. ${useFallback}`);
    }
  }

  async function shareReady() {
    try {
      const result = await shareFiles(prepared.current);
      if (result === "blocked") fail(`Your phone would not open the save menu. ${useFallback}`);
      else settle(result);
    } catch (error) {
      console.warn("Could not open the save menu", error);
      fail(`Your phone would not open the save menu. ${useFallback}`);
    }
  }

  const many = batch.length > 1;
  const status =
    state.phase === "preparing"
      ? many
        ? `Getting ${Math.min(state.done + 1, batch.length)} of ${batch.length}…`
        : "Getting it ready…"
      : state.phase === "ready"
        ? many
          ? `Tap to save ${batch.length}`
          : "Tap to save"
        : state.phase === "saved"
          ? "Done"
          : state.phase === "error"
            ? "Try again"
            : batchIndex > 0
              ? `Save next ${batch.length}`
              : label;

  return (
    <span className={styles.saveWrap}>
      <button
        type="button"
        className={className}
        data-save
        data-phase={state.phase}
        aria-busy={state.phase === "preparing"}
        aria-label={icon ? status : undefined}
        title={icon ? status : undefined}
        disabled={state.phase === "preparing" || state.phase === "saved"}
        onClick={() => (state.phase === "ready" ? shareReady() : prepareAndShare())}
      >
        {icon ?? status}
      </button>
      {state.phase === "error" && (
        <span role="alert" className={styles.saveError}>
          {state.message}
        </span>
      )}
    </span>
  );
}
