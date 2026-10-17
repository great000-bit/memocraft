// Saving straight to a phone's photo library goes through the share sheet, which only takes whole files in
// memory. These limits keep a long delivery from filling the phone: files are fetched and offered in batches.

export type SaveTarget = {
  id: string;
  // The name the file is saved under, with its extension.
  fileName: string;
  url: string;
  type: string;
  size: number;
};

export const saveLimits = {
  fileBytes: 64 * 1024 * 1024,
  batchFiles: 12,
  batchBytes: 120 * 1024 * 1024,
};

// Only what the photo library accepts. A PDF or a zip goes through Download as before.
const typeByExtension: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  avif: "image/avif",
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
};
const savableTypes = new Set(Object.values(typeByExtension));

export function saveType(mimeType: string | null, ext: string | null): string | null {
  const stored = mimeType?.toLowerCase() ?? "";
  if (savableTypes.has(stored)) return stored;
  return (ext && typeByExtension[ext.toLowerCase()]) || null;
}

export function batchTargets(targets: SaveTarget[]): SaveTarget[][] {
  const batches: SaveTarget[][] = [];
  let current: SaveTarget[] = [];
  let bytes = 0;
  for (const target of targets) {
    const full = current.length >= saveLimits.batchFiles || (current.length > 0 && bytes + target.size > saveLimits.batchBytes);
    if (full) {
      batches.push(current);
      current = [];
      bytes = 0;
    }
    current.push(target);
    bytes += target.size;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

function detectSaveToPhone(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return false;
  if (!window.matchMedia("(pointer: coarse)").matches) return false;
  try {
    return navigator.canShare({ files: [new File([""], "check.jpg", { type: "image/jpeg" })] });
  } catch {
    return false;
  }
}

let supported: boolean | undefined;

// Browser only. A computer's share menu has nothing to do with a photo library, so only touch screens qualify.
// The answer is worked out once, so buttons never come and go when a mouse is plugged in or the window resizes.
export function canSaveToPhone(): boolean {
  supported ??= detectSaveToPhone();
  return supported;
}

export async function prepareFile(target: SaveTarget, signal: AbortSignal): Promise<File> {
  const response = await fetch(target.url, { signal, credentials: "omit" });
  if (!response.ok) throw new Error(`The file answered ${response.status}`);
  const blob = await response.blob();
  const type = blob.type && blob.type !== "application/octet-stream" ? blob.type : target.type;
  return new File([blob], target.fileName, { type });
}

export type ShareResult = "shared" | "cancelled" | "blocked";

// "blocked" means the phone wanted a fresh tap: the fetch took long enough that the first one expired.
export async function shareFiles(files: File[]): Promise<ShareResult> {
  try {
    await navigator.share({ files });
    return "shared";
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    if (name === "AbortError") return "cancelled";
    if (name === "NotAllowedError") return "blocked";
    throw error;
  }
}
