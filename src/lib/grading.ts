import type { FixtureCase } from './fixtures';
import { flagMatches, type VisualReport } from './visual';

/** Grade automated flags against the author-planted answer key: category and location must both match. */
export function gradePair(f: FixtureCase, v: VisualReport) {
  const keyed = f.defects.map((d, i) => ({
    defect: d,
    note: f.defectNotes[i] ?? '',
    box: f.defectBoxes[i]!,
    caught: v.flags.some((flag) => flagMatches(flag, d, f.defectBoxes[i]!)),
  }));
  const falsePositiveFlags = v.flags.filter((flag) => !f.defects.some((d, i) => flagMatches(flag, d, f.defectBoxes[i]!)));
  return { keyed, falsePositiveFlags };
}

export type Grade = { pairs: number; caught: number; total: number; falsePositives: number };

export function gradeAll(results: { f: FixtureCase; v: VisualReport }[]): Grade {
  const graded = results.map(({ f, v }) => gradePair(f, v));
  const keyed = graded.flatMap((g) => g.keyed);
  return {
    pairs: results.length,
    caught: keyed.filter((k) => k.caught).length,
    total: keyed.length,
    falsePositives: graded.reduce((n, g) => n + g.falsePositiveFlags.length, 0),
  };
}
