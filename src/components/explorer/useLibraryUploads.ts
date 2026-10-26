"use client";

import { useCallback, useRef, useState } from "react";
import { abortLibraryUpload, beginLibraryUpload, completeLibraryUpload } from "@/lib/library-actions";
import { formatSize, storageLimits } from "@/lib/storage-limits";
import { makeThumbnail, put, uploadParts, UploadError } from "../deliveries/Uploader";

export type UploadJob = {
  id: string;
  name: string;
  size: number;
  loaded: number;
  error: string | null;
  done: boolean;
  controller: AbortController;
};

export type UploadTarget = { folderId: string | null; collectionId?: string | null };

const FILES_AT_ONCE = 3;

async function send(file: File, target: UploadTarget, signal: AbortSignal, onProgress: (loaded: number) => void) {
  const thumbnail = (await makeThumbnail(file)).thumb;
  if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
  const begin = await beginLibraryUpload({
    folderId: target.folderId,
    collectionId: target.collectionId ?? null,
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
        if (signal.aborted) throw error;
      }
    }
    if (begin.singleUrl) await put(begin.singleUrl, file, begin.contentType, signal, onProgress);
    else await uploadParts(file, begin.parts, signal, onProgress);
    const finished = await completeLibraryUpload(begin.fileId);
    if (!finished.ok) throw new UploadError(finished.error);
  } catch (error) {
    await abortLibraryUpload(begin.fileId).catch(() => undefined);
    throw error;
  }
}

// Uploads into Memo Explorer: three files at a time, each straight to storage, the rest waiting their turn.
export function useLibraryUploads() {
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const running = useRef(0);
  const waiting = useRef<(() => void)[]>([]);

  const patch = useCallback((id: string, change: Partial<UploadJob>) => {
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, ...change } : job)));
  }, []);

  const start = useCallback(
    (files: File[], target: UploadTarget) => {
      for (const file of files) {
        const job: UploadJob = {
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          loaded: 0,
          error: null,
          done: false,
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
            await send(file, target, job.controller.signal, (loaded) => patch(job.id, { loaded }));
            patch(job.id, { done: true, loaded: file.size });
          } catch (error) {
            if (job.controller.signal.aborted) setJobs((current) => current.filter((item) => item.id !== job.id));
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
    [patch],
  );

  const cancel = useCallback((id: string) => {
    setJobs((current) => {
      current.find((job) => job.id === id)?.controller.abort();
      return current.filter((job) => job.id !== id);
    });
  }, []);

  const clearFinished = useCallback(() => setJobs((current) => current.filter((job) => !job.done && !job.error)), []);

  return { jobs, start, cancel, clearFinished };
}
