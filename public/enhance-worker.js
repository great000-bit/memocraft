// Runs the Real-ESRGAN photo upscaler (public/models/realesr-general-x4v3.onnx) inside the visitor's browser, so no
// photo leaves their device and nothing is paid per run. ONNX Runtime is served from /ort (copied there at install).
//
// The page first sends { type: "init" } and gets back { type: "ready", engine, threads, msPerTile }, so it can size
// the photo to what this device can do in about a minute (msPerTile is measured on a warm-up tile). Then it sends   { type: "run", width, height, pixels }   (RGBA bytes,
// transferred) and gets back    { type: "progress", done, total, engine }   as tiles finish,
//                  { type: "done", width, height, pixels, engine }   (4x larger RGBA bytes, transferred)
//                  { type: "error", message }
//
// Face repair (optional) adds two more requests:
//   { type: "detect", pixels }   a 640 x 640 RGBA picture   -> { type: "faces", faces: [{ score, box, points }] }
//   { type: "restore", pixels }  a 512 x 512 aligned face   -> { type: "restored", pixels }
// While the face model downloads (once; the browser keeps it) the worker sends { type: "download", loaded, total }.
//
// The picture is cut into square tiles with a little overlap, because the model only needs a neighbourhood to
// work from and a whole photo would not fit in memory. The overlap is cut away again, so tiles join without seams.
importScripts("/ort/ort.min.js");

const SCALE = 4;
const TILE = 192; // pixels of the picture each tile keeps
const PAD = 12; // extra pixels read around a tile, thrown away after
const SIDE = TILE + PAD * 2;

ort.env.wasm.wasmPaths = "/ort/";
// Several threads need the page to be cross-origin isolated (see next.config.ts); without that it is one thread.
// "?safe=1" is the page's second try after the first failed: processor only, one thread.
const safe = new URL(self.location.href).searchParams.has("safe");
const threads = !safe && self.crossOriginIsolated ? Math.max(1, Math.min(8, navigator.hardwareConcurrency || 2)) : 1;
ort.env.wasm.numThreads = threads;

let session = null;
let engine = "";
let modelBytes = null;

async function loadModel() {
  if (!modelBytes) {
    const response = await fetch("/models/realesr-general-x4v3.onnx");
    if (!response.ok) throw new Error(`The model did not load (${response.status})`);
    modelBytes = new Uint8Array(await response.arrayBuffer());
  }
  return modelBytes;
}

async function open(provider) {
  const next = await ort.InferenceSession.create(await loadModel(), {
    executionProviders: [provider],
    graphOptimizationLevel: "all",
  });
  session = next;
  engine = provider === "webgpu" ? "gpu" : "cpu";
}

// One tile of the picture as the model's input: values 0..1, channels first, edges repeated past the border.
function tileInput(pixels, width, height, x0, y0, out) {
  const plane = SIDE * SIDE;
  for (let y = 0; y < SIDE; y++) {
    const sy = Math.min(height - 1, Math.max(0, y0 - PAD + y));
    for (let x = 0; x < SIDE; x++) {
      const sx = Math.min(width - 1, Math.max(0, x0 - PAD + x));
      const from = (sy * width + sx) * 4;
      const to = y * SIDE + x;
      out[to] = pixels[from] / 255;
      out[plane + to] = pixels[from + 1] / 255;
      out[plane * 2 + to] = pixels[from + 2] / 255;
    }
  }
}

async function runTile(input) {
  const result = await session.run({ input: new ort.Tensor("float32", input, [1, 3, SIDE, SIDE]) });
  return result.output.data;
}

async function ensureSession() {
  if (session) return;
  try {
    if (safe || !self.navigator.gpu) throw new Error("no WebGPU");
    await open("webgpu");
  } catch {
    await open("wasm");
  }
}

// Times one tile on a plain grey picture, after one throwaway run that pays for start-up costs.
async function measureTile() {
  const input = new Float32Array(3 * SIDE * SIDE).fill(0.5);
  await runTile(input);
  const started = performance.now();
  await runTile(input);
  return performance.now() - started;
}

