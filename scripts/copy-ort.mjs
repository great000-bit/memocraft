// The in-browser enhancer loads ONNX Runtime from this site, not from a CDN. This copies the runtime files from the
// installed package into public/ort (git-ignored) on every install and build.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "onnxruntime-web", "dist");
const to = join(root, "public", "ort");
const files = [
  "ort.min.js",
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
];

if (!existsSync(from)) {
  console.warn("onnxruntime-web is not installed; skipping the copy to public/ort");
} else {
  mkdirSync(to, { recursive: true });
  for (const file of files) cpSync(join(from, file), join(to, file));
}
