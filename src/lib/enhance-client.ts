// Browser side of the free enhancer. The picture is cut into tiles and upscaled 4x by the model in
// public/enhance-worker.js; this file feeds it a photo and turns what comes back into a JPEG.
import { BLURRY_BELOW, CHECK_EDGE, grayFrom, sharpness } from "./photo-check";

export type BrowserEngine = "gpu" | "cpu" | "";
// "download" counts bytes of the face model (first time only); "faces" counts faces; "enhance" counts tiles.
export type BrowserStage = "loading" | "enhance" | "download" | "faces";
export type BrowserProgress = { done: number; total: number; engine: BrowserEngine; stage?: BrowserStage };
// faces is how many faces were rebuilt; faceProblem says why face repair was skipped when it failed.
export type BrowserResult = { blob: Blob; faces: number; faceProblem?: string };

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

// Where the eyes, nose tip and mouth corners sit in the 512 x 512 face the repair model expects (the FFHQ layout).
const FACE_TEMPLATE = [
  [0.37691676, 0.46864664],
  [0.62285697, 0.46912813],
  [0.50123859, 0.61331904],
  [0.39308822, 0.725411],
  [0.61150205, 0.72490465],
].map(([x, y]) => [x * 512, y * 512]);
const FACE_SIDE = 512;
const DETECT_SIDE = 640;
const MAX_FACES = 4;
// Faces whose eyes are closer than this (in the working picture) are too small to be worth rebuilding.
const MIN_EYE_GAP = 8;

// The least-squares rotation, scale and shift that carries the five found points onto the template. Returned as
// canvas transform numbers: x' = a x - b y + e, y' = b x + a y + f.
type Similarity = { a: number; b: number; e: number; f: number };
function similarity(points: number[]): Similarity {
  let mx = 0;
  let my = 0;
  let tx = 0;
  let ty = 0;
  for (let n = 0; n < 5; n++) {
    mx += points[n * 2] / 5;
    my += points[n * 2 + 1] / 5;
    tx += FACE_TEMPLATE[n][0] / 5;
    ty += FACE_TEMPLATE[n][1] / 5;
  }
  let dot = 0;
  let cross = 0;
  let norm = 0;
  for (let n = 0; n < 5; n++) {
    const x = points[n * 2] - mx;
    const y = points[n * 2 + 1] - my;
    const u = FACE_TEMPLATE[n][0] - tx;
    const v = FACE_TEMPLATE[n][1] - ty;
    dot += x * u + y * v;
    cross += x * v - y * u;
    norm += x * x + y * y;
  }
  const a = dot / norm;
  const b = cross / norm;
  return { a, b, e: tx - (a * mx - b * my), f: ty - (b * mx + a * my) };
}

// A face canvas whose edges fade out, so the rebuilt face blends into the picture around it.
function featheredFace(pixels: ArrayBuffer): HTMLCanvasElement {
  const data = new Uint8ClampedArray(pixels);
  const hard = 24;
  const ramp = 72;
  for (let y = 0; y < FACE_SIDE; y++) {
    for (let x = 0; x < FACE_SIDE; x++) {
      const edge = Math.min(x, y, FACE_SIDE - 1 - x, FACE_SIDE - 1 - y);
      const t = Math.min(1, Math.max(0, (edge - hard) / ramp));
      data[(y * FACE_SIDE + x) * 4 + 3] = 255 * t * t * (3 - 2 * t);
    }
  }
  const face = drawable(FACE_SIDE, FACE_SIDE);
  face.context.putImageData(new ImageData(data, FACE_SIDE, FACE_SIDE), 0, 0);
  return face.canvas;
}

type Reply = { type: string; [key: string]: unknown };

// One conversation with the worker: each request waits for its answer, and progress messages go straight to the page.
// A worker-reported error fails only the request it belongs to; a crash or a cancel fails everything after it.
function connect(worker: Worker, signal: AbortSignal, onEvent: (data: Reply) => void) {
  let pending: { want: string; resolve: (data: Reply) => void; reject: (error: Error) => void } | null = null;
  let broken: Error | null = null;
  const breakWith = (error: Error) => {
    broken = error;
    pending?.reject(error);
    pending = null;
  };
  worker.onmessage = (event: MessageEvent<Reply>) => {
    const data = event.data;
    if (data.type === "progress" || data.type === "download") return onEvent(data);
    if (data.type === "error") {
      pending?.reject(new Error(String(data.message)));
      pending = null;
    } else if (pending && data.type === pending.want) {
      const answer = pending;
      pending = null;
      answer.resolve(data);
    }
  };
  worker.onerror = (event) => {
    const detail = [event.message, event.filename && `in ${event.filename}`].filter(Boolean).join(" ");
    breakWith(new Error(`The enhancer could not start in this browser${detail ? ` (${detail})` : ""}.`));
  };
  signal.addEventListener("abort", () => breakWith(new DOMException("Cancelled", "AbortError")), { once: true });
  return (message: Reply, want: string, transfer: Transferable[] = []) =>
    new Promise<Reply>((resolve, reject) => {
      if (broken) return reject(broken);
      if (signal.aborted) return reject(new DOMException("Cancelled", "AbortError"));
      pending = { want, resolve, reject };
      worker.postMessage(message, transfer);
    });
}

const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

