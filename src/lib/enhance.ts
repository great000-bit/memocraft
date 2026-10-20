import sharp from "sharp";

// AI enhance: a photo is sent to an upscaling model on Replicate (Real-ESRGAN, optionally with GFPGAN face repair)
// and comes back larger and sharper. The original is never changed; the result is stored as a second copy.
//
//   REPLICATE_API_TOKEN        switches the feature on
//   REPLICATE_ENHANCE_VERSION  model version (defaults to a published nightmareai/real-esrgan version)
//   ENHANCE_MONTHLY_LIMIT      runs per account per calendar month (default 50)
//   REPLICATE_API_BASE         only for local tests against a fake server
const env = process.env;

const DEFAULT_VERSION = "f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa";

export const enhanceConfigured = () => Boolean(env.REPLICATE_API_TOKEN);
export const monthlyEnhanceLimit = () => Math.max(0, Number(env.ENHANCE_MONTHLY_LIMIT ?? 50) || 0);

// The model runs out of GPU memory a little above 2 megapixels, so bigger photos are scaled down first. For a blurry
// photo nothing real is lost: the model rebuilds the detail at the larger size.
const INPUT_MAX_PIXELS = 2_000_000;
// The in-browser model works on a smaller picture, so a phone can finish it. Four times this is the result (about 13 MP).
export const BROWSER_INPUT_MAX_PIXELS = 800_000;
// The result aims for this long edge, and never more than 16 megapixels.
const OUTPUT_LONG_EDGE = 4096;
const OUTPUT_MAX_PIXELS = 16_000_000;
// Originals bigger than this are not downloaded into the server to enhance.
export const ENHANCE_SOURCE_MAX_BYTES = 60 * 1024 * 1024;
export const ENHANCEABLE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/tiff"];

export type Prediction = {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output: string | string[] | null;
  error: string | null;
};

const api = (path: string) => `${env.REPLICATE_API_BASE || "https://api.replicate.com"}/v1${path}`;

async function call(path: string, init?: RequestInit): Promise<Prediction> {
  const response = await fetch(api(path), {
    ...init,
    headers: { Authorization: `Bearer ${env.REPLICATE_API_TOKEN}`, "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Replicate answered ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return (await response.json()) as Prediction;
}

// Starts a run and waits a little for it, so a warm model often answers in the same request.
export function startPrediction(imageUrl: string, scale: number, faces: boolean) {
  return call("/predictions", {
    method: "POST",
    headers: { Prefer: "wait=20" },
    body: JSON.stringify({ version: env.REPLICATE_ENHANCE_VERSION || DEFAULT_VERSION, input: { image: imageUrl, scale, face_enhance: faces } }),
  });
}

export const getPrediction = (id: string) => call(`/predictions/${encodeURIComponent(id)}`);

// The result is fetched by the server, so only Replicate's own file host is trusted (or the fake server in tests).
export function outputUrl(prediction: Prediction): string | null {
  const raw = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (typeof raw !== "string") return null;
  try {
    const url = new URL(raw);
    if (env.REPLICATE_API_BASE) return url.origin === new URL(env.REPLICATE_API_BASE).origin ? raw : null;
    return url.protocol === "https:" && (url.hostname === "replicate.delivery" || url.hostname.endsWith(".replicate.delivery"))
      ? raw
      : null;
  } catch {
    return null;
  }
}

// The picture the model is given: upright, at most 2 megapixels, as a high-quality JPEG. Also returns how much to
// scale it up so the result lands near 4096 px on its long edge.
export async function prepareInput(
  original: Uint8Array,
  maxPixels = INPUT_MAX_PIXELS,
): Promise<{ bytes: Uint8Array; scale: number; width: number; height: number }> {
  const image = sharp(original, { limitInputPixels: 300_000_000 }).rotate();
  const meta = await image.metadata();
  const upright = (meta.orientation ?? 1) >= 5;
  let width = (upright ? meta.height : meta.width) ?? 0;
  let height = (upright ? meta.width : meta.height) ?? 0;
  if (!width || !height) throw new Error("Could not read the picture size");
  const shrink = Math.min(1, Math.sqrt(maxPixels / (width * height)));
  width = Math.max(1, Math.floor(width * shrink));
  height = Math.max(1, Math.floor(height * shrink));
  const bytes = await image
    .resize(width, height, { fit: "fill" })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
    .toBuffer();
  const scale = Math.min(4, OUTPUT_LONG_EDGE / Math.max(width, height), Math.sqrt(OUTPUT_MAX_PIXELS / (width * height)));
  return { bytes: new Uint8Array(bytes), scale: Math.max(1, Math.round(scale * 10) / 10), width, height };
}

// The model answers with a large PNG; clients get a JPEG that looks the same and is a fraction of the size.
export async function finishOutput(png: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await sharp(png, { limitInputPixels: 100_000_000 }).jpeg({ quality: 90, mozjpeg: true }).toBuffer());
}

// What a failed run tells the creative. The model's own message is technical, so it stays in the logs.
export const enhanceFailure = "The enhance did not work on this photo. Your original is untouched. Try again, or try without face repair.";
