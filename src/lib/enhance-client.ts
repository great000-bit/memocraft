// Browser side of the free enhancer. The picture is cut into tiles and upscaled 4x by the model in
// public/enhance-worker.js; this file feeds it a photo and turns what comes back into a JPEG.

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

export async function enhanceInBrowser(
  sourceUrl: string,
  options: { onProgress: (progress: BrowserProgress) => void; signal: AbortSignal },
): Promise<Blob> {
  const { onProgress, signal } = options;
  const response = await fetch(sourceUrl, { signal, cache: "no-store" });
  if (!response.ok) throw new Error(response.status === 413 ? "This photo is too large to enhance." : "The photo could not be loaded.");
  const bitmap = await createImageBitmap(await response.blob());
  const input = drawable(bitmap.width, bitmap.height);
  input.context.drawImage(bitmap, 0, 0);
  const pixels = input.context.getImageData(0, 0, bitmap.width, bitmap.height);
  bitmap.close();

  const result = await new Promise<{ width: number; height: number; pixels: ArrayBuffer }>((resolve, reject) => {
    const worker = new Worker("/enhance-worker.js");
    const stop = () => {
      worker.terminate();
      reject(new DOMException("Cancelled", "AbortError"));
    };
    if (signal.aborted) return stop();
    signal.addEventListener("abort", stop, { once: true });
    worker.onmessage = (event: MessageEvent) => {
      const data = event.data;
      if (data.type === "progress") onProgress({ done: data.done, total: data.total, engine: data.engine });
      else if (data.type === "done") {
        signal.removeEventListener("abort", stop);
        worker.terminate();
        resolve(data);
      } else if (data.type === "error") {
        signal.removeEventListener("abort", stop);
        worker.terminate();
        reject(new Error(data.message));
      }
    };
    worker.onerror = () => {
      signal.removeEventListener("abort", stop);
      worker.terminate();
      reject(new Error("The enhancer could not start in this browser."));
    };
    worker.postMessage({ type: "run", width: pixels.width, height: pixels.height, pixels: pixels.data.buffer }, [pixels.data.buffer]);
  });

  const output = drawable(result.width, result.height);
  output.context.putImageData(new ImageData(new Uint8ClampedArray(result.pixels), result.width, result.height), 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => output.canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  if (!blob) throw new Error("The enhanced picture could not be saved.");
  return blob;
}