export async function enhanceInBrowser(
  source: Blob,
  options: { onProgress: (progress: BrowserProgress) => void; signal: AbortSignal; sharpen?: boolean; faces?: boolean },
): Promise<BrowserResult> {
  const { onProgress, signal, sharpen } = options;
  const bitmap = await createImageBitmap(source);

  // The fast set-up (graphics chip, several threads) is tried first. If the worker cannot start or fails before the
  // picture is done, it is tried once more in safe mode: processor only, one thread.
  const attempt = async (safe: boolean) => {
    const worker = new Worker(safe ? "/enhance-worker.js?safe=1" : "/enhance-worker.js");
    let engine: BrowserEngine = "";
    const ask = connect(worker, signal, (data) => {
      if (data.type === "progress") {
        engine = data.engine as BrowserEngine;
        onProgress({ done: Number(data.done), total: Number(data.total), engine, stage: "enhance" });
      } else onProgress({ done: Number(data.loaded), total: Number(data.total), engine, stage: "download" });
    });
    try {
      onProgress({ done: 0, total: 0, engine: "", stage: "loading" });
      const ready = await ask({ type: "init" }, "ready");
      engine = ready.engine as BrowserEngine;

      // The photo is sized to this device; everything below works on this one picture.
      const budget = pixelBudget(Number(ready.msPerTile));
      const shrink = Math.min(1, Math.sqrt(budget / (bitmap.width * bitmap.height)));
      const width = Math.max(1, Math.round(bitmap.width * shrink));
      const height = Math.max(1, Math.round(bitmap.height * shrink));
      const working = drawable(width, height);
      working.context.imageSmoothingQuality = "high";
      working.context.drawImage(bitmap, 0, 0, width, height);

      // Faces are looked for first (it takes a moment), so a failure there never costs the enhanced picture.
      let found: { points: number[] }[] = [];
      let faceProblem: string | undefined;
      if (options.faces) {
        try {
          const scale = DETECT_SIDE / Math.max(width, height);
          const letterbox = drawable(DETECT_SIDE, DETECT_SIDE);
          letterbox.context.drawImage(working.canvas, 0, 0, width * scale, height * scale);
          const square = letterbox.context.getImageData(0, 0, DETECT_SIDE, DETECT_SIDE);
          const answer = await ask({ type: "detect", pixels: square.data.buffer }, "faces", [square.data.buffer]);
          found = (answer.faces as { points: number[] }[])
            .map((face) => ({ points: face.points.map((value) => value / scale) }))
            .filter((face) => Math.hypot(face.points[2] - face.points[0], face.points[3] - face.points[1]) >= MIN_EYE_GAP)
            .slice(0, MAX_FACES);
        } catch (error) {
          if (isAbort(error) || signal.aborted) throw error;
          faceProblem = "Faces could not be looked for on this device.";
        }
      }

      const pixels = working.context.getImageData(0, 0, width, height);
      const result = await ask({ type: "run", width, height, pixels: pixels.data.buffer }, "done", [pixels.data.buffer]);

      // Each face is turned upright and scaled into the model's square, rebuilt, and remembered with its transform.
      const restored: { at: Similarity; pixels: ArrayBuffer }[] = [];
      for (const [index, face] of found.entries()) {
        try {
          onProgress({ done: index, total: found.length, engine, stage: "faces" });
          const at = similarity(face.points);
          const crop = drawable(FACE_SIDE, FACE_SIDE);
          crop.context.imageSmoothingQuality = "high";
          crop.context.setTransform(at.a, at.b, -at.b, at.a, at.e, at.f);
          crop.context.drawImage(working.canvas, 0, 0);
          const square = crop.context.getImageData(0, 0, FACE_SIDE, FACE_SIDE);
          const answer = await ask({ type: "restore", pixels: square.data.buffer }, "restored", [square.data.buffer]);
          restored.push({ at, pixels: answer.pixels as ArrayBuffer });
        } catch (error) {
          if (isAbort(error) || signal.aborted) throw error;
          faceProblem = "Face repair did not run on this device, so only the enhance was applied.";
          break;
        }
      }
      return { result: result as unknown as { width: number; height: number; pixels: ArrayBuffer }, restored, faceProblem };
    } finally {
      worker.terminate();
    }
  };

  try {
    let outcome;
    try {
      outcome = await attempt(false);
    } catch (error) {
      if (signal.aborted || isAbort(error)) throw error;
      outcome = await attempt(true);
    }
    const { result, restored, faceProblem } = outcome;

    const output = drawable(result.width, result.height);
    const bytes = new Uint8ClampedArray(result.pixels);
    if (sharpen) sharpenPixels(bytes, result.width, result.height);
    output.context.putImageData(new ImageData(bytes, result.width, result.height), 0, 0);

    // Rebuilt faces go back where they came from, at the enhanced size: the inverse of each face's transform, times 4.
    const scale = 4; // the enhancer always makes the picture four times bigger
    output.context.imageSmoothingQuality = "high";
    for (const { at, pixels } of restored) {
      const det = at.a * at.a + at.b * at.b;
      output.context.setTransform(
        (scale * at.a) / det,
        (scale * -at.b) / det,
        (scale * at.b) / det,
        (scale * at.a) / det,
        (scale * -(at.a * at.e + at.b * at.f)) / det,
        (scale * (at.b * at.e - at.a * at.f)) / det,
      );
      output.context.drawImage(featheredFace(pixels), 0, 0);
    }
    output.context.setTransform(1, 0, 0, 1, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) => output.canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) throw new Error("The enhanced picture could not be saved.");
    return { blob, faces: restored.length, faceProblem };
  } finally {
    bitmap.close();
  }
}
