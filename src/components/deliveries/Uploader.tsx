"use client";

import { useCallback, useRef, useState } from "react";
import { abortUpload, beginUpload, completeUpload } from "@/lib/upload-actions";
import { formatSize, storageLimits } from "@/lib/storage-limits";
import styles from "./Editor.module.css";

type Target = { sectionId: string; fileId?: string };

type Job = {
  id: string;
  name: string;
  size: number;
  loaded: number;
  error: string | null;
  controller: AbortController;
};

class UploadError extends Error {}

const FILES_AT_ONCE = 3;
const PARTS_AT_ONCE = 3;
const PART_ATTEMPTS = 3;

function put(url: string, body: Blob, contentType: string | null, signal: AbortSignal, onProgress: (loaded: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    if (contentType) request.setRequestHeader("Content-Type", contentType);
    request.upload.onprogress = (event) => onProgress(event.loaded);
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new UploadError(`Storage refused the upload (${request.status}).`));
    };
    request.onerror = () => reject(new UploadError("The connection dropped."));
    const cancel = () => {
      request.abort();
      reject(new DOMException("Cancelled", "AbortError"));
    };
    if (signal.aborted) return cancel();
    signal.addEventListener("abort", cancel, { once: true });
    request.send(body);
  });
}

async function putPart(url: string, body: Blob, signal: AbortSignal, onProgress: (loaded: number) => void) {
  for (let attempt = 1; ; attempt++) {
    try {
      onProgress(0);
      return await put(url, body, null, signal, onProgress);
    } catch (error) {
      if (signal.aborted || attempt >= PART_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

async function uploadParts(
  file: File,
  parts: { number: number; url: string; size: number }[],
  signal: AbortSignal,
  onProgress: (loaded: number) => void,
) {
  const loaded = new Array<number>(parts.length).fill(0);
  let next = 0;
  let offset = 0;
  const offsets = parts.map((part) => {
    const start = offset;
    offset += part.size;
    return start;
  });
  const worker = async () => {
    while (next < parts.length) {
      const index = next++;
      const part = parts[index];
      const body = file.slice(offsets[index], offsets[index] + part.size);
      await putPart(part.url, body, signal, (bytes) => {
        loaded[index] = bytes;
        onProgress(loaded.reduce((sum, value) => sum + value, 0));
      });
      loaded[index] = part.size;
      onProgress(loaded.reduce((sum, value) => sum + value, 0));
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARTS_AT_ONCE, parts.length) }, worker));
}

async function uploadFile(file: File, target: Target, signal: AbortSignal, onProgress: (loaded: number) => void) {
  const begin = await beginUpload({
    sectionId: target.sectionId,
    fileId: target.fileId,
    name: file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
  });
  if (!begin.ok) throw new UploadError(begin.error);
  try {
    if (begin.singleUrl) await put(begin.singleUrl, file, begin.contentType, signal, onProgress);
    else await uploadParts(file, begin.parts, signal, onProgress);
    const finished = await completeUpload(begin.fileId);
    if (!finished.ok) throw new UploadError(finished.error);
  } catch (error) {
    await abortUpload(begin.fileId).catch(() => undefined);
    throw error;
  }
}

function useUploads() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const running = useRef(0);
  const waiting = useRef<(() => void)[]>([]);

  const patch = useCallback((id: string, change: Partial<Job>) => {
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, ...change } : job)));
  }, []);

  const remove = useCallback((id: string) => setJobs((current) => current.filter((job) => job.id !== id)), []);

  const start = useCallback(
    (files: File[], target: Target) => {
      for (const file of files) {
        const job: Job = {
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          loaded: 0,
          error: null,
          controller: new AbortController(),
        };
        setJobs((current) => [...current, job]);

        if (file.size < 1) {
          patch(job.id, { error: "This file is empty." });
          continue;
        }
        if (file.size > storageLimits.maxFileBytes) {
          patch(job.id, { error: `Files can be up to ${formatSize(storageLimits.maxFileBytes)} for now.` });
          continue;
        }

        const run = async () => {
          running.current++;
          try {
            await uploadFile(file, target, job.controller.signal, (loaded) => patch(job.id, { loaded }));
            remove(job.id);
          } catch (error) {
            if (job.controller.signal.aborted) remove(job.id);
            else patch(job.id, { error: error instanceof UploadError ? error.message : "The upload failed. Try again." });
          } finally {
            running.current--;
            waiting.current.shift()?.();
          }
        };
        if (running.current < FILES_AT_ONCE) void run();
        else waiting.current.push(() => void run());
      }
    },
    [patch, remove],
  );

  return { jobs, start, remove };
}

