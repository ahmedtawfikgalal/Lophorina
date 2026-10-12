// Copies MediaPipe runtime files into public/mediapipe/ so the extension never loads them
// from a CDN at runtime (ADR-002). The model is downloaded once at setup time and verified
// against a pinned SHA-256.
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'mediapipe');
const wasmSrc = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');

// Classic (non-module) SIMD build only: used by both the main-thread strategy (script tag)
// and the classic recognition worker (importScripts).
const WASM_FILES = ['vision_wasm_internal.js', 'vision_wasm_internal.wasm'];

const MODEL = {
  file: 'gesture_recognizer.task',
  url: 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
  sha256: '97952348cf6a6a4915c2ea1496b4b37ebabc50cbbf80571435643c455f2b0482',
};

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const exists = (p) =>
  stat(p).then(
    () => true,
    () => false,
  );

async function copyWasm() {
  await mkdir(join(outDir, 'wasm'), { recursive: true });
  for (const f of WASM_FILES) await copyFile(join(wasmSrc, f), join(outDir, 'wasm', f));
}

async function ensureModel() {
  const dir = join(outDir, 'models');
  const dest = join(dir, MODEL.file);
  await mkdir(dir, { recursive: true });
  if (await exists(dest)) {
    if (sha256(await readFile(dest)) === MODEL.sha256) return 'cached';
    console.warn(`[assets] ${MODEL.file} checksum mismatch, re-downloading`);
  }
  const res = await fetch(MODEL.url);
  if (!res.ok) throw new Error(`[assets] model download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const actual = sha256(buf);
  if (actual !== MODEL.sha256) {
    throw new Error(`[assets] model checksum mismatch: expected ${MODEL.sha256}, got ${actual}`);
  }
  await writeFile(dest, buf);
  return 'downloaded';
}

await copyWasm();
const modelStatus = await ensureModel();
const pkg = JSON.parse(
  await readFile(join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'package.json'), 'utf8'),
);
await writeFile(
  join(outDir, 'versions.json'),
  JSON.stringify(
    { tasksVision: pkg.version, model: MODEL.file, modelSha256: MODEL.sha256 },
    null,
    2,
  ),
);
console.log(`[assets] wasm copied, model ${modelStatus}, tasks-vision ${pkg.version}`);
