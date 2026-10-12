# Agent UI Eval

**Browser-based eval harness for agent-generated UI vs golden component renders.**

Pixel differences and region checks compare approved and agent images locally, with a verdict, flags and heatmap. Upload comparison needs no model. EmbeddingGemma similarity is optional secondary information; it does not decide the verdict. Offline reopening is not guaranteed.

## Live demo

https://agent-ui-eval.vercel.app

> **Demo GIF:** drop a short screen recording at `docs/demo.gif` and replace this note with `![Agent UI Eval demo](docs/demo.gif)`.

## Stack

React · TypeScript · Vite · Transformers.js · WebGPU · EmbeddingGemma 2

## Model

| Field | Value |
| --- | --- |
| **Model id** | [`onnx-community/embeddinggemma-2-ONNX`](https://huggingface.co/onnx-community/embeddinggemma-2-ONNX) |
| **Task** | Multimodal feature extraction (image embeddings for golden vs agent) |
| **Preferred device** | `webgpu` + `dtype: "q4f16"` |
| **Fallback** | `wasm` + `dtype: "q8"` on the plain CPU ONNX Runtime binary (`public/ort/`) |
| **Encoders loaded** | Text + vision (audio encoder disabled to shrink download) |

## Scoring

A pair passes only when changed pixels are at or below `DIFF_THRESHOLD` in `src/lib/visual.ts` and no region flags are raised. Similarity does not influence pass/fail. The author-planted answer key is labelled separately and never read by the verdict.

Uploads are validated before decoding and bounded using the limits in `src/lib/uploads.ts`. For different decoded sizes, the agent image is scaled to the approved image dimensions; results explicitly note this normalization.

## Run locally

```bash
npm install
npm run dev
```

Then open the printed localhost URL (WebGPU works best in Chrome / Edge).

```bash
npm run build
npm run preview
```

> `.npmrc` sets `ignore-scripts=true` so `onnxruntime-node` postinstall scripts are skipped (browser WASM/WebGPU only).

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview the production build |

## Deploy

This repo is set up for **Vercel** (static Vite output, Node 24). COOP/COEP headers in `vercel.json` enable `SharedArrayBuffer` / WASM threads where available.

```bash
npx vercel --prod
```

Or connect `sai-prakash/agent-ui-eval` in the Vercel dashboard.

## License

Apache-2.0 (compatible with EmbeddingGemma 2’s Apache-2.0 release).

Sample SVG fixtures in `/public/fixtures/` are original to this repo.

## Instant mode and CPU fallback (Oct 2026)

- The page opens with real, precomputed example results (`src/data/examples.json`, pixel checks run locally on page load). They were produced by running the same model (q8) in Node with `scripts/precompute.mjs`; rerun it after changing samples: `node scripts/precompute.mjs (Node 24)`.
- The live model is opt-in. The app checks for a real WebGPU adapter first. Without one it goes straight to WASM + q8 and points ONNX Runtime at the plain CPU WASM binary in `public/ort/`, because the WebGPU build bundled with Transformers.js has no CPU kernel for `GatherBlockQuantized`, which every quantized EmbeddingGemma 2 file uses.

## Automated checks

Pixelmatch supplies changed pixels; region heuristics classify colour, state, layout, missing and extra findings. Matching missing/extra regions with similar content colour, area and dimensions merge into a moved layout finding. These checks are heuristics, not semantic verification, and the thresholds have not been calibrated on held-out screenshots.

Answer-key grading requires both a matching flag category and overlap with its expected SVG-coordinate box. The Node report uses sharp; browser rasterizers can produce different results. Reproduce the report without model downloads:

```bash
npx vite-node scripts/visual-report.ts
npx tsc -b
npx vitest run
npx vite build
```

The generated per-defect results and unmatched flags are in `scripts/visual-report.json`. The report prints caught/missed defects and false-positive flags rather than crediting category matches elsewhere in the image.

Model code remains dynamically imported after opt-in. The loader runs a tiny image inference inside the GPU fallback block; a failure sets the CPU/reload-and-resume flags. The self-hosted CPU WASM path remains in `public/ort`.

TODO orchestrator: measure model transfer sizes with model access and verify GPU inference and CPU reload/resume in a browser. Existing precomputed embeddings are preserved; no new model measurements were possible without network access.