function JobList({ jobs, onDismiss }: { jobs: Job[]; onDismiss: (id: string) => void }) {
  if (jobs.length === 0) return null;
  return (
    <ul className={styles.jobs} aria-label="Uploads">
      {jobs.map((job) => (
        <li key={job.id} className={styles.job}>
          <div className={styles.jobTop}>
            <span className={styles.jobName}>{job.name}</span>
            {job.error ? (
              <button type="button" className={styles.jobButton} onClick={() => onDismiss(job.id)}>
                Dismiss
              </button>
            ) : (
              <button type="button" className={styles.jobButton} onClick={() => job.controller.abort()}>
                Cancel
              </button>
            )}
          </div>
          {job.error ? (
            <p role="alert" className={styles.jobError}>
              {job.error}
            </p>
          ) : (
            <>
              <progress className={styles.bar} value={job.loaded} max={job.size} aria-label={`Uploading ${job.name}`} />
              <p className={styles.jobMeta}>
                {formatSize(Math.min(job.loaded, job.size))} of {formatSize(job.size)}
              </p>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

// Add files to a section: drop them on the box or choose them. Files go straight to storage from the browser.
export function SectionUploader({ sectionId, storageReady }: { sectionId: string; storageReady: boolean }) {
  const { jobs, start, remove } = useUploads();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  if (!storageReady) {
    return <p className={styles.empty}>File uploads switch on as soon as file storage is connected.</p>;
  }

  return (
    <div className={styles.uploader}>
      <div
        className={`${styles.drop} ${over ? styles.dropOver : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          start(Array.from(event.dataTransfer.files), { sectionId });
        }}
      >
        <p className={styles.dropText}>Drop files here</p>
        <button type="button" className={`${styles.button} ${styles.add}`} onClick={() => input.current?.click()}>
          + Add files
        </button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          onChange={(event) => {
            start(Array.from(event.currentTarget.files ?? []), { sectionId });
            event.currentTarget.value = "";
          }}
        />
      </div>
      <JobList jobs={jobs} onDismiss={remove} />
    </div>
  );
}

// The foot of a file row: its status, then Replace or Attach, then whatever the server passes in (Remove).
// Replacing keeps the row's name and note, and the old file stays live until the new one is checked.
export function FileFooter({
  sectionId,
  fileId,
  attached,
  storageReady,
  status,
  children,
}: {
  sectionId: string;
  fileId: string;
  attached: boolean;
  storageReady: boolean;
  status: string;
  children: React.ReactNode;
}) {
  const { jobs, start, remove } = useUploads();
  const input = useRef<HTMLInputElement>(null);
  const busy = jobs.some((job) => !job.error);
  return (
    <>
      <div className={styles.fileFoot}>
        <span className={styles.fileMeta}>{status}</span>
        <div className={styles.fileActions}>
          {storageReady && (
            <>
              <button
                type="button"
                className={`${styles.button} ${styles.secondary}`}
                onClick={() => input.current?.click()}
                disabled={busy}
              >
                {attached ? "Replace file" : "Attach file"}
              </button>
              <input
                ref={input}
                type="file"
                hidden
                onChange={(event) => {
                  start(Array.from(event.currentTarget.files ?? []).slice(0, 1), { sectionId, fileId });
                  event.currentTarget.value = "";
                }}
              />
            </>
          )}
          {children}
        </div>
      </div>
      <JobList jobs={jobs} onDismiss={remove} />
    </>
  );
}
