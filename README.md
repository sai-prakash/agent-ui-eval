# Agent UI Eval

**Browser-based eval harness for agent-generated UI vs golden component renders.**

EmbeddingGemma 2 (via Transformers.js + WebGPU) embeds golden and agent screenshots locally, ranks them by cosine similarity, and surfaces simple lint flags for spacing, color-token, and missing-state defects. After the first model download, the tab works offline — no server-side embeddings.

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

| Signal | Rule |
| --- | --- |
| **Similarity** | Cosine similarity between golden and agent image embeddings |
| **Threshold** | Pass when similarity ≥ **92%** |
| **Lint flags** | `spacing` · `token` · `missing_state` |
| **Suite pass** | Similarity ≥ threshold **and** zero lint flags |

Fixtures under `public/fixtures/` include intentional agent mistakes (wrong accent/danger tokens, collapsed spacing, missing disabled/CTA states) plus one clean control case.

## Features

- Dark dashboard titled **Agent UI Eval**
- First-load progress for model download + local scoring of ~10 fixture pairs
- Side-by-side golden vs agent screenshots
- Pass/fail verdict with similarity score vs threshold
- Lint flag list per case (spacing / token / missing state)
- Suite summary (pass count, failures, average similarity)
- Filter: All / Fail / Pass
- Privacy: embeddings never leave the tab after download

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

## Portfolio / Built card

Suggested 2-line copy for [saiprakash.design](https://saiprakash.design):

> **Agent UI Eval** — Golden vs agent component renders, scored in the browser.
> EmbeddingGemma cosine similarity + spacing/token/state lint flags; WebGPU on-device.

## License

Apache-2.0 (compatible with EmbeddingGemma 2’s Apache-2.0 release).

Sample SVG fixtures in `/public/fixtures/` are original to this repo.

## Instant mode and CPU fallback (Oct 2026)

- The page opens with real, precomputed example results (`src/data/examples.json`, plus library embeddings in `public/` where used). They were produced by running the same model (q8) in Node with `scripts/precompute.mjs`; rerun it after changing samples: `npm i --no-save sharp && node scripts/precompute.mjs`.
- The live model is opt-in. The app checks for a real WebGPU adapter first. Without one it goes straight to WASM + q8 and points ONNX Runtime at the plain CPU WASM binary in `public/ort/`, because the WebGPU build bundled with Transformers.js has no CPU kernel for `GatherBlockQuantized`, which every quantized EmbeddingGemma 2 file uses.

## Automated checks (verdict no longer uses author notes)

The pass/fail verdict now comes only from signals computed from the images:

1. **Pixel diff** (`pixelmatch`, threshold 0.1, anti-aliasing ignored) on same-size renders; pass at ≤ 0.2% changed pixels. The UI shows the diff heatmap with flagged areas boxed.
2. **Region checks** (`src/lib/visual.ts`) on each changed area: off-palette colours (not used anywhere in the approved render), colour swaps to another approved colour ("different state"), elements that moved or resized (edge shift ≥ 3px), and elements that disappeared or were added.
3. **Embedding similarity** (EmbeddingGemma 2), pass at ≥ 0.92.

The defects the author planted in each fixture are kept as a labelled **answer key** to grade the checks. On the 10 sample pairs the checks catch 11 of 11 planted defects and pass the control pair; the thresholds were tuned on these same samples, so this is a sanity check, not a benchmark. No contrast check yet. Reproduce in Node: `npm i --no-save sharp && npx tsx scripts/visual-report.ts`.

Model code is lazy-loaded: the pixel checks run on page load with no download; Transformers.js loads only when you click "Run the model".