async function enhance({ width, height, pixels: buffer }) {
  const pixels = new Uint8ClampedArray(buffer);
  await ensureSession();

  const outWidth = width * SCALE;
  const outHeight = height * SCALE;
  const out = new Uint8ClampedArray(outWidth * outHeight * 4);
  out.fill(255);
  const input = new Float32Array(3 * SIDE * SIDE);
  const columns = Math.ceil(width / TILE);
  const rows = Math.ceil(height / TILE);
  const total = columns * rows;
  const outSide = SIDE * SCALE;
  const outPlane = outSide * outSide;
  let done = 0;

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x0 = column * TILE;
      const y0 = row * TILE;
      tileInput(pixels, width, height, x0, y0, input);
      let data;
      try {
        data = await runTile(input);
      } catch (error) {
        // A graphics chip that starts a tile and fails: carry on with the processor instead.
        if (engine !== "gpu") throw error;
        await open("wasm");
        data = await runTile(input);
      }
      const keepWidth = Math.min(TILE, width - x0) * SCALE;
      const keepHeight = Math.min(TILE, height - y0) * SCALE;
      for (let y = 0; y < keepHeight; y++) {
        const fromRow = (PAD * SCALE + y) * outSide + PAD * SCALE;
        const toRow = ((y0 * SCALE + y) * outWidth + x0 * SCALE) * 4;
        for (let x = 0; x < keepWidth; x++) {
          const to = toRow + x * 4;
          const from = fromRow + x;
          out[to] = data[from] * 255 + 0.5;
          out[to + 1] = data[outPlane + from] * 255 + 0.5;
          out[to + 2] = data[outPlane * 2 + from] * 255 + 0.5;
        }
      }
      done++;
      self.postMessage({ type: "progress", done, total, engine });
    }
  }
  self.postMessage({ type: "done", width: outWidth, height: outHeight, pixels: out.buffer, engine }, [out.buffer]);
}

// ---- Face repair -------------------------------------------------------------------------------------------------
// Faces are found with YuNet (OpenCV, MIT) and rebuilt with GFPGAN 1.4 (Tencent ARC, Apache-2.0, as converted to ONNX
// by the FaceFusion project). GFPGAN is stored with half-size weights in four parts, so no one file is too big to host.
const DETECT_SIDE = 640;
const FACE_SIDE = 512;
const FACE_PARTS = [0, 1, 2, 3].map((part) => `/models/face/gfpgan-1.4.onnx.part${part}`);
const FACE_BYTES = 170_305_426;
const MODEL_CACHE = "mc-face-models-1";
let detector = null;
let restorer = null;
let restorerEngine = "";

async function cachedBytes(url, onBytes) {
  let cache = null;
  try {
    cache = await caches.open(MODEL_CACHE);
    const hit = await cache.match(url);
    if (hit) {
      const bytes = new Uint8Array(await hit.arrayBuffer());
      onBytes(bytes.length);
      return bytes;
    }
  } catch {
    cache = null; // No cache storage (a private window, blocked site data): the model is downloaded each time.
  }
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`The face model did not load (${response.status})`);
  const chunks = [];
  let length = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    length += value.length;
    onBytes(value.length);
  }
  const bytes = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  if (cache) await cache.put(url, new Response(bytes, { headers: { "Content-Type": "application/octet-stream" } })).catch(() => {});
  return bytes;
}

async function ensureDetector() {
  if (detector) return;
  const response = await fetch("/models/face/yunet-2023mar.onnx");
  if (!response.ok) throw new Error(`The face finder did not load (${response.status})`);
  detector = await ort.InferenceSession.create(new Uint8Array(await response.arrayBuffer()), { executionProviders: ["wasm"] });
}

async function openRestorer(provider) {
  let loaded = 0;
  const parts = [];
  for (const url of FACE_PARTS) {
    parts.push(
      await cachedBytes(url, (count) => {
        loaded += count;
        self.postMessage({ type: "download", loaded: Math.min(loaded, FACE_BYTES), total: FACE_BYTES });
      }),
    );
  }
  const model = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    model.set(part, at);
    at += part.length;
  }
  restorer = await ort.InferenceSession.create(model, { executionProviders: [provider], graphOptimizationLevel: "all" });
  restorerEngine = provider === "webgpu" ? "gpu" : "cpu";
}

async function ensureRestorer() {
  if (restorer) return;
  try {
    if (safe || !self.navigator.gpu) throw new Error("no WebGPU");
    await openRestorer("webgpu");
  } catch {
    await openRestorer("wasm");
  }
}

