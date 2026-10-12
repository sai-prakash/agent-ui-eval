# Agent UI Check

**Compare what an AI agent built with the approved design, right in your browser.**

You give it two images: the approved design and the agent's version. It runs a pixel diff, draws a heatmap of what changed, and flags the changed areas automatically (off-palette colour, state change, layout shift, missing or extra element). The verdict comes from the pixel diff and those flags only. An image embedding model (EmbeddingGemma 2) is optional and shown for context; it never changes the verdict.

## Live demo

https://agent-ui-eval.vercel.app

> **Demo GIF: TODO**

## What you see

- **10 sample pairs** (hand-made SVGs in `public/fixtures/`), checked on page load with no model download. Each shows the approved design, the agent version and a heatmap (red = changed pixels, yellow numbered boxes = flagged areas), plus the verdict, the numbered flags and the answer key.
- **Answer key:** each sample lists the defects the author planted on purpose. It's labelled as such and only used to grade the checks. The verdict never reads it.
- **Catch rate:** the page counts how many planted defects were caught in the right place, and how many flags don't match any planted defect, live in your browser.
- **Check your own pair:** upload an approved design and an agent version. You get the same verdict, heatmap and flags, with no model download. If the two images are different sizes, the agent image is scaled to the approved size and the page tells you so.
- **Optional model similarity:** a button downloads the model and re-scores the samples in your browser. If it's loaded, your uploaded pairs also get a score. It's labelled "model similarity (context only)".

## How the checks work

All of this lives in `src/lib/visual.ts` and is plain image code, no model:

1. **Pixel diff:** [pixelmatch](https://github.com/mapbox/pixelmatch) compares the two images (threshold 0.1, anti-aliasing ignored).
2. **Changed regions:** changed pixels are grouped into 8 px cells and nearby cells are joined into regions. Tiny regions are dropped.
3. **Flags per region** (heuristics):
   - **Missing / extra element:** the approved design has content here and the agent version is mostly empty, or the other way round.
   - **Off-palette colour:** the agent uses a colour that doesn't fill any real area of the approved design.
   - **Different state:** a colour swapped for another colour that the approved design does use elsewhere (for example a disabled button drawn as active).
   - **Position or size changed:** the content's edges moved by 3 px or more.
   - **Moved:** a missing region and an extra region with the same main colour and a similar size are merged into one "moved" flag.
4. **Colour names:** where a colour matches a design token from `src/index.css` (accent `#5b8cff`, danger `#e5484d`, success `#3dd68c`), the message names it and keeps the hex, e.g. "the accent colour (#5b8cff)".
5. **Verdict:** a pair passes only if changed pixels are at or below `DIFF_THRESHOLD` (0.2%) **and** nothing is flagged.

Uploads are checked for size before decoding (`src/lib/uploads.ts`: up to 10 MB, longest side capped at 2048 px). When sizes differ, the agent image is scaled with nearest-neighbour, which behaves the same in the browser and in Node.

## How well it works

These numbers come from `scripts/visual-report.json` (written by `scripts/visual-report.ts`) and `src/data/examples.json` (written by `scripts/precompute.mjs`).

| Measure | Result on the 10 sample pairs |
| --- | --- |
| Verdicts | 9 pairs with planted defects fail, the 1 control pair (Progress Bar) passes |
| Planted defects caught in the right place | 10 of 11 |
| Flags that match no planted defect | 4 (all on Underline Tabs) |
| Missed | Underline Tabs: active underline under the wrong tab |
| Model similarity range | 0.9771 (Primary Button) to 1.0 (Progress Bar) |

**How it was measured.** `scripts/visual-report.ts` rasterizes each SVG pair with sharp in Node, runs the same `compareImages` code the browser uses, and grades the flags with `src/lib/grading.ts`. A planted defect counts as caught only if a flag has a matching category **and** its box overlaps the planted area. Any flag that matches no planted defect counts as a false positive. Model similarity is the cosine similarity of EmbeddingGemma 2 image embeddings (q8, Node, Transformers.js 4.3.1).

**Caveats.**

- The data is tiny and synthetic: 10 hand-made SVG pairs, 11 planted defects. This is a sanity check, not a benchmark.
- The thresholds were chosen on these same samples. There is no held-out set, and nothing here shows how it does on real screenshots (JPEG noise, gradients, shadows and anti-aliasing will all cause trouble for exact-colour checks).
- The answer key and its boxes were written by the same person who built the checks.
- Browsers rasterize SVGs differently from sharp, so the in-browser count shown on the page can differ from the Node report.
- The model rates every sample pair at least 0.977 similar, including pairs with obvious defects. That's why it's context only.

## Model (optional)

| Field | Value |
| --- | --- |
| **Model id** | [`onnx-community/embeddinggemma-2-ONNX`](https://huggingface.co/onnx-community/embeddinggemma-2-ONNX) |
| **Used for** | Image embeddings of the two images, compared with cosine similarity |
| **Preferred device** | `webgpu` + `dtype: "q4f16"` |
| **Fallback** | `wasm` + `dtype: "q8"` on the plain CPU ONNX Runtime binary in `public/ort/` |
| **Encoders loaded** | Text + vision (audio encoder skipped to shrink the download) |

- **Nothing downloads until you click the button.** The page opens with precomputed scores from `src/data/examples.json`, and the model code (Transformers.js + ONNX Runtime) is loaded with a dynamic `import()` only after you opt in.
- **CPU fallback:** the app asks for a real WebGPU adapter first. Without one it goes straight to WASM + q8 and points ONNX Runtime at the plain CPU WASM binary in `public/ort/`, because the WebGPU build bundled with Transformers.js has no CPU kernel for `GatherBlockQuantized`, which every quantized EmbeddingGemma 2 file uses. If the GPU fails while loading or during a first test inference, the page reloads once in CPU mode and resumes.
- **Repeat visits:** the browser's Cache API stores the model files, so a second visit skips the download (checked on Design System Search, which shares this loader, with a persistent Chromium profile: 0 model requests on the second load). There is no service worker, so this is not an offline mode.

## Privacy

Everything runs in your browser. Uploaded images are never sent anywhere, and there is no server.

## Run locally

```bash
npm install
npm run dev
```

Then open the printed localhost URL (WebGPU works best in Chrome or Edge).

> `.npmrc` sets `ignore-scripts=true` so `onnxruntime-node` postinstall scripts are skipped (browser WASM/WebGPU only).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview the production build |
| `npm test` | Unit tests (Vitest) |
| `npx vite-node scripts/visual-report.ts` | Rerun the checks on all samples in Node and write `scripts/visual-report.json` (no model needed) |
| `node scripts/precompute.mjs` | Recompute model similarity for the samples and write `src/data/examples.json` (downloads the model, Node 24) |

CI (`.github/workflows/ci.yml`) runs `tsc -b`, `vitest run` and `vite build`.

## Deploy

Set up for **Vercel** (static Vite output, Node 24). COOP/COEP headers in `vercel.json` enable `SharedArrayBuffer` / WASM threads where available.

```bash
npx vercel --prod
```

## License

Apache-2.0 (compatible with EmbeddingGemma 2's Apache-2.0 release). Sample SVG fixtures in `public/fixtures/` are original to this repo.
