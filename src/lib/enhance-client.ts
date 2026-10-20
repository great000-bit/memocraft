// Browser side of the free enhancer. The picture is cut into tiles and upscaled 4x by the model in
// public/enhance-worker.js; this file feeds it a photo and turns what comes back into a JPEG.
import { BLURRY_BELOW, CHECK_EDGE, grayFrom, sharpness } from "./photo-check";

export type BrowserEngine = "gpu" | "cpu" | "";
export type BrowserProgress = { done: number; total: number; engine: BrowserEngine };

const JPEG_QUALITY = 0.92;

function drawable(width: number, height: number): { context: CanvasRenderingContext2D; canvas: HTMLCanvasElement } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("This browser cannot work on pictures.");
  return { context, canvas };
}

// The photo is sized so the whole run takes about TARGET_MS on this device, from the time the worker measured for one
// tile. Without a measurement the cautious size is used. The server never sends more than SOURCE_PIXELS.
const TARGET_MS = 50_000;
const TILE_PIXELS = 192 * 192;
const MIN_PIXELS = 200_000;
const SOURCE_PIXELS = 800_000;
const CAUTIOUS_PIXELS = 400_000;

function pixelBudget(msPerTile: number): number {
  if (!(msPerTile > 0)) return CAUTIOUS_PIXELS;
  const pixels = (TARGET_MS / msPerTile) * TILE_PIXELS;
  return Math.max(MIN_PIXELS, Math.min(SOURCE_PIXELS, pixels));
}

export async function loadSource(sourceUrl: string, signal: AbortSignal): Promise<Blob> {
  const response = await fetch(sourceUrl, { signal, cache: "no-store" });
  if (!response.ok) throw new Error(response.status === 413 ? "This photo is too large to enhance." : "The photo could not be loaded.");
  return response.blob();
}

// True when the photo is so soft that the model, which cleans noise and adds detail but cannot undo a missed focus,
// will change little. Uses the same measure as the check made when a photo is dropped into a delivery.
export async function looksBlurry(photo: Blob): Promise<boolean> {
  const bitmap = await createImageBitmap(photo);
  try {
    const scale = Math.min(1, CHECK_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const { context } = drawable(width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const { data } = context.getImageData(0, 0, width, height);
    return sharpness(grayFrom(data, width, height), width, height) < BLURRY_BELOW;
  } finally {
    bitmap.close();
  }
}

// Unsharp mask: adds back the difference between each pixel and a small box blur of its neighbourhood, which gives
// edges the bite a soft photo lacks. Done in place on RGBA bytes, row by row so it stays fast on a 12 MP result.
export function sharpenPixels(data: Uint8ClampedArray, width: number, height: number, amount = 0.8, radius = 3) {
  const span = radius * 2 + 1;
  const clamp = (value: number, max: number) => (value < 0 ? 0 : value > max ? max : value);
  const flat = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let channel = 0; channel < 3; channel++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += data[row + clamp(k, width - 1) * 4 + channel];
      for (let x = 0; x < width; x++) {
        flat[row + x * 4 + channel] = sum / span;
        sum += data[row + clamp(x + radius + 1, width - 1) * 4 + channel] - data[row + clamp(x - radius, width - 1) * 4 + channel];
      }
    }
  }
  const sums = new Int32Array(width * 3);
  for (let k = -radius; k <= radius; k++) {
    const row = clamp(k, height - 1) * width * 4;
    for (let x = 0; x < width; x++) for (let c = 0; c < 3; c++) sums[x * 3 + c] += flat[row + x * 4 + c];
  }
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 3; c++) {
        const at = row + x * 4 + c;
        data[at] = data[at] + amount * (data[at] - sums[x * 3 + c] / span);
      }
    }
    const add = clamp(y + radius + 1, height - 1) * width * 4;
    const drop = clamp(y - radius, height - 1) * width * 4;
    for (let x = 0; x < width; x++) for (let c = 0; c < 3; c++) sums[x * 3 + c] += flat[add + x * 4 + c] - flat[drop + x * 4 + c];
  }
}

export async function enhanceInBrowser(
  source: Blob,
  options: { onProgress: (progress: BrowserProgress) => void; signal: AbortSignal; sharpen?: boolean },
): Promise<Blob> {
  const { onProgress, signal, sharpen } = options;
  const bitmap = await createImageBitmap(source);

  // The fast set-up (graphics chip, several threads) is tried first. If the worker cannot start or fails before it
  // runs, it is tried once more in safe mode: processor only, one thread.
  const attempt = async (safe: boolean) => {
    const worker = new Worker(safe ? "/enhance-worker.js?safe=1" : "/enhance-worker.js");
    try {
      return await new Promise<{ width: number; height: number; pixels: ArrayBuffer }>((resolve, reject) => {
        const stop = () => reject(new DOMException("Cancelled", "AbortError"));
        if (signal.aborted) return stop();
        signal.addEventListener("abort", stop, { once: true });
        worker.onmessage = (event: MessageEvent) => {
          const data = event.data;
          if (data.type === "ready") {
            // The model is loaded: now the photo is sized to this device and sent over.
            const budget = pixelBudget(data.msPerTile);
            const shrink = Math.min(1, Math.sqrt(budget / (bitmap.width * bitmap.height)));
            const width = Math.max(1, Math.round(bitmap.width * shrink));
            const height = Math.max(1, Math.round(bitmap.height * shrink));
            const input = drawable(width, height);
            input.context.imageSmoothingQuality = "high";
            input.context.drawImage(bitmap, 0, 0, width, height);
            const pixels = input.context.getImageData(0, 0, width, height);
            onProgress({ done: 0, total: 0, engine: data.engine });
            worker.postMessage({ type: "run", width, height, pixels: pixels.data.buffer }, [pixels.data.buffer]);
          } else if (data.type === "progress") onProgress({ done: data.done, total: data.total, engine: data.engine });
          else if (data.type === "done") resolve(data);
          else if (data.type === "error") reject(new Error(data.message));
        };
        worker.onerror = (event) => {
          const detail = [event.message, event.filename && `in ${event.filename}`].filter(Boolean).join(" ");
          reject(new Error(`The enhancer could not start in this browser${detail ? ` (${detail})` : ""}.`));
        };
        worker.postMessage({ type: "init" });
      });
    } finally {
      worker.terminate();
    }
  };

  try {
    let result;
    try {
      result = await attempt(false);
    } catch (error) {
      if (signal.aborted || (error instanceof DOMException && error.name === "AbortError")) throw error;
      onProgress({ done: 0, total: 0, engine: "cpu" });
      result = await attempt(true);
    }

    const output = drawable(result.width, result.height);
    const bytes = new Uint8ClampedArray(result.pixels);
    if (sharpen) sharpenPixels(bytes, result.width, result.height);
    output.context.putImageData(new ImageData(bytes, result.width, result.height), 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => output.canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) throw new Error("The enhanced picture could not be saved.");
    return blob;
  } finally {
    bitmap.close();
  }
}
