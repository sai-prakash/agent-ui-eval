import type { FixtureCase, LintKind } from './fixtures';

export type LintFlag = {
  kind: LintKind;
  severity: 'error' | 'warn';
  message: string;
};

const KIND_LABEL: Record<LintKind, string> = {
  spacing: 'Spacing',
  token: 'Color token',
  missing_state: 'Missing state',
};

/**
 * Simple design-lint flags derived from fixture metadata.
 * In a production harness these would come from layout/token parsers;
 * here they mirror the intentional agent defects for demo clarity.
 */
export function lintFixture(fixture: FixtureCase): LintFlag[] {
  return fixture.defects.map((kind, i) => ({
    kind,
    severity: kind === 'missing_state' ? 'error' : 'warn',
    message: fixture.defectNotes[i] ?? `${KIND_LABEL[kind]} mismatch vs golden`,
  }));
}

export function lintSummary(flags: LintFlag[]): string {
  if (flags.length === 0) return 'No lint flags';
  const counts = { spacing: 0, token: 0, missing_state: 0 };
  for (const f of flags) counts[f.kind] += 1;
  return (Object.entries(counts) as [LintKind, number][])
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${KIND_LABEL[k].toLowerCase()}`)
    .join(' · ');
}
