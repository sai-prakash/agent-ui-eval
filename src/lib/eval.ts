import {
  cosineSimilarity,
  embedImageUrl,
} from './embedder';
import {
  FIXTURES,
  PASS_THRESHOLD,
  type FixtureCase,
} from './fixtures';
import { lintFixture, type LintFlag } from './lint';

export type EvalResult = {
  fixture: FixtureCase;
  score: number;
  passed: boolean;
  flags: LintFlag[];
};

let results: EvalResult[] | null = null;
let runPromise: Promise<EvalResult[]> | null = null;

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => resolve(), { timeout: 48 });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

export function getResults(): EvalResult[] | null {
  return results;
}

export function getPassThreshold(): number {
  return PASS_THRESHOLD;
}

export async function runEval(
  onItem?: (done: number, total: number, label: string) => void,
): Promise<EvalResult[]> {
  if (results) return results;
  if (runPromise) return runPromise;

  runPromise = (async () => {
    const out: EvalResult[] = [];
    const total = FIXTURES.length;
    const errors: string[] = [];

    for (let i = 0; i < FIXTURES.length; i++) {
      const fixture = FIXTURES[i]!;
      onItem?.(i, total, fixture.label);
      await yieldToMain();

      try {
        const goldenEmb = await embedImageUrl(fixture.goldenSrc);
        await yieldToMain();
        const agentEmb = await embedImageUrl(fixture.agentSrc);
        const score = cosineSimilarity(goldenEmb, agentEmb);
        const flags = lintFixture(fixture);
        // Fail if below visual threshold OR any lint flags fire.
        const passed = score >= PASS_THRESHOLD && flags.length === 0;
        out.push({ fixture, score, passed, flags });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[eval] failed on ${fixture.id}:`, err);
        errors.push(`${fixture.label}: ${msg}`);
        out.push({
          fixture,
          score: 0,
          passed: false,
          flags: [
            {
              kind: 'missing_state',
              severity: 'error',
              message: `Eval error: ${msg}`,
            },
          ],
        });
      }
    }

    onItem?.(total, total, 'done');

    if (out.length === 0) {
      runPromise = null;
      throw new Error(
        errors[0]
          ? `Eval failed — ${errors[0]}`
          : 'Eval failed — no fixtures could be scored',
      );
    }

    results = out;
    return out;
  })();

  try {
    return await runPromise;
  } catch (err) {
    runPromise = null;
    throw err;
  }
}

export type SuiteSummary = {
  total: number;
  passed: number;
  failed: number;
  avgScore: number;
};

export function summarize(rows: EvalResult[]): SuiteSummary {
  const total = rows.length;
  const passed = rows.filter((r) => r.passed).length;
  const avgScore =
    total === 0
      ? 0
      : rows.reduce((acc, r) => acc + r.score, 0) / total;
  return { total, passed, failed: total - passed, avgScore };
}
