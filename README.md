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
| **Fallback** | `wasm` + `dtype: "q8"` |
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
