// Runs the automated checks on all fixture pairs in Node (sharp rasterizer) and prints a catch table.
import sharp from 'sharp';
import fs from 'node:fs';
import { compareImages, flagMatches, verdict, type Img } from '../src/lib/visual';
import { FIXTURES } from '../src/lib/fixtures';
import ex from '../src/data/examples.json';

async function load(src: string): Promise<Img> {
  const { data, info } = await sharp('public' + src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data), width: info.width, height: info.height };
}
const rows = [];
for (const f of FIXTURES) {
  const v = compareImages(await load(f.goldenSrc), await load(f.agentSrc));
  const sim = ex.pairs.find((p) => p.id === f.id)!.score;
  const keyed = f.defects.map((d, i) => ({ defect: d, note: f.defectNotes[i], box: f.defectBoxes[i], caught: v.flags.some(flag => flagMatches(flag, d, f.defectBoxes[i]!)) }));
  const falsePositiveFlags = v.flags.filter(flag => !f.defects.some((d, i) => flagMatches(flag, d, f.defectBoxes[i]!)));
  rows.push({ autoFlags: v.flags, falsePositiveFlags, id: f.id, sim, diffPct: +(v.diffPct * 100).toFixed(2), pass: verdict(sim, v), flags: v.flags.map((x) => x.message), answerKey: f.defects, keyed });
}
fs.writeFileSync('scripts/visual-report.json', JSON.stringify(rows, null, 1));
for (const r of rows) console.log(r.id, r.sim, r.diffPct + '%', r.pass ? 'PASS' : 'FAIL', '| key:', r.keyed.map((k) => `${k.defect}:${k.caught ? 'caught' : 'MISSED'}`).join(',') || 'none', '|', r.flags.join(' ; '), '| false-positive flags:', r.falsePositiveFlags.length);

console.table(rows.flatMap(r => r.keyed.map(k => ({ pair: r.id, defect: k.note, category: k.defect, result: k.caught ? 'caught' : 'MISSED' }))));
const defects = rows.flatMap(r => r.keyed);
console.log(`Caught ${defects.filter(d => d.caught).length}/${defects.length} planted defects; ${rows.reduce((n, r) => n + r.falsePositiveFlags.length, 0)} false-positive flags (category + box overlap).`);
