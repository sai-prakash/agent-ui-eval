import { load, embedSvg, cos, meta, write, importTs } from './precompute-core.mjs';
const { FIXTURES } = await importTs('src/lib/fixtures.ts');
await load();
const pairs = [];
for (const f of FIXTURES) {
  const score = cos(await embedSvg(f.goldenSrc), await embedSvg(f.agentSrc));
  pairs.push({ id: f.id, score: +score.toFixed(4) });
  console.log(f.id, score.toFixed(4));
}
write('src/data/examples.json', { ...meta(), pairs });
