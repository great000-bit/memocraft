"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FeatureIcon } from "../FeatureIcons";
import { abortUpload, beginUpload, completeUpload } from "@/lib/upload-actions";
import { CHECK_EDGE, grayFrom, photoNotes, sharpness } from "@/lib/photo-check";
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
  // A small picture of the file, once it has been made, so the card shows what is being uploaded.
  preview: string | null;
  // True until one of the upload slots is free for this file.
  waiting: boolean;
};

// What the quality check said about a picture that has been dropped, kept after its upload card has gone.
type Note = { id: string; name: string; notes: string[] };

export type Picture = { thumb: Blob | null; notes: string[] };

export class UploadError extends Error {}

const FILES_AT_ONCE = 3;
const PARTS_AT_ONCE = 3;
const PART_ATTEMPTS = 3;

const THUMB_EDGE = 480;
// Pictures bigger than this are not decoded just to make a preview.
const THUMB_SOURCE_MAX_BYTES = 80 * 1024 * 1024;

let thumbQueue: Promise<unknown> = Promise.resolve();

// Measures the picture at check size. A picture that cannot be read is simply not judged.
function checkPicture(bitmap: ImageBitmap, type: string): string[] {
  try {
    const scale = Math.min(1, CHECK_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return [];
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const gray = grayFrom(context.getImageData(0, 0, width, height).data, width, height);
    return photoNotes(type, bitmap.width, bitmap.height, sharpness(gray, width, height));
  } catch {
    return [];
  }
}

// Never rejects: a picture the browser cannot decode simply has no preview and no notes.
async function renderThumbnail(file: File): Promise<Picture> {
  const none: Picture = { thumb: null, notes: [] };
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml" || file.size > THUMB_SOURCE_MAX_BYTES) return none;
  try {
    const bitmap = await createImageBitmap(file);
    const notes = checkPicture(bitmap, file.type);
    const scale = Math.min(1, THUMB_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return { thumb: null, notes };
    }
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    for (const quality of [0.8, 0.6, 0.4]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= storageLimits.thumbMaxBytes) return { thumb: blob, notes };
    }
    return { thumb: null, notes };
  } catch {
    return none;
  }
}

// One picture is decoded at a time, so dropping hundreds does not hold hundreds of decoded images in memory.
export function makeThumbnail(file: File): Promise<Picture> {
  const next = thumbQueue.then(() => renderThumbnail(file));
  thumbQueue = next;
  return next;
}

