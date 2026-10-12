import { describe, expect, it } from 'vitest';
import { gradeAll, gradePair } from './grading';
import type { FixtureCase } from './fixtures';
import type { AutoFlag, VisualReport } from './visual';

const fixture: FixtureCase = {
  id: 't', label: 'T', category: 'T', description: '', goldenSrc: '', agentSrc: '',
  defects: ['token', 'spacing'],
  defectNotes: ['colour', 'gap'],
  defectBoxes: [{ x: 0, y: 0, w: 10, h: 10 }, { x: 50, y: 50, w: 10, h: 10 }],
};
const report = (flags: AutoFlag[]): VisualReport => ({ width: 1, height: 1, diffPixels: 0, diffPct: 0, diff: new Uint8ClampedArray(4), flags });

describe('answer-key grading', () => {
  it('counts caught defects and unmatched flags by category and location', () => {
    const v = report([
      { kind: 'colour', message: '', box: { x: 2, y: 2, w: 4, h: 4 } },
      { kind: 'layout', message: '', box: { x: 0, y: 0, w: 4, h: 4 } },
    ]);
    const g = gradePair(fixture, v);
    expect(g.keyed.map((k) => k.caught)).toEqual([true, false]);
    expect(g.falsePositiveFlags).toHaveLength(1);
    expect(gradeAll([{ f: fixture, v }])).toEqual({ pairs: 1, caught: 1, total: 2, falsePositives: 1 });
  });
});
