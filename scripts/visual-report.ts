// Runs the automated checks on all fixture pairs in Node (sharp rasterizer) and prints a catch table.
import sharp from 'sharp';
import fs from 'node:fs';
import { compareImages, verdict, type Img } from '../src/lib/visual';
import { FIXTURES } from '../src/lib/fixtures';
import { gradeAll, gradePair } from '../src/lib/grading';
import ex from '../src/data/examples.json';

async function load(src: string): Promise<Img> {
  const { data, info } = await sharp('public' + src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data), width: info.width, height: info.height };
}
const rows = [];
const results = [];
for (const f of FIXTURES) {
  const v = compareImages(await load(f.goldenSrc), await load(f.agentSrc));
  results.push({ f, v });
  const sim = ex.pairs.find((p) => p.id === f.id)!.score;
  const { keyed, falsePositiveFlags } = gradePair(f, v);
  rows.push({ autoFlags: v.flags, falsePositiveFlags, id: f.id, sim, diffPct: +(v.diffPct * 100).toFixed(2), pass: verdict(sim, v), flags: v.flags.map((x) => x.message), answerKey: f.defects, keyed });
}
fs.writeFileSync('scripts/visual-report.json', JSON.stringify(rows, null, 1));
for (const r of rows) console.log(r.id, r.sim, r.diffPct + '%', r.pass ? 'PASS' : 'FAIL', '| key:', r.keyed.map((k) => `${k.defect}:${k.caught ? 'caught' : 'MISSED'}`).join(',') || 'none', '|', r.flags.join(' ; '), '| false-positive flags:', r.falsePositiveFlags.length);

console.table(rows.flatMap(r => r.keyed.map(k => ({ pair: r.id, defect: k.note, category: k.defect, result: k.caught ? 'caught' : 'MISSED' }))));
const g = gradeAll(results);
console.log(`Caught ${g.caught}/${g.total} planted defects; ${g.falsePositives} false-positive flags (category + box overlap).`);