export function put(url: string, body: Blob, contentType: string | null, signal: AbortSignal, onProgress: (loaded: number) => void) {
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

export async function uploadParts(
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

async function uploadFile(
  file: File,
  target: Target,
  signal: AbortSignal,
  onProgress: (loaded: number) => void,
  preview: Promise<Picture>,
) {
  const thumbnail = (await preview).thumb;
  if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
  const begin = await beginUpload({
    sectionId: target.sectionId,
    fileId: target.fileId,
    name: file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
    thumbSize: thumbnail?.size,
  });
  if (!begin.ok) throw new UploadError(begin.error);
  try {
    if (thumbnail && begin.thumbUrl) {
      try {
        await put(begin.thumbUrl, thumbnail, "image/jpeg", signal, () => undefined);
      } catch (error) {
        // The preview is a bonus. Only a cancel stops the upload; the server drops a preview that did not arrive.
        if (signal.aborted) throw error;
      }
    }
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
  const [notes, setNotes] = useState<Note[]>([]);
  const running = useRef(0);
  const waiting = useRef<(() => void)[]>([]);
  const previews = useRef(new Map<string, string>());
  // Jobs still on the page, so a picture that finishes after its card is gone is not kept.
  const alive = useRef(new Set<string>());

  useEffect(() => {
    const urls = previews.current;
    const live = alive.current;
    return () => {
      for (const url of urls.values()) URL.revokeObjectURL(url);
      urls.clear();
      live.clear();
    };
  }, []);

  const patch = useCallback((id: string, change: Partial<Job>) => {
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, ...change } : job)));
  }, []);

  const remove = useCallback((id: string) => {
    alive.current.delete(id);
    const url = previews.current.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      previews.current.delete(id);
    }
    setJobs((current) => current.filter((job) => job.id !== id));
  }, []);

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
          preview: null,
          waiting: true,
        };
        alive.current.add(job.id);
        setJobs((current) => [...current, job]);

        if (file.size < 1) {
          patch(job.id, { error: "This file is empty." });
          continue;
        }
        if (file.size > storageLimits.maxFileBytes) {
          patch(job.id, { error: `Files can be up to ${formatSize(storageLimits.maxFileBytes)} for now.` });
          continue;
        }

        // Pictures are made for every dropped file straight away, one at a time, so the cards fill with
        // what is being uploaded even while most of them wait for a free slot.
        const picture = makeThumbnail(file);
        void picture.then(({ thumb, notes: found }) => {
          if (!alive.current.has(job.id)) return;
          if (found.length > 0) setNotes((current) => [...current, { id: job.id, name: file.name, notes: found }]);
          if (!thumb) return;
          const url = URL.createObjectURL(thumb);
          previews.current.set(job.id, url);
          patch(job.id, { preview: url });
        });

        const run = async () => {
          running.current++;
          patch(job.id, { waiting: false });
          try {
            await uploadFile(file, target, job.controller.signal, (loaded) => patch(job.id, { loaded }), picture);
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

  const dismissNote = useCallback((id: string) => {
    setNotes((current) => current.filter((note) => note.id !== id));
  }, []);

  return { jobs, start, remove, notes, dismissNote };
}

// What the quality check found, shown to the creative only. It stays after the upload finishes, until dismissed,
// because the file uploads either way: it is a nudge to check, never a block.
function QualityNotes({ notes, onDismiss }: { notes: Note[]; onDismiss: (id: string) => void }) {
  if (notes.length === 0) return null;
  return (
    <div className={styles.checkNotes} role="status">
      <p className={styles.checkTitle}>
        {notes.length === 1 ? "1 picture to check" : `${notes.length} pictures to check`}
        <span className={styles.checkHint}> Only you see this.</span>
      </p>
      <ul className={styles.checkList}>
        {notes.map((note) => (
          <li key={note.id} className={styles.checkItem}>
            <div className={styles.checkBody}>
              <span className={styles.jobName}>{note.name}</span>
              {note.notes.map((line) => (
                <span key={line} className={styles.checkLine}>
                  {line}
                </span>
              ))}
            </div>
            <button type="button" className={styles.jobButton} onClick={() => onDismiss(note.id)}>
              OK
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Thumb({ src }: { src: string | null }) {
  return (
    <span className={styles.thumb}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- a local preview or a signed storage link, not a site asset
        <img src={src} alt="" />
      ) : (
        <FeatureIcon name="file" />
      )}
    </span>
  );
}

// In a card of its own for new files; "inline" is the slim version shown inside a file card while it is replaced.
function JobCards({ jobs, onDismiss, inline }: { jobs: Job[]; onDismiss: (id: string) => void; inline?: boolean }) {
  if (jobs.length === 0) return null;
  const active = jobs.filter((job) => !job.error).length;
  return (
    <div className={styles.queue}>
      {active > 0 && !inline && (
        <p className={styles.queueTitle} aria-live="polite">
          Uploading {active} {active === 1 ? "file" : "files"}…
        </p>
      )}
      <ul className={inline ? styles.jobs : styles.fileList} aria-label="Uploads">
        {jobs.map((job) => (
          <li key={job.id} className={inline ? styles.job : `${styles.file} ${styles.fileBusy}`}>
            {!inline && <Thumb src={job.preview} />}
            <div className={styles.fileBody}>
              <div className={styles.jobTop}>
                <span className={styles.jobName}>{job.name}</span>
                {job.error ? (
                  <button type="button" className={styles.jobButton} onClick={() => onDismiss(job.id)}>
                    Dismiss
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.jobButton}
                    onClick={() => {
                      job.controller.abort();
                      // A file still waiting for a slot has nothing to stop, so its card goes now.
                      if (job.waiting) onDismiss(job.id);
                    }}
                  >
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
                    {job.waiting
                      ? `Waiting · ${formatSize(job.size)}`
                      : `${formatSize(Math.min(job.loaded, job.size))} of ${formatSize(job.size)}`}
                  </p>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// The place files are added: a big box to drop on or click, then the files already here (passed in as children),
// then the uploads in progress. Every dropped file becomes its own card. Files go straight to storage.
export function UploadArea({
  sectionId,
  storageReady,
  hasFiles,
  children,
}: {
  sectionId: string;
  storageReady: boolean;
  hasFiles: boolean;
  children: React.ReactNode;
}) {
  const { jobs, start, remove, notes, dismissNote } = useUploads();
  const [over, setOver] = useState(false);
  const compact = hasFiles || jobs.length > 0;

  return (
    <div className={styles.area}>
      {storageReady ? (
        <label
          className={styles.drop}
          data-size={compact ? "small" : "big"}
          data-over={over ? "true" : undefined}
          onDragOver={(event) => {
            event.preventDefault();
            setOver(true);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setOver(false);
            start(Array.from(event.dataTransfer.files), { sectionId });
          }}
        >
          <input
            type="file"
            multiple
            className={styles.dropInput}
            onChange={(event) => {
              start(Array.from(event.currentTarget.files ?? []), { sectionId });
              event.currentTarget.value = "";
            }}
          />
          <span className={styles.dropIcon} aria-hidden="true">
            <FeatureIcon name="upload" />
          </span>
          <span className={styles.dropText}>
            <span className={styles.dropTitle}>{compact ? "Add more files" : "Drop your photos and files here"}</span>
            {!compact && (
              <span className={styles.dropHint}>
                Add as many as you like at once. Each one gets its own card, so you can name it.
              </span>
            )}
          </span>
          <span className={`${styles.button} ${styles.primary} ${styles.dropButton}`}>Choose files</span>
        </label>
      ) : (
        // The box is still drawn so the page looks the same; it just cannot take files until storage is connected.
        <div className={styles.drop} data-size={hasFiles ? "small" : "big"} data-off="true" aria-disabled="true">
          <span className={styles.dropIcon} aria-hidden="true">
            <FeatureIcon name="upload" />
          </span>
          <span className={styles.dropText}>
            <span className={styles.dropTitle}>File uploads switch on soon</span>
            <span className={styles.dropHint}>
              This box takes your photos and files as soon as file storage is connected.
            </span>
          </span>
        </div>
      )}
      <QualityNotes notes={notes} onDismiss={dismissNote} />
      {children}
      <JobCards jobs={jobs} onDismiss={remove} />
    </div>
  );
}

// The foot of a file card: its details, then Replace or Attach, then whatever the server passes in (Remove).
// Replacing keeps the card's name and note, and the old file stays live until the new one is checked.
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
  const { jobs, start, remove, notes, dismissNote } = useUploads();
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
                className={`${styles.button} ${styles.ghost}`}
                onClick={() => input.current?.click()}
                disabled={busy}
              >
                {attached ? "Replace" : "Attach file"}
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
      <JobCards jobs={jobs} onDismiss={remove} inline />
      <QualityNotes notes={notes} onDismiss={dismissNote} />
    </>
  );
}
