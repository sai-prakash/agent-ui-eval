import { cosineSimilarity, embedImageBlob, embedImageUrl } from './embedder';
import { FIXTURES, PASS_THRESHOLD, type FixtureCase } from './fixtures';
import { lintFixture, type LintFlag } from './lint';

export type EvalResult = { fixture: FixtureCase; score: number; passed: boolean; flags: LintFlag[] };

export function toResult(fixture: FixtureCase, score: number): EvalResult {
  const flags = lintFixture(fixture);
  return { fixture, score, passed: score >= PASS_THRESHOLD && flags.length === 0, flags };
}

/** Re-score every pair live in the browser. */
export async function runEvalLive(onItem?: (done: number, total: number) => void): Promise<EvalResult[]> {
  const out: EvalResult[] = [];
  for (let i = 0; i < FIXTURES.length; i++) {
    onItem?.(i, FIXTURES.length);
    const f = FIXTURES[i]!;
    const score = cosineSimilarity(await embedImageUrl(f.goldenSrc), await embedImageUrl(f.agentSrc));
    out.push(toResult(f, score));
    await new Promise((r) => setTimeout(r, 0));
  }
  return out;
}

export async function compareOwn(a: Blob, b: Blob): Promise<number> {
  return cosineSimilarity(await embedImageBlob(a), await embedImageBlob(b));
}
