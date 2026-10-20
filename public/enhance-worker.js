// Runs the Real-ESRGAN photo upscaler (public/models/realesr-general-x4v3.onnx) inside the visitor's browser, so no
// photo leaves their device and nothing is paid per run. ONNX Runtime is served from /ort (copied there at install).
//
// The page sends   { type: "run", width, height, pixels }   (pixels = RGBA bytes, transferred)
// and gets back    { type: "progress", done, total, engine }   as tiles finish,
//                  { type: "done", width, height, pixels, engine }   (4x larger RGBA bytes, transferred)
//                  { type: "error", message }
//
// The picture is cut into square tiles with a little overlap, because the model only needs a neighbourhood to
// work from and a whole photo would not fit in memory. The overlap is cut away again, so tiles join without seams.
importScripts("/ort/ort.min.js");

const SCALE = 4;
const TILE = 128; // pixels of the picture each tile keeps
const PAD = 12; // extra pixels read around a tile, thrown away after
const SIDE = TILE + PAD * 2;

ort.env.wasm.wasmPaths = "/ort/";
ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;

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

async function enhance({ width, height, pixels: buffer }) {
  const pixels = new Uint8ClampedArray(buffer);
  if (!session) {
    try {
      if (!self.navigator.gpu) throw new Error("no WebGPU");
      await open("webgpu");
    } catch {
      await open("wasm");
    }
  }

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

self.onmessage = async (event) => {
  if (event.data?.type !== "run") return;
  try {
    await enhance(event.data);
  } catch (error) {
    self.postMessage({ type: "error", message: String(error?.message || error) });
  }
};