// YuNet answers on three grids; each cell has a score, a box and five points (eyes, nose tip, mouth corners).
async function detect({ pixels: buffer }) {
  await ensureDetector();
  const pixels = new Uint8ClampedArray(buffer);
  const plane = DETECT_SIDE * DETECT_SIDE;
  const input = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    input[i] = pixels[i * 4 + 2]; // the model reads blue, green, red, 0 to 255
    input[plane + i] = pixels[i * 4 + 1];
    input[plane * 2 + i] = pixels[i * 4];
  }
  const result = await detector.run({ input: new ort.Tensor("float32", input, [1, 3, DETECT_SIDE, DETECT_SIDE]) });
  const found = [];
  for (const stride of [8, 16, 32]) {
    const columns = DETECT_SIDE / stride;
    const cls = result[`cls_${stride}`].data;
    const obj = result[`obj_${stride}`].data;
    const bbox = result[`bbox_${stride}`].data;
    const kps = result[`kps_${stride}`].data;
    for (let i = 0; i < cls.length; i++) {
      const score = Math.sqrt(Math.min(1, Math.max(0, cls[i])) * Math.min(1, Math.max(0, obj[i])));
      if (score < 0.6) continue;
      const row = Math.floor(i / columns);
      const column = i % columns;
      const cx = (column + bbox[i * 4]) * stride;
      const cy = (row + bbox[i * 4 + 1]) * stride;
      const w = Math.exp(bbox[i * 4 + 2]) * stride;
      const h = Math.exp(bbox[i * 4 + 3]) * stride;
      const points = [];
      for (let n = 0; n < 5; n++) points.push((kps[i * 10 + n * 2] + column) * stride, (kps[i * 10 + n * 2 + 1] + row) * stride);
      found.push({ score, box: [cx - w / 2, cy - h / 2, w, h], points });
    }
  }
  // Keep the best of each group of overlapping answers.
  found.sort((a, b) => b.score - a.score);
  const kept = [];
  for (const face of found) {
    const overlaps = kept.some((other) => {
      const [ax, ay, aw, ah] = face.box;
      const [bx, by, bw, bh] = other.box;
      const iw = Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx));
      const ih = Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by));
      const shared = iw * ih;
      return shared / (aw * ah + bw * bh - shared) > 0.3;
    });
    if (!overlaps) kept.push(face);
  }
  self.postMessage({ type: "faces", faces: kept });
}

async function restoreFace({ pixels: buffer }) {
  await ensureRestorer();
  const pixels = new Uint8ClampedArray(buffer);
  const plane = FACE_SIDE * FACE_SIDE;
  const input = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    input[i] = pixels[i * 4] / 127.5 - 1;
    input[plane + i] = pixels[i * 4 + 1] / 127.5 - 1;
    input[plane * 2 + i] = pixels[i * 4 + 2] / 127.5 - 1;
  }
  const tensor = new ort.Tensor("float32", input, [1, 3, FACE_SIDE, FACE_SIDE]);
  let output;
  try {
    output = (await restorer.run({ input: tensor })).output.data;
  } catch (error) {
    // A graphics chip that fails: carry on with the processor.
    if (restorerEngine !== "gpu") throw error;
    await openRestorer("wasm");
    output = (await restorer.run({ input: tensor })).output.data;
  }
  const out = new Uint8ClampedArray(plane * 4);
  for (let i = 0; i < plane; i++) {
    out[i * 4] = (Math.min(1, Math.max(-1, output[i])) + 1) * 127.5 + 0.5;
    out[i * 4 + 1] = (Math.min(1, Math.max(-1, output[plane + i])) + 1) * 127.5 + 0.5;
    out[i * 4 + 2] = (Math.min(1, Math.max(-1, output[plane * 2 + i])) + 1) * 127.5 + 0.5;
    out[i * 4 + 3] = 255;
  }
  self.postMessage({ type: "restored", pixels: out.buffer }, [out.buffer]);
}

self.onmessage = async (event) => {
  try {
    if (event.data?.type === "init") {
      await ensureSession();
      let msPerTile = 0;
      try {
        msPerTile = await measureTile();
      } catch {
        // A device that cannot even time a tile still runs; the page then uses its cautious size.
      }
      self.postMessage({ type: "ready", engine, threads, msPerTile });
    } else if (event.data?.type === "run") {
      await enhance(event.data);
    } else if (event.data?.type === "detect") {
      await detect(event.data);
    } else if (event.data?.type === "restore") {
      await restoreFace(event.data);
    }
  } catch (error) {
    self.postMessage({ type: "error", message: String(error?.message || error) });
  }
};
