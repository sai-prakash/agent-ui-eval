import { cosineSimilarity, embedImageBlob, embedImageUrl } from './embedder';
import { FIXTURES } from './fixtures';
export { loadEmbedder } from './embedder';

/** Re-score image similarity for every pair live in the browser. */
export async function similarityLive(onItem?: (done: number, total: number) => void): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (let i = 0; i < FIXTURES.length; i++) {
    onItem?.(i, FIXTURES.length);
    const f = FIXTURES[i]!;
    out[f.id] = cosineSimilarity(await embedImageUrl(f.goldenSrc), await embedImageUrl(f.agentSrc));
    await new Promise((r) => setTimeout(r, 0));
  }
  return out;
}

export async function compareOwn(a: Blob, b: Blob): Promise<number> {
  return cosineSimilarity(await embedImageBlob(a), await embedImageBlob(b));
}
