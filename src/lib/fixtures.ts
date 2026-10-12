import type { Box } from './visual';

export type LintKind = 'spacing' | 'token' | 'missing_state';

export type FixtureCase = {
  id: string;
  label: string;
  category: string;
  description: string;
  goldenSrc: string;
  agentSrc: string;
  /** Defects the author planted on purpose. Answer key only: the verdict never reads this. */
  defects: LintKind[];
  defectNotes: string[];
  /** SVG coordinates; text bounds conservatively include its font-height envelope. */
  defectBoxes: Box[];
};


export const FIXTURES: FixtureCase[] = [
  {
    id: 'button-primary',
    label: 'Primary Button',
    category: 'Button',
    description: 'Filled primary CTA — agent used a purple fill instead of accent token.',
    goldenSrc: '/fixtures/golden/button-primary.svg',
    agentSrc: '/fixtures/agent/button-primary.svg',
    defects: ['token'],
    defectBoxes: [{ x: 150, y: 118, w: 180, h: 44 }],
    defectNotes: ['Fill uses #a855f7 instead of accent #5b8cff'],
  },
  {
    id: 'button-disabled',
    label: 'Disabled Button',
    category: 'Button',
    description: 'Enabled + disabled pair — agent omitted the disabled visual state.',
    goldenSrc: '/fixtures/golden/button-disabled.svg',
    agentSrc: '/fixtures/agent/button-disabled.svg',
    defects: ['missing_state'],
    defectBoxes: [{ x: 260, y: 118, w: 140, h: 44 }],
    defectNotes: ['Disabled button rendered as active primary'],
  },
  {
    id: 'input-text',
    label: 'Text Input',
    category: 'Input',
    description: 'Labeled text field — agent collapsed label/field spacing.',
    goldenSrc: '/fixtures/golden/input-text.svg',
    agentSrc: '/fixtures/agent/input-text.svg',
    defects: ['spacing'],
    defectBoxes: [{ x: 40, y: 97, w: 380, h: 69 }],
    defectNotes: ['Label overlapping field; uneven horizontal padding'],
  },
  {
    id: 'toggle-switch',
    label: 'Toggle Switch',
    category: 'Control',
    description: 'On/off toggles — agent used success green for the ON track.',
    goldenSrc: '/fixtures/golden/toggle-switch.svg',
    agentSrc: '/fixtures/agent/toggle-switch.svg',
    defects: ['token'],
    defectBoxes: [{ x: 300, y: 112, w: 56, h: 32 }],
    defectNotes: ['ON track uses #22c55e instead of accent #5b8cff'],
  },
  {
    id: 'card-stats',
    label: 'Stats Card',
    category: 'Card',
    description: 'KPI card — agent cramped value under label and drifted the badge.',
    goldenSrc: '/fixtures/golden/card-stats.svg',
    agentSrc: '/fixtures/agent/card-stats.svg',
    defects: ['spacing'],
    defectBoxes: [{ x: 48, y: 95, w: 324, h: 129 }],
    defectNotes: ['Value too close to caption; trend badge bottom-right drift'],
  },
  {
    id: 'modal-confirm',
    label: 'Confirm Modal',
    category: 'Modal',
    description: 'Destructive confirm — agent widened action gap and wrong danger token.',
    goldenSrc: '/fixtures/golden/modal-confirm.svg',
    agentSrc: '/fixtures/agent/modal-confirm.svg',
    defects: ['spacing', 'token'],
    defectBoxes: [{ x: 120, y: 168, w: 280, h: 36 }, { x: 276, y: 168, w: 124, h: 36 }],
    defectNotes: [
      'Cancel/Delete action gap widened',
      'Delete uses #f97316 instead of danger #e5484d',
    ],
  },
  {
    id: 'badge-status',
    label: 'Status Badges',
    category: 'Badge',
    description: 'Success/warning/error pills — agent mapped all to accent blue.',
    goldenSrc: '/fixtures/golden/badge-status.svg',
    agentSrc: '/fixtures/agent/badge-status.svg',
    defects: ['token'],
    defectBoxes: [{ x: 80, y: 120, w: 320, h: 32 }],
    defectNotes: ['Semantic colors collapsed to accent #5b8cff'],
  },
  {
    id: 'tabs-underline',
    label: 'Underline Tabs',
    category: 'Tabs',
    description: 'Active underline tabs — agent misplaced the indicator.',
    goldenSrc: '/fixtures/golden/tabs-underline.svg',
    agentSrc: '/fixtures/agent/tabs-underline.svg',
    defects: ['spacing'],
    defectBoxes: [{ x: 72, y: 144, w: 192, h: 19 }],
    defectNotes: ['Active underline sits under wrong tab / below baseline'],
  },
  {
    id: 'empty-state',
    label: 'Empty State',
    category: 'Empty',
    description: 'Zero-state with CTA — agent dropped the Create button.',
    goldenSrc: '/fixtures/golden/empty-state.svg',
    agentSrc: '/fixtures/agent/empty-state.svg',
    defects: ['missing_state', 'spacing'],
    defectBoxes: [{ x: 180, y: 210, w: 120, h: 32 }, { x: 120, y: 182, w: 240, h: 38 }],
    defectNotes: ['Missing primary Create CTA', 'Helper text drifted down'],
  },
  {
    id: 'progress-bar',
    label: 'Progress Bar',
    category: 'Feedback',
    description: 'Linear progress — agent matched the golden (control case).',
    goldenSrc: '/fixtures/golden/progress-bar.svg',
    agentSrc: '/fixtures/agent/progress-bar.svg',
    defects: [],
    defectBoxes: [],
    defectNotes: [],
  },
];
